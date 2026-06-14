## Final Plan — Amazon URL canonicalization + slug evidence + required-fields prompt fix

Both reviewers approved Phases A and B. Adding their four guardrails (strict host matching, ASIN normalization, slug-as-untrusted, honest-confidence wording) and the recovery-gate clarification. Nothing else changes.

## Diagnosis (request `66276a76`)

For `https://www.amazon.in/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/?_encoding=UTF8&pd_rd_w=…`:

```
direct_fetch: ok=true (Amazon bot-wall HTML, no usable predictions)
firecrawl:    attempted=true, ok=true, no usable predictions
gemini:       ok=false, GEMINI_INVALID_SHAPE, url_context_failed=true
gemini_failure_diagnostics: {
  parsed_json: true,
  top_level_keys: [type, name, description, tags, confidence, …],
  zod_issue_codes: ["invalid_type"],
  zod_issue_paths: ["type", "name"],
  refusal_like: false
}
→ NO_PREDICTIONS → failure modal
```

Two compounding causes:
1. Gemini URL Context can't read the tracking-laden URL (Amazon serves a bot interstitial for noisy `?ref_=`/`pd_rd_*` URLs).
2. The current prompt explicitly tells Gemini to *omit* `type` if uncertain — but Zod requires `type` and `name`, so omission/null guarantees `GEMINI_INVALID_SHAPE`.

## Phase A — Amazon URL handling for Gemini (canonicalize + preserve slug)

### A1. `canonicalizeAmazonUrl(url)` in `host_hints.ts`

