## Goal

Add a last-resort **Gemini search-only fallback** to V2 that mirrors V1's working behavior on hostile-to-scrape hosts (Amazon and any other URL where the page-reading path fails), while preserving every V2 guarantee: SSRF safety, strict Zod schema, recovery gate, merge rules, pricing, and the no-hallucination contract.

Applies to **all URLs**, not Amazon-only. Trigger conditions are strict enough that the fallback runs only when V2 would otherwise return failure.

## Verified from current code

- `gemini.ts` currently uses `tools: [{ url_context: {} }, { google_search: {} }]` and does **not** set `responseMimeType`. Fallback reuses this exact config and changes only `tools`.
- `prediction_source` is a free-form `string` in `schema.ts` / `index.ts` (no Zod enum, no DB enum). Adding `"gemini_search_fallback"` is schema-safe.
- `diagnostics` already exists on V2 responses (`prediction_source`, `used_url_context`, `used_google_search`, `url_context_failed`). New fields are additive to that same object — no new envelope.
- No existing feature flag for this path → the `"disabled"` skip reason is **removed**.

## Trigger conditions (ALL must be true — last resort)

1. On the recovery path (not happy-path direct extraction success).
2. Direct fetch / deterministic extraction did not produce a gate-passing prediction.
3. Firecrawl recovery did not produce a gate-passing prediction.
4. Primary Gemini call (`url_context` + `google_search`) threw, returned no text, failed parsing, failed Zod, or failed the recovery gate.
5. No prior step has already produced a valid, gate-passing prediction.
6. Sufficient time budget remains (see "Budget rule" below).

If any condition fails → fallback is skipped with the first matching `skip_reason` from the precedence list.

## Skip-reason precedence (deterministic)

Evaluated top-down; the first matching reason wins so logs/tests are stable:

1. `prior_prediction_valid`
2. `not_recovery_path`
3. `firecrawl_succeeded`
4. `primary_gemini_succeeded`
5. `budget_exhausted`
6. `null` (fallback ran)

(`"disabled"` is intentionally not included — no flag exists.)

## Budget rule (concrete)

- `SEARCH_FALLBACK_TIMEOUT_MS = 8000` (fixed per-call cap for the fallback).
- `SEARCH_FALLBACK_BUDGET_BUFFER_MS = 1000`.
- Compute `remainingMs = requestDeadline - now()`.
- Skip with `skip_reason: "budget_exhausted"` if `remainingMs < SEARCH_FALLBACK_TIMEOUT_MS + SEARCH_FALLBACK_BUDGET_BUFFER_MS` (i.e. `< 9000ms`).
- The fallback call itself is aborted at `SEARCH_FALLBACK_TIMEOUT_MS`.

## The search-only call

- **Tools:** `[{ google_search: {} }]` only. No `url_context`. This is the **only** difference from the primary Gemini call.
- Same model, temperature/topP/topK/maxOutputTokens, headers, retry policy, tolerant parser, Zod schema, recovery gate, merge logic, pricing pass.
- **No `responseMimeType` introduced.**
- **Prompt:** reuse V2 Phase B `systemPrompt` and `userPrompt` unchanged — keeps untrusted-data framing, "do NOT inflate", required `type`/`name`, and the sanitized `amazon_path_slug` evidence block when present. Slug remains untrusted plain-text evidence.

## Failure handling

- On fallback **success**: `prediction_source = "gemini_search_fallback"`, `merge.path` appended with `"gemini_search_fallback"`, diagnostics populated.
- On fallback **failure**: return the **original recovery error unchanged** (do not swallow or replace it). Telemetry still records `gemini_search_fallback_attempted: true`, `gemini_search_fallback_ok: false`, `gemini_search_fallback_error`, `gemini_search_fallback_duration_ms`. Observability is preserved even though the user-facing error is the original one.

## Source labeling

Public `prediction_source` value when this path wins: `"gemini_search_fallback"`. Schema-safe (string, no enum). `merge.path` appended for trace consistency.

## Telemetry

### Server log (full, sanitized)
Added to the existing structured log line:
- `gemini_primary_attempted`, `gemini_primary_ok`, `gemini_primary_error`
- `gemini_search_fallback_attempted`, `gemini_search_fallback_ok`, `gemini_search_fallback_error`
- `gemini_search_fallback_duration_ms`
- `gemini_search_fallback_skip_reason` (one of the precedence values or `null`)
- `final_prediction_source`

Existing `url_context_failed` preserved unchanged.

### Response `diagnostics` (additive, sanitized)
Added to the **existing** `diagnostics` object only:
- `gemini_search_fallback_attempted`
- `gemini_search_fallback_ok`
- `gemini_search_fallback_skip_reason`
- `final_prediction_source`

