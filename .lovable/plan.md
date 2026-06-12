# V2 Resilience + Observability Plan (final)

Incorporates every reviewer clarification from the last two rounds. Scope unchanged.

**Out of scope (do not touch):** V1, DB, pricing, response envelope shape (except additive `request_id`), Firecrawl recovery logic & timeouts, Gemini model / tools / prompt / `responseMimeType`, save flow, UI redesign, Amazon canonicalization.

---

## 1. Request-scoped telemetry

**Files:** `supabase/functions/analyze-entity-url-v2/index.ts`, `schema.ts`

- At handler entry: `const request_id = crypto.randomUUID()`; initialize a mutable `trace` object with `request_id`, `path: "error"`, `host: null`, `final: { error_code: "UNKNOWN", total_duration_ms: 0 }`. Defaults guarantee that even validation/SSRF/DNS early-returns emit a usable trace.
- Every return path (auth fail, JSON parse fail, invalid URL, blocked host, DNS fail, fetch error, Gemini fail, success, unhandled throw) **MUST** set `trace.final = { prediction_source, error_code, total_duration_ms }` and `trace.path` before returning. A single `try { … } finally { console.info("[analyze-entity-url-v2] trace", trace) }` wrapper at the top of the handler emits exactly one structured trace line per invocation. The `finally` block also stamps `total_duration_ms` from a monotonic start time as a safety net.
- Response shape (additive only):
  - `V2SuccessResponse.metadata.request_id: string` (new required field).
  - `V2ErrorResponse.request_id?: string` (new optional field; non-breaking — existing callers ignore unknown fields).
- `analysis_trace` is **NOT** put on the wire. Server-side log only.
- Existing per-stage `console.warn` / `console.log` lines stay; each is prefixed with `request_id` so multi-line logs can still be correlated under concurrency.

**`AnalysisTrace` shape (server-side log only, sanitized):**

```text
request_id
path: "happy" | "fetch_recovery" | "weak_recovery" | "error"
host                              // URL().host only, or null on pre-parse failures
direct_fetch: { attempted, ok, status, content_type, bytes, duration_ms, error_code }
deterministic_extract: { ok, weak_signals }
firecrawl:  { eligible, attempted, ok, duration_ms, error_code, skip_reason }
gemini: {
  attempted, ok, duration_ms, error_code,
  used_url_context, used_google_search, url_context_failed,
  raw_text_length, raw_text_sha8        // first 8 hex chars of SHA-256
}
merge: { path, field_winners }          // labels only — see below
final: { prediction_source, error_code, total_duration_ms }
```

**Never log:** full URL with query params (host only), headers, HTML, markdown, raw Firecrawl output, raw Gemini text, prompt text, API keys, prediction values, image URLs.

**Hash impl:** `crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))` → hex → first 8 chars. Native to Deno Edge, no dependency.

**`merge.field_winners` is label-only.** Re-use existing `metadata.merge.field_winners` source labels from `schema.ts` (`"extractor" | "gemini" | "firecrawl" | "merged" | "none"`). Never include predicted values.

---

## 2. Tolerant Gemini JSON parsing

**Files:** `supabase/functions/analyze-entity-url-v2/gemini.ts`, `gemini_test.ts`

Today (line ~306): `parsed = JSON.parse(stripCodeFences(text))` — single attempt, fails on prose-wrapped grounded responses.

Replace with `tolerantParseGeminiJson(text, schema)` that produces a **list of candidate objects**, then Zod-validates each one in order and returns the first that passes. Candidates, in order:

1. `JSON.parse(stripCodeFences(text))` — current behavior.
2. First **balanced top-level `{…}` block** extracted by a brace-counting scanner (string-literal aware) from the raw text.
3. For **each** of candidates (1) and (2): if it is a plain object, also consider its **conservative nested wrappers**:
   - well-known wrapper keys: `prediction`, `result`, `response`, `data`
   - OR any property whose value is a plain object containing **both** `type` AND `name`
   - Arrays, primitives, and metadata-shaped objects (e.g. only `confidence` / `reasoning`) are rejected.

Each candidate is Zod-validated against the existing `GeminiRawPrediction` schema; first pass wins. If none yields a schema-valid object, return the **existing** error codes — `GEMINI_INVALID_JSON` when no candidate parses as JSON, `GEMINI_INVALID_SHAPE` when at least one parsed but none satisfied Zod. **No new error codes.** No raw / unvalidated fallback. No schema loosening. No `responseMimeType` retry.

**Tests added to `gemini_test.ts`:**
- existing fenced ```json … ``` test stays green
- leading prose + JSON succeeds
- trailing prose after JSON succeeds
- `{ "prediction": { type, name, … } }` as the **entire response** succeeds (nested wrapper on candidate 1, not only candidate 2)
- `{ "result": { … } }` wrapper succeeds when Zod-valid
- prose + `{ "prediction": { … } }` succeeds (nested wrapper on candidate 2)
- nested object with only `confidence` / `reasoning` (no type+name) is rejected → `GEMINI_INVALID_SHAPE`
- array-of-objects is rejected
- malformed JSON still fails with `GEMINI_INVALID_JSON`
- valid JSON shape that fails Zod still fails with `GEMINI_INVALID_SHAPE`

---

## 3. Frontend AI-failure state

**Files:** the URL-analyze modal in the quick-add / create-entity flow (the component that renders the "AI suggests these values / Apply to form" card).

- Inline message rendered **only after** the analyze request resolves with either an error or success-with-no-predictions (never while `isLoading`):
  > "AI couldn't extract reliable details from this URL. You can fill the form manually or try again."
- If the response includes `request_id` (success metadata or error body), render it underneath in small muted text:
  > `Request ID: <request_id>`
  to make user-reported failures correlate with the server trace.
- "Apply to form" button is rendered **only** when `predictions` exists and is non-null.
- No partial-prefill, no modal redesign, no backend behavior change.

---

## 4. Deferred (explicitly NOT in this patch)

- Amazon / sponsored-URL canonicalization (`th=1`, `sspa`, `ref=…` stripping).
- Gemini `responseMimeType: application/json` retry.
- Partial-prediction prefill UI.
- Exposing `analysis_trace` on the wire.

---

## Acceptance checks

- **Exactly one** `[analyze-entity-url-v2] trace` log line per V2 invocation, including pre-parse early errors (invalid URL, SSRF block, DNS failure, auth failure).
- Logged `request_id` matches `response.metadata.request_id` (success) or `response.request_id` (error).
- Telemetry tests are **invariant-focused** (not full-object equality): assert one trace per invocation, `request_id` present and matching the response, `trace.final` set, no disallowed raw fields (`raw_text`, `html`, `markdown`, `prompt`, `prediction_values`, `image_url`, `headers`, full URL).
- Re-running the failing Amazon URL produces either a successful prediction (tolerant parser recovered it) **or** a clean error response with populated trace identifying the failure stage; UI shows the failure message + `Request ID:` line instead of an empty modal.
- All existing V2 tests still pass; new tolerant-parser and trace tests pass.
- `merge.field_winners` in the trace contains only source labels, never values.
- No new Gemini error codes introduced; `GEMINI_INVALID_JSON` and `GEMINI_INVALID_SHAPE` semantics preserved.
