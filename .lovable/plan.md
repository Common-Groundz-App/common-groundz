## What the logs show

`search-entity-candidates` is no longer failing at the Gemini API layer. Recent calls show:

- `model: "gemini-2.5-flash"`
- `hasSearchEntryPoint: true`
- `groundingSources: 4` on one call
- `renderedContentLength: ~5.3k`
- `errorCode: "parse_failed"`
- `candidates: 0`

So Gemini is returning grounded content, but our function can't extract a valid `{ candidates: [...] }` JSON object from the response text. The UI receives zero candidates, which looks like "nothing is working."

## Root cause

Two stacked issues, in likely order of impact:

1. **Output budget too small.** `maxOutputTokens: 1200` is likely truncating grounded JSON mid-object. One failing call had `textOutLength: 4169` — consistent with a truncated response. Truncated output makes the balanced-brace parser return `null`.
2. **Parser is too strict.** It only tries the *first* balanced `{ ... }` block. If Gemini emits any pre-JSON text, a small non-candidates object, or a top-level array, parsing fails permanently.

We currently have no `finishReason` in logs, so we can't confirm truncation vs. malformed shape. That's the biggest blind spot.

## Plan (search function only)

Single file: `supabase/functions/search-entity-candidates/index.ts`. No frontend, DB, or other-function changes.

### 1. Bigger, tunable output budget

Add a constant with env override, default `4096` (not `8192` — 8192 adds latency/cost and encourages verbose output; we only need 1–5 compact candidates):

```ts
const GEMINI_MAX_OUTPUT_TOKENS =
  Number(Deno.env.get("GEMINI_MAX_OUTPUT_TOKENS")) || 4096;
```

Update `generationConfig`:

```ts
generationConfig: {
  temperature: 0.2,
  maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  candidateCount: 1,
  // responseMimeType / responseSchema INTENTIONALLY OMITTED — incompatible
  // with tools: [{ google_search: {} }] (Google returns 400).
}
```

If diagnostics later show `finishReason: "MAX_TOKENS"` at 4096, we raise `GEMINI_MAX_OUTPUT_TOKENS=8192` via env, no code change needed.

### 2. Add `finishReason` diagnostics (safe)

Read `raw?.candidates?.[0]?.finishReason` after the Gemini response. Include it in both the success log and the `parse_failed` warning log, alongside existing safe fields:

- `model`
- `latencyMs`
- `finishReason`
- `textOutLength`
- `hasSearchEntryPoint`
- `groundingSources.length`
- `errorCode`

Never log raw query, prompt, generated text, full URLs, or `renderedContent`.

### 3. Harden `extractJsonObject`

Behavior:
1. Strip markdown fences.
2. Try `JSON.parse` on the whole trimmed string first.
3. If the parsed result is an **array**, return `{ candidates: parsed }`.
4. If it's an **object with `candidates: []`**, return it.
5. Otherwise, scan every balanced `{ ... }` block and return the first parsed object where `Array.isArray(obj.candidates)` — not just the first parseable block.
6. As a last resort, scan every balanced `[ ... ]` block and wrap the first parsed array as `{ candidates: array }`.
7. Never log raw model text.

### 4. Compact, stricter prompt

Tighten the prompt to reduce truncation risk and stray prose:

- "Return exactly one compact JSON object. No markdown, no prose, no source list outside JSON."
- "If nothing is strongly supported, return `{\"candidates\":[]}`."

Requested schema stays the same 8 fields (`name, type, brand, variant, description, imageUrl, sourceUrl, confidence`). `coerceCandidate` remains tolerant of optional `category` / `sourceTitle` if Gemini returns them.

### 5. Keep everything else as-is

- Model: `gemini-2.5-flash` (env override remains).
- Timeout: `20_000ms`.
- No `responseMimeType` / `responseSchema` (grounding + JSON mode = 400).
- Existing `coerceCandidate`, `conservativeDedup`, cache, rate limit, admin gating: unchanged.

### 6. Deploy and verify

Deploy only `search-entity-candidates`. Test:
- `cetaphil gentle cleanser`
- `loreal absolut repair shampoo`
- `cosrx snail mucin`

Expected in logs:
- `model: "gemini-2.5-flash"`
- `finishReason: "STOP"` (ideal)
- `candidates`: 1–5
- `groundingSources > 0`
- No `parse_failed`
- `latencyMs`: 3–15s

Decision tree if still failing:
- `finishReason: "MAX_TOKENS"` → set `GEMINI_MAX_OUTPUT_TOKENS=8192` in env, retest.
- `finishReason: "STOP"` + `parse_failed` → parser/prompt still need tightening (log `textOutLength` and inspect prompt).
- HTTP 400 → someone re-added JSON mode; revert.
- HTTP 404 → model id changed.
- Timeout at ~20s across all 3 → escalate transport (out of scope).

## Not changing

- No frontend changes (`SearchEntryPanel.tsx`, `CreateEntityDialog.tsx`).
- No DB / migration changes.
- No changes to `smart-assistant`, `analyze-entity-url-v2`, or any other function.
- No API key / transport swap.
- No reversion to `gemini-1.5-flash` (retired on v1beta).