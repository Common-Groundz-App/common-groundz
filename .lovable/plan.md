# Structured Gemini Failure Diagnostics — Final Plan (v2)

Both ChatGPT and Codex approved. Folding in their last clarifications:

1. "No keys" in the hard scope means **no API keys/secrets** — JSON field names (`prediction`, `type`, `name`, Zod paths) are allowed as diagnostic labels.
2. `missing_required_fields` must be derived from the **best parsed candidate** (the one whose Zod issues we're reporting), not only root-level keys, so a wrapped `{ "prediction": { type, name } }` doesn't falsely report `type`/`name` missing.
3. `missing_required_fields` derivation must be **defensive about Zod issue shape** — don't rely solely on `issue.received === "undefined"`; also compare known required field names against the best candidate's keys, and skip (never throw) on unexpected issue shapes.

## Goal

When Gemini fails (e.g. the Amazon shoe-insert URL), the current log shows only `code: GEMINI_INVALID_SHAPE`, `raw_text_length`, `raw_text_sha8`. That's not enough to pick the next fix.

Add a `gemini_failure_diagnostics` object to the **existing Gemini failure log lines only**, telling us *why* it failed without ever logging raw Gemini text, prediction values, URLs, prompts, or HTML.

## Scope (hard)

Touch only:
- `supabase/functions/analyze-entity-url-v2/gemini.ts`
- `supabase/functions/analyze-entity-url-v2/gemini_test.ts`

Do **not** touch: `AnalysisTrace`, `V2SuccessResponse`, `V2ErrorResponse`, frontend modal, V1, DB, pricing, Firecrawl, merge, save flow, Gemini model/tools/prompt/`responseMimeType`, parser candidate list, schema, error codes, Amazon canonicalization, success-path logs.

No `raw_text_preview`, no env-gated raw preview, no model text, no prediction values, no URLs, no image URLs, no headers, no API keys/secrets, no prompts — in logs, trace, or response. JSON field names and Zod path/code strings are allowed as diagnostic labels.

## Design

### 1. Thread parser attempt metadata out of `tolerantParseGeminiJson`

Keeps diagnostics aligned with actual parser behavior; avoids recompute drift.

```ts
type TolerantParseAttempts = {
  parse_candidate_count: number;   // total candidates tried
  parsed_json: boolean;             // any candidate parsed as JSON
  contains_code_fence: boolean;     // raw text had ``` fence
  top_level_keys: string[];         // keys of first parsed root (if any)
  nested_wrapper_keys: string[];    // wrapper key names that produced candidates
  best_candidate_keys: string[];    // keys of the candidate closest to validation
};
```

`best_candidate_keys` = keys of the last parsed candidate that was passed to the Zod validator (i.e. the one whose issues we report). For an unwrapped failure this equals `top_level_keys`; for a wrapped `{ "prediction": {...} }` this is the inner object's keys.

`TolerantParseOutcome` failure variant gains `attempts: TolerantParseAttempts` and `zodIssues?: Array<{ code: string; path: (string|number)[]; received?: unknown }>` from the best candidate's Zod result.

### 2. New helper `geminiFailureDiagnostics`

```ts
function geminiFailureDiagnostics(
  rawText: string,
  attempts: TolerantParseAttempts,
  zodIssues?: Array<{ code: string; path: (string|number)[]; received?: unknown }>,
): Record<string, unknown>
```

Returns only:
- `parse_candidate_count` (number)
- `parsed_json` (boolean)
- `contains_code_fence` (boolean)
- `top_level_keys` (string[])
- `nested_wrapper_keys` (string[])
- `best_candidate_keys` (string[])
- `zod_issue_codes` (string[]) — distinct codes
- `zod_issue_paths` (string[]) — dot-joined path strings
- `missing_required_fields` (string[]) — derived defensively (see below)
- `refusal_like` (boolean) — heuristic: `parsed_json === false` AND trimmed text starts with letter `i`/`s`/`a` AND no balanced `{}` found. Boolean only.

#### `missing_required_fields` derivation (defensive)

1. Known required fields list (hardcoded from schema): `["type", "name"]` (plus any others the Zod schema marks required at top level).
2. Start with the set of required fields **absent from `best_candidate_keys`**.
3. Additionally, walk `zodIssues`: if an issue has `code === "invalid_type"` and either (a) `received === "undefined"`, or (b) `received` is missing/unknown but `path.length === 1`, add `String(path[0])` to the set.
4. Wrap the whole derivation in try/catch — on any unexpected issue shape, skip that issue rather than throwing.
5. Apply caps (below) to the final array.

### 3. Sanitization caps (defensive, applied to every output field)

- Each string ≤ 64 chars (truncate)
- Each array ≤ 12 entries (slice)
- Key/path strings: drop entries whose sanitized form isn't a safe identifier-ish token (`[A-Za-z0-9_.\-\[\]]` only) — protects against weird model-emitted long JSON keys
- Never include values, snippets, or content strings drawn from raw text — only shape keys, Zod enum codes, counts, booleans

### 4. Integration

In `gemini.ts`, the two existing failure log sites (~lines 446–456 and ~473–480) extend their existing `logLine({...})` call with:

```ts
gemini_failure_diagnostics: geminiFailureDiagnostics(text, outcome.attempts, outcome.zodIssues)
```

Success log unchanged. `GeminiFailure` return objects unchanged — diagnostics live only in the log line.

### 5. Tests (`gemini_test.ts`)

- Refusal-like text ("I cannot help with…") → `parsed_json:false`, `refusal_like:true`, empty key arrays
- Valid JSON wrong shape (unwrapped, missing `type`) → `parsed_json:true`, populated `top_level_keys`, `best_candidate_keys === top_level_keys`, `missing_required_fields` includes `"type"`
- Wrapped `{"prediction": { "type": "...", "name": "..." }}` where inner fails on a different field → `nested_wrapper_keys` includes `"prediction"`, `best_candidate_keys` are the inner keys, `missing_required_fields` does **not** spuriously include `type`/`name`
- Code-fenced JSON → `contains_code_fence:true`
- Cap enforcement: 50 top-level keys → array length 12; key > 64 chars → dropped/truncated; non-identifier key → dropped
- **Sentinel leak test**: raw text contains `"SECRET_PRODUCT_VALUE_xyz123"`; assert this sentinel does not appear anywhere in `JSON.stringify(diagnostics)`. Safe key names (`prediction`/`type`/`name`) are allowed.
- Defensive Zod issue: feed a malformed issue object (missing `received`, weird `path`) — diagnostics should not throw and should return a valid object
- Success path: existing success test still passes with no `gemini_failure_diagnostics` key on success log
- Parser attempts wiring: failure outcome carries `attempts` with correct `parse_candidate_count`, `contains_code_fence`, and `best_candidate_keys`

## Acceptance

Re-running the same Amazon URL still returns `NO_PREDICTIONS` with the same modal and Request ID. The `[analyze-entity-url-v2] gemini` failure log line now also carries `gemini_failure_diagnostics`, letting us classify the failure (parser mapping vs prompt nudge vs Firecrawl extraction vs Amazon canonicalization) without ever seeing Gemini's raw output.

After build: I'll show files changed, test results, and a sample failure-log shape, then you re-run the Amazon URL so we can pick the next real fix.

Ready to switch to build mode?