**Never in the response:** raw model text, prompt text, full URL/query params, `amazon_path_slug` contents, image URLs, headers, HTML/markdown, error stacks. Error codes are short tokens only (e.g. `"GEMINI_BAD_RESPONSE"`, `"ZOD_INVALID"`, `"TIMEOUT"`).

## Guardrails (unchanged)

- Required `type`, required `name`, confidence gate, Zod schema, parser candidates, merge rules, recovery gate, slug sanitization.
- Fallback runs **at most once** per request.
- Respects overall request deadline (budget rule above).
- Applies to **all URLs** — gated purely by the strict trigger conditions.

## Out of scope (do not touch)

V1 (`analyze-entity-url`), DB schema, pricing logic, Firecrawl config, direct-fetch logic, safe-fetch byte cap, recovery gate thresholds, Zod schema (`response_schema.ts`, `schema.ts` validation), merge rules, frontend modal, Gemini model name, `responseMimeType` (not adding it), parser candidate ordering, save flow, RLS, auth.

## Technical changes

### `supabase/functions/analyze-entity-url-v2/gemini.ts`
- New export `callGeminiSearchOnly(args)` reusing the existing request builder; overrides only `tools` → `[{ google_search: {} }]`. Accepts an `abortSignal` for the 8 s timeout.
- Reuses the same response parser and grounding extractor.

### `supabase/functions/analyze-entity-url-v2/index.ts`
- After the existing primary-Gemini recovery branch, add one gated `if` block:
  - Evaluate the six trigger conditions in precedence order; record `skip_reason` accordingly.
  - If eligible, compute `remainingMs`; skip with `budget_exhausted` if insufficient.
  - Otherwise invoke `callGeminiSearchOnly` with an 8 s `AbortController`.
  - On success: set source label, append merge path, populate diagnostics.
  - On failure: keep original recovery error; populate fallback telemetry fields.

### `supabase/functions/analyze-entity-url-v2/schema.ts`
- Extend the existing `diagnostics` TypeScript type with new optional fields. No Zod schema changes.

## Tests

New cases in existing test files (no new harness):

1. Happy path → fallback NOT called; `skip_reason: "prior_prediction_valid"`.
2. Firecrawl succeeds → `skip_reason: "firecrawl_succeeded"`.
3. Primary Gemini succeeds → `skip_reason: "primary_gemini_succeeded"`.
4. Full recovery failure → fallback runs, returns valid JSON, passes Zod + gate, `prediction_source === "gemini_search_fallback"`, `merge.path` includes it.
5. Fallback invalid (null `type` / low confidence) → original recovery error returned; telemetry records `attempted: true, ok: false, error: ...`.
6. Non-Amazon URL hitting fallback conditions → fallback runs (proves not Amazon-gated).
7. Non-Amazon happy path → fallback not called.
8. Malicious slug regression → sanitized slug stays untrusted in fallback prompt; never echoed into system prompt.
9. Budget exhausted (simulated `remainingMs < 9000`) → `skip_reason: "budget_exhausted"`; fallback never invoked.
10. Skip-reason precedence → when multiple reasons are true (e.g. happy path), the first in the precedence list is recorded.
11. Config parity → fallback request body equals primary body **except** `tools`; asserts no `responseMimeType` added.
12. V1 untouched → no file changes under `supabase/functions/analyze-entity-url`.
13. Diagnostics shape → response `diagnostics` contains only the additive sanitized fields; never contains raw text / prompt / slug / image URLs / full query params / stacks.

All existing V2 tests must continue to pass.

## Acceptance — retest matrix

For each URL, capture: `request_id`, primary Gemini attempted/ok, fallback attempted/ok/skip_reason, `final_prediction_source`, `merge.path`, modal renders, reasonableness of name/brand/description/images.

| URL | Expected |
|---|---|
| Moxie Beauty Amazon URL (current failure) | Fallback runs, valid product, modal shows |
| Root Hair Serum Amazon URL (earlier failure) | Fallback runs, valid product, modal shows |
| Clean `https://www.amazon.in/dp/<ASIN>/` | Primary path likely succeeds; if not, fallback succeeds |
| Non-Amazon URL (Nykaa or Goodreads) | Primary path succeeds, fallback NOT called, behavior identical to today |

## Rollout sequence

This is the single next change. Firecrawl extraction improvements and byte-cap changes remain deferred until after retest.

## Deliverables

- `gemini.ts`: `callGeminiSearchOnly` helper (config parity, only `tools` differs, 8 s abort).
- `index.ts`: gated fallback step with precedence + budget rule + telemetry plumbing.
- `schema.ts`: additive diagnostics type fields.
- New tests covering the 13 cases above.
- Updated `.lovable/plan.md`.
- Retest results for the four URLs in the acceptance matrix.