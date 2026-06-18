# Phase 1.5 — Search-only Gemini fallback in main branch (shared helper, tightened skip logic, raw-HTML sentinel)

## Diagnosis (recap)

Root Hair Serum URL fails with `NO_PREDICTIONS`:
```
path: "happy"
direct_fetch:    ok (200, ~1.15 MB)
firecrawl:       ok           ← but produced no gate-passing prediction
gemini:          GEMINI_BAD_RESPONSE
search_fallback: NOT triggered (only wired in fetch_recovery branch)
final:           prediction_source: "none", NO_PREDICTIONS
```

Moxie worked because `direct_fetch` failed → `fetch_recovery` branch → fallback ran. Root Hair Serum's `direct_fetch` succeeded → main `happy/weak_recovery` branch → no fallback wired.

## Goal

Make the search-only Gemini fallback fire on **either** branch whenever V2 would otherwise return no prediction, without duplicating logic, without letting weak Firecrawl block it, and without ever leaking raw HTML into the search-only prompt.

## Skip-reason precedence (final, both reviewers approved)

In order. First match wins:

1. **`prior_prediction_valid`** — `currentMerged !== null` (already covers "Firecrawl/extractor produced something usable and gate-passing")
2. **`primary_gemini_succeeded`** — primary Gemini returned a valid `GeminiRawPrediction`
3. **`gemini_not_configured`**
4. **`budget_exhausted`** — `REQUEST_TOTAL_BUDGET_MS - elapsedMs < SEARCH_FALLBACK_TIMEOUT_MS + SEARCH_FALLBACK_BUDGET_BUFFER_MS`
5. Otherwise → **run fallback**

**`firecrawl_succeeded` is NOT a skip reason.** Rationale: a non-null `extractPredictions` can still be weak or fail the recovery gate; treating "Firecrawl HTTP ok" as success recreates the Root Hair Serum bug. If Firecrawl truly produced a usable prediction it's already in `currentMerged` → caught by rule 1.

## Scope

All changes in `supabase/functions/analyze-entity-url-v2/index.ts` plus tests in `gemini_search_fallback_test.ts`.

### Helper signature

```ts
async function maybeRunGeminiSearchFallback(args: {
  currentMerged: V2Prediction | null;
  primaryGeminiPred: GeminiRawPrediction | null;
  geminiConfigured: boolean;
  elapsedMs: number;
  safeUrl: string;
  evidenceBaseUrl: string;
  extractMetadata: ExtractMetadata;
  usedFirecrawl: boolean;
  mergeFlags: MergeFlags;
  // NOTE: no `html` parameter. Raw HTML is intentionally excluded so it
  // cannot accidentally reach the search-only prompt.
}): Promise<{
  attempted: boolean;
  ok: boolean;
  used: boolean;
  skipReason: string | null;
  error?: GeminiErrorCode;
  durationMs?: number;
  mergedPredictions?: V2Prediction;
  mergeDiag?: MergeDiag;
  geminiPred?: GeminiRawPrediction;
  geminiBlock?: GeminiMetadataBlock;
}>
```

**Raw-HTML guarantee (reviewer-requested):** the helper does NOT accept `html`. It builds its prompt exclusively via the existing `buildSearchOnlyV2Prompts(safeUrl, evidenceBaseUrl, extractMetadata)` from Phase 1 — same path the `fetch_recovery` branch already uses. Internally it calls Gemini with `searchOnly: true`, `tools: [{ google_search: {} }]`, no `url_context`, no `responseMimeType`, 14 s timeout, tolerant parser, Zod validation, recovery gate, existing merge rules.

### Wiring

**Fetch_recovery branch (~651–729):** replace inline block with a call to the helper. Behavior must remain byte-identical (verified by regression test below).

**Main branch (right after the first `applyMerge`, ~line 1023):**

