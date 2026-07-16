# Fix `search-entity-candidates` — final approved plan

Both codex and chatgpt approved the previous plan. Two refinements folded in:
1. **No minimum candidate count** (codex) — for very specific queries, forcing "minimum 2" makes the model invent weak variants.
2. **Wording** (chatgpt) — don't say `gemini-3.5-flash` is "unsupported." Say it is documented but consistently times out on our current `generateContent + google_search` path, so we're mirroring the proven working sibling functions (`smart-assistant` webFallbackSearch, `analyze-entity-url-v2/gemini.ts`) that use `gemini-1.5-flash`. The `GEMINI_GROUNDED_MODEL` env override remains for future A/B testing of newer models.

Verified upstream constraint (Google AI Developer Forum, Mar + Jul 2025; `googleapis/python-genai#665`): `responseMimeType: "application/json"` and `responseSchema` combined with `google_search` grounding still return HTTP 400 "Search Grounding can't be used with JSON/YAML/XML mode." So Gemini's earlier "critical fix" suggesting we add `responseSchema` is rejected — we keep prompt-discipline + tolerant `extractJsonObject` parsing.

## Changes

### File 1 — `supabase/functions/search-entity-candidates/index.ts`

**A. Model default → `gemini-1.5-flash`** (line 39)
```ts
const DEFAULT_GEMINI_GROUNDED_MODEL = "gemini-1.5-flash";
```
Keep `GEMINI_GROUNDED_MODEL` env override.

**B. Timeout default → 20_000 ms** (line 40)
```ts
const GEMINI_TIMEOUT_MS = Number(Deno.env.get("GEMINI_TIMEOUT_MS")) || 20_000;
```
Keep `GEMINI_TIMEOUT_MS` env override.

**C. Add generation budget** (lines 393-398)
```ts
generationConfig: {
  temperature: 0.2,
  maxOutputTokens: 1200,
  candidateCount: 1,
  // responseMimeType/responseSchema INTENTIONALLY OMITTED — Google REST returns
  // 400 "Search Grounding can't be used with JSON/YAML/XML mode" when combined
  // with tools: [{ google_search: {} }]. We rely on prompt discipline +
  // extractJsonObject() for tolerant parsing (same pattern as smart-assistant
  // webFallbackSearch and analyze-entity-url-v2).
},
```

**D. Trim prompt** (lines 369-388)
- Change "Return 4–5" to: `"Return up to 5 distinct real-world entity candidates the user likely means.\nReturn fewer if only fewer are strongly supported by grounded results.\nDo not invent extra variants just to fill the list."` (no minimum count).
- Remove `category` and `sourceTitle` from the requested schema block. `coerceCandidate` already tolerates them if the model returns them anyway. Requested schema becomes:
  ```
  { "candidates": [{
    "name": string,
    "type": "product|brand|place|book|movie|food|app|tv",
    "brand": string|null, "variant": string|null,
    "description": string, "imageUrl": string|null,
    "sourceUrl": string, "confidence": number
  }] }
  ```

**E. Header comment block** (lines 1-20)
Rewrite to say: "This function mirrors the proven-working grounded-search pattern in `smart-assistant/index.ts` webFallbackSearch and `analyze-entity-url-v2/gemini.ts`. It calls Google's public `generateContent` REST endpoint with `tools: [{ google_search: {} }]` on `gemini-1.5-flash`. Newer models (`gemini-2.5-flash`, `gemini-3.5-flash`) are documented for grounding but consistently timed out on this path in our deployment — swap via `GEMINI_GROUNDED_MODEL` env for A/B testing. `responseMimeType`/`responseSchema` are intentionally not set: Google returns 400 with grounding enabled."

**F. Improved diagnostics** (lines 428-441 and 468-478)
- On timeout/abort — log: `{ model, timeoutMs: GEMINI_TIMEOUT_MS, latencyMs, errorCode: "timeout", isAbort: true }`. Never log the raw query, prompt, generated text, or grounding HTML.
- On `parse_failed` — log: `{ model, latencyMs, textOutLength: textOut.length, hasSearchEntryPoint: !!renderedContent, errorCode: "parse_failed" }` (length only, not content).

**G. Cosmetic: drop `c?.web?.url` fallback** (line 458)
```ts
const uri = c?.web?.uri || "";
```

### File 2 — `src/components/admin/CreateEntityDialog.tsx`

Wire the Search-to-Draft citation URL into the pre-insert duplicate check:
- Compute `const fromSearch = Boolean(aiPredictions?.__fromSearch);`
- Compute `const searchSourceUrl = fromSearch ? (aiPredictions?.searchSourceUrl ?? aiPredictions?.metadata?.search_source_url ?? null) : null;`
- Add `sourceUrl: searchSourceUrl` to the `check-entity-duplicates` request body.
- Do NOT write `searchSourceUrl` into `website_url` or `metadata.created_from_url`. Keep it only in `metadata.search_source_url` (already stamped elsewhere).

`check-entity-duplicates` already accepts `sourceUrl` — no server-side change needed.

### Env verification

Confirm the deployed environment does not pin stale values:
- `GEMINI_GROUNDED_MODEL` — unset (or explicitly `gemini-1.5-flash`).
- `GEMINI_TIMEOUT_MS` — unset (or `20000`).

If either is pinned to an old value, unset it so the new code defaults apply.

### Redeploy

Deploy `search-entity-candidates` (Lovable auto-deploys). Confirm `log-search-funnel` and `enrich-candidate-image` are still non-404 (they should be — no code changes there, this is just a sanity check after the previous phase).

## Intentionally NOT changed
- No `responseSchema` / `responseMimeType` — verified 400 with grounding.
- No transport swap (no Interactions API, no Lovable AI Gateway).
- No API key change — `smart-assistant` proves current key has grounding entitlement.
- No dedup, cache, funnel-hook, recents, or migration changes.
- No UI copy change in `SearchEntryPanel.tsx`.

## Manual verification

Test queries: `cetaphil gentle cleanser`, `loreal absolut repair shampoo`, `cosrx snail mucin`.

From edge logs, expect per call:
- `diagnostics.model = "gemini-1.5-flash"`
- `diagnostics.latencyMs` — 5-15s healthy
- `candidates.length` — 1-5 (may be 1 for very specific queries; that's now correct behavior)
- `groundingSources.length > 0`
- `diagnostics.errorCode` — absent

Re-run the same query → `diagnostics.cached = true`.

## Decision tree if it still fails
- All three still `errorCode: "timeout"` at ~20s → grounding subsystem itself is the issue; escalate to Phase 3.5d (test alternate transport / Interactions API).
- `parse_failed` with non-zero `textOutLength` → Google responded; tighten prompt further, no infra change.
- HTTP 4xx logged → read the body — we now have real diagnostics instead of a silent hang.
