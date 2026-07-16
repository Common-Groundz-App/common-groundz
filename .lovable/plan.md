# Fix: search-entity-candidates returns 0 candidates (Gemini 404)

## Root cause (from edge logs)

Every call to `search-entity-candidates` fails with the exact same upstream error:

```
Gemini HTTP 404: models/gemini-1.5-flash is not found for API version v1beta,
or is not supported for generateContent.
```

Latency ~350ms–1.3s, then `errorCode: "grounding_unavailable"`, `candidates: 0`. That is why every search you tried returns no web results.

Google retired the `gemini-1.5-*` family on the public `v1beta/generativelanguage.googleapis.com` endpoint. Our previous plan pinned `gemini-1.5-flash` as the "proven working" default because sibling functions used it — but those siblings are almost certainly failing silently too (same URL, same key, same API version). The model literally does not exist on this endpoint anymore.

The fix is a model swap to a currently-supported grounded-search model. No transport / prompt / schema / architecture change.

## Change (single file)

**`supabase/functions/search-entity-candidates/index.ts`** — line 45:

```ts
const DEFAULT_GEMINI_GROUNDED_MODEL = "gemini-2.5-flash";
```

`gemini-2.5-flash` is currently listed by Google as GA on `v1beta/models/...:generateContent` and supports `tools: [{ google_search: {} }]` grounding. The `GEMINI_GROUNDED_MODEL` env override remains, so we can A/B swap to `gemini-2.0-flash` or a newer id later without a code change.

Also update the header comment block (lines 1–20) to stop calling `gemini-1.5-flash` the "proven-working" model — it's retired. New comment: "Uses `gemini-2.5-flash` on Google's public `v1beta` generateContent endpoint with `tools: [{ google_search: {} }]`. `gemini-1.5-flash` was removed from this endpoint (HTTP 404). Swap via `GEMINI_GROUNDED_MODEL` env if Google publishes a newer grounded-search model."

Everything else stays as-is:
- Timeout: 20_000 ms
- `generationConfig`: `temperature: 0.2, maxOutputTokens: 1200, candidateCount: 1`
- No `responseMimeType` / `responseSchema` (still incompatible with grounding).
- Prompt, schema, `extractJsonObject` parser, diagnostics, duplicate-check wiring — unchanged.

## Not changed
- No change to `smart-assistant`, `analyze-entity-url-v2/gemini.ts`, or any other function in this fix. Those likely have the same 404, but the user's request is search — we fix search only. Once search is confirmed green, we can do a follow-up pass to migrate the other call sites.
- No transport swap (still Google REST direct, not Lovable AI Gateway).
- No API-key change.
- No client (`CreateEntityDialog.tsx`, `SearchEntryPanel.tsx`) change.
- No migration, cache, funnel, recents, or UI-copy change.

## Verification after deploy

Search `cetaphil gentle cleanser`, `loreal absolut repair shampoo`, `cosrx snail mucin`. In `search-entity-candidates` logs, expect per call:
- `diagnostics.model = "gemini-2.5-flash"`
- `candidates` 1–5
- `groundingSources > 0`
- No `Gemini HTTP 404` warning line
- `latencyMs` 3–15s

If instead we see:
- `HTTP 404` again → the id changed; try `gemini-2.0-flash` via env override.
- `HTTP 400 "Search Grounding can't be used with ..."` → someone re-added `responseSchema`; revert.
- `errorCode: "timeout"` at ~20s across all 3 → grounding subsystem itself is slow; raise timeout or move to alternate transport (out of scope for this fix).