```ts
if (!mainMerged) {
  const fb = await maybeRunGeminiSearchFallback({...});
  if (fb.used) {
    mainMerged = fb.mergedPredictions;
    mainMergeDiag = fb.mergeDiag;
    mainGeminiPred = fb.geminiPred;
    geminiBlock = fb.geminiBlock;
    mainFallbackUsed = true;
  } else if (fb.attempted && fb.error) {
    warnings.push(fb.error); // preserve original GEMINI_BAD_RESPONSE etc.
  }
  // attach telemetry: search_fallback_attempted/ok/skip_reason/duration_ms/error
}
```

### Final source selection (main branch)

```
mainMerged && mainFallbackUsed → "gemini_search_fallback"
mainMerged && usedFirecrawl    → "firecrawl_merge"   (unchanged)
mainMerged                     → "extractor_merge"   (unchanged)
otherwise                      → "none"              (unchanged)
```

`trace.path` stays `"happy"` / `"weak_recovery"`; the `gemini_search_fallback` signal lives on `trace.final.prediction_source`.

## Out of scope

V1, frontend, DB, pricing, Firecrawl config, direct-fetch byte cap, Zod schema, recovery gate, merge rules, Gemini model, `responseMimeType`, parser, save flow, RLS/auth, Phase 2. Reuse existing constants (`SEARCH_FALLBACK_TIMEOUT_MS = 14_000`, `SEARCH_FALLBACK_BUDGET_BUFFER_MS = 1_000`) and existing `buildSearchOnlyV2Prompts` + `sanitizeFallbackEvidenceUrl` from Phase 1.

## Tests (`gemini_search_fallback_test.ts`)

1. **`main_branch_gemini_bad_response_triggers_fallback`** — direct_fetch ok, weak extraction, primary Gemini `GEMINI_BAD_RESPONSE`, fallback ok → `final.prediction_source === "gemini_search_fallback"`.
2. **`main_branch_weak_firecrawl_does_not_block_fallback`** *(critical)* — `extractPredictions !== null` but fails recovery gate so `currentMerged === null`; primary Gemini fails; fallback still runs and succeeds.
3. **`main_branch_fallback_failure_preserves_original_error`** — fallback also fails → `NO_PREDICTIONS`, `warnings` contains original `GEMINI_BAD_RESPONSE`, telemetry shows `search_fallback_attempted: true, ok: false, error: <code>`; no fake success.
4. **`main_branch_primary_gemini_success_skips_fallback`** → `skip_reason: "primary_gemini_succeeded"`.
5. **`main_branch_valid_merged_prediction_skips_fallback`** → `skip_reason: "prior_prediction_valid"`.
6. **`main_branch_budget_exhausted_skips_fallback`** → `skip_reason: "budget_exhausted"`, not attempted.
7. **`recovery_branch_fallback_unchanged`** — Moxie-style `FETCH_TOO_LARGE` path still reaches `gemini_search_fallback` (regression check after helper extraction).
8. **`non_amazon_success_unchanged`** — successful non-Amazon URL still resolves via `extractor_merge` / `firecrawl_merge`.
9. **`search_only_fallback_prompt_contains_no_raw_html`** *(reviewer-requested sentinel)* — inject HTML containing the marker string `__RAW_HTML_SENTINEL_<<<>>>__` into the upstream extraction context, run the helper, capture the outbound Gemini request body, assert the marker does NOT appear anywhere in the prompt parts. Guards against future regressions where someone adds `html` back to the helper signature.

## Retest matrix

For each URL capture: `request_id`, `path`, primary gemini error/success, fallback `attempted/ok/duration_ms/skip_reason`, `final.prediction_source`, `merge.path`, modal visibility, sensible name/brand/description/images.

- Root Hair Serum Amazon URL (the failing one).
- Moxie Beauty Amazon URL (recovery-branch regression).
- A clean `https://www.amazon.in/dp/<ASIN>/`.
- One currently-successful non-Amazon URL.

## Decision

Implement Phase 1.5 with the shared helper, `firecrawl_succeeded` skip reason removed, no `html` parameter on the helper, and the raw-HTML sentinel test. Hold Phase 2 until all 4 retest URLs are green.