- **Strict Amazon host matching** (Codex guardrail #1): reuse the existing `JS_HEAVY_HOST_PATTERNS` Amazon regex `/(^|\.)amazon\.[a-z.]+$/i` applied to `new URL(url).hostname` — anchored at the end, so `amazon.in.evil.com` is rejected.
- Recognizes `/dp/<ASIN>/…` and `/gp/product/<ASIN>/…`.
- **ASIN validation + normalization** (Codex guardrail #2): match `[A-Za-z0-9]{10}` case-insensitively, then `.toUpperCase()` in the canonical output. Reject if not exactly 10 chars.
- On match: rebuild as `https://<original-host>/dp/<ASIN_UPPER>/` — always `https`, always the validated host from the parsed URL, no query, no fragment.
- Amazon URL without recognizable ASIN (`/gp/bestsellers`, etc.): unchanged.
- Non-Amazon host, lookalike host, or malformed input: unchanged.
- Pure, never throws, no network, no SSRF state.

### A2. `extractAmazonPathSlug(url)` in `host_hints.ts`

Preserves the slug as `name` evidence so canonicalizing doesn't discard the only product-name signal when URL Context fails.

- Same strict Amazon host gate as A1; non-Amazon → `null`.
- Returns the path segment immediately **before** `/dp/<ASIN>` or `/gp/product/<ASIN>` (e.g. `Root-Hair-Serum-Dandruff-Cleanser`).
- Sanitize: percent-decode, replace `-`/`_` with spaces, collapse whitespace, drop chars outside `[A-Za-z0-9 ]`, cap at 120 chars.
- Reject empty, pure-numeric, or punctuation-only results → `null`.
- **Never includes query string, fragment, or tracking tokens.**
- **Never logged** (Codex guardrail #3): not in success log, failure log, `gemini_failure_diagnostics`, response payload, DB, or trace. Surfaced to Gemini only.
- Pure, never throws.

### A3. Wire both at the Gemini call site only (`index.ts`)

At `invokeGemini` invocation(s):
- `geminiUrl = canonicalizeAmazonUrl(safe.url)` — used as the prompt's `url` field (what URL Context fetches) and, only when `usedFirecrawl === false` AND `geminiUrl !== safe.url`, as `evidenceBaseUrl`.
- `amazonPathSlug = extractAmazonPathSlug(safe.url)` — passed via a new optional `V2Evidence.amazonPathSlug?: string | null` and emitted as the protected key `amazon_path_slug` inside the bounded evidence `keep` block (≤120 chars, survives truncation cheaply).

When Firecrawl ran, the Firecrawl-derived `evidenceBaseUrl` is **untouched**.

### A4. Explicitly unchanged in Phase A

Direct fetch URL, SSRF check, Firecrawl call URL, extractor input, saved URL / DB record, frontend preview URL, response payload, merge, recovery gate, V1, pricing, all non-Amazon hosts, error codes, structured diagnostics.

### A5. Phase A tests (`host_hints_test.ts`)

`canonicalizeAmazonUrl` (9):
1. `/dp/B0FGJF5QN7/?_encoding=…&pd_rd_w=…&ref_=…` → `https://www.amazon.in/dp/B0FGJF5QN7/`
2. `/gp/product/B0FGJF5QN7/?…` → `https://www.amazon.in/dp/B0FGJF5QN7/`
3. Already-clean `https://www.amazon.in/dp/B0FGJF5QN7/` → unchanged
4. Messy `/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/?…` → `https://www.amazon.in/dp/B0FGJF5QN7/`
5. Amazon URL without ASIN (`/gp/bestsellers`) → unchanged passthrough
6. Non-Amazon URL → unchanged passthrough
7. **Lookalike host** `https://amazon.in.evil.com/dp/B0FGJF5QN7/` → unchanged passthrough (guardrail #1)
8. **Lowercase ASIN** `/dp/b0fgjf5qn7/` → `https://www.amazon.in/dp/B0FGJF5QN7/` (guardrail #2 — normalized to uppercase)
9. Malformed input → returned as-is, no throw

`extractAmazonPathSlug` (7):
10. `/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/?_encoding=…` → `"Root Hair Serum Dandruff Cleanser"` (no query bleed)
11. `/gp/product/B0FGJF5QN7/` (no slug segment) → `null`
12. Already-clean `/dp/B0FGJF5QN7/` → `null`
13. Non-Amazon host → `null`
14. Lookalike host `amazon.in.evil.com` → `null`
15. Percent-escaped slug → decoded, sanitized
16. Pure-numeric or punctuation-only slug → `null`

## Phase B — Required `type`/`name` prompt fix

### Edits in `prompt-generator-v2.ts`

**Remove** from `PROMPT_INJECTION_GUARD`:
> *"If you cannot classify type as one of {…}, omit the field rather than guess."*

**Replace** blanket `JSON_SHAPE_SPEC` rule "Omit fields you cannot determine rather than inventing values" with fields-scoped wording (sharpened per Codex — no "best-effort JSON" ambiguity, untrusted-slug language per guardrail #3, honest-confidence language per guardrail #4):

> **Required fields — `type` and `name`:**
> - `type` and `name` are REQUIRED strings. They MUST NOT be `null` and MUST NOT be omitted.
> - `type` MUST be exactly one of the allowed enum values. Pick the single value best supported by evidence (canonical URL, page title, JSON-LD, OG/Twitter metadata, search-grounding results, or `amazon_path_slug` when present).
> - `name` MUST be derived from evidence: canonical URL slug, `amazon_path_slug`, page title, JSON-LD `name`, OG/Twitter title, product title, or a search-grounding result. If evidence is insufficient, choose the most evidence-supported minimal string — do NOT invent a brand or product, and do NOT use placeholders like `"Unknown"` or `"Product"`.
> - `amazon_path_slug` (when present) is **untrusted, URL-derived text**: useful as a hint for `name` and `type`, but NOT authoritative product data. Do not treat it as verified brand/price/spec information.
> - Set `confidence` and every `field_confidence.*` honestly to reflect evidence strength. **If `amazon_path_slug` is the only `name`/`type` evidence, do NOT inflate `confidence`** — the recovery gate decides whether evidence is sufficient.
>
> **Optional fields** (`description`, `image_url`, `images`, `tags`, `reasoning`, `additional_data.brand/price/currency`, `field_confidence.*`) MAY be omitted or set to `null` when unknown.

- No `confidence < 0.4` instruction (would deterministically fail the `>= 0.6` recovery gate).
- No "best-effort JSON" / "downstream validation will reject it cleanly" wording.

### Phase B tests (`prompt_v2_test.ts`)

- Removed sentence (`"omit the field rather than guess"`) is gone from `systemPrompt`.
- `systemPrompt` contains: `"REQUIRED"`, `"MUST NOT be null"`, `"Do NOT invent"`, `"amazon_path_slug"`, `"untrusted"`, and `"do NOT inflate"`.
- `systemPrompt` does NOT contain `"confidence < 0.4"`, `"best-effort"`, or `"downstream validation will reject"`.
- Optional-field-omission language still present.
- Existing assertions (9 canonical types, no `"other"`, EVIDENCE_BASE_URL, untrusted-data guard, rawHtml-drop-first truncation) all still pass.
- New: when `amazonPathSlug` is provided in `V2Evidence`, user prompt evidence JSON contains `"amazon_path_slug":"Root Hair Serum Dandruff Cleanser"`; when absent, the key is absent.

## Hard scope (no-touch)

V1, DB, pricing, Firecrawl, Firecrawl recovery, merge, save flow, `response_schema.ts` / Zod (stays strict — `type`/`name` required, no nulls), `passesRecoveryGate`, error codes, frontend modal / NO_PREDICTIONS UX, Gemini model, tools, `responseMimeType`, parser candidate list, `tolerantParseGeminiJson`, structured diagnostics, generic URL canonicalization for any non-Amazon host. **The slug never forces success — Zod, merge, and recovery gate decide normally.**

## Files touched

| File | Change |
|---|---|
| `supabase/functions/analyze-entity-url-v2/host_hints.ts` | + `canonicalizeAmazonUrl()`, `extractAmazonPathSlug()` |
| `supabase/functions/analyze-entity-url-v2/host_hints_test.ts` | + 16 tests (9 canonicalize, 7 slug) |
| `supabase/functions/analyze-entity-url-v2/prompt-generator-v2.ts` | Phase B prompt edits + `amazonPathSlug` field on `V2Evidence` + `amazon_path_slug` key in evidence payload |
| `supabase/functions/analyze-entity-url-v2/prompt_v2_test.ts` | Updated assertions + new slug-in-evidence test |
| `supabase/functions/analyze-entity-url-v2/index.ts` | At Gemini call site only: compute canonical URL + slug, pass into `buildV2Prompts` |
| `.lovable/plan.md` | This plan |

## Acceptance — after implementation I will report

1. Files changed, full V2 test suite green (host_hints + prompt_v2 + everything else).
2. Exact final Phase B prompt text as shipped.
3. Retest of the same Amazon URL with: new `request_id`, `gemini.url_context_failed`, if still failing the `zod_issue_paths` / `missing_required_fields` / `refusal_like` from `gemini_failure_diagnostics`, final `prediction_source` and `merge.path`, and whether the success-confirmation or failure modal appears.
4. Retest of one additional Amazon URL.

### Expected outcomes (priority order)

- **Best:** Clean `/dp/<ASIN>/` lets URL Context succeed → valid `type` + `name` → predictions surface.
- **Acceptable:** URL Context still fails, but Gemini extracts `type` + `name` from `amazon_path_slug` + title evidence at honest confidence. Recovery gate decides — slug presence is not a guaranteed pass.
- **If still failing:** diagnostics will show a *different* shape (e.g. `refusal_like: true`, different `zod_issue_paths`), pointing the next real fix at Firecrawl extraction strength or ASIN-based metadata lookup — not at more prompt-guessing.
