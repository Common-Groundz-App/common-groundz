## Goal
Fix the V2 URL analysis failure for the Nykaa product URL. Logs confirm Phase 6 is wired correctly and Firecrawl is being invoked; it just times out at the current 12s budget for JS-heavy hosts like Nykaa.

## Root cause (confirmed by logs)
- Direct safe-fetch → `FETCH_BAD_STATUS`
- `firecrawl_configured: true`, `priority: "high"`
- Firecrawl branch entered (fetch recovery)
- `FIRECRAWL_TIMEOUT` after ~12009ms
- V2 correctly returned the original fetch error under the strict Phase 6 contract

Not a secret issue, not a deploy-staleness issue, not a Phase 6 wiring bug, not a credits/auth issue.

## Changes

### 1. `supabase/functions/analyze-entity-url-v2/firecrawl.ts`
- Add explicit constants:
  - `NORMAL_FIRECRAWL_API_TIMEOUT_MS = 12_000`
  - `NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS = 12_000` (existing default; unchanged)
  - `HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS = 30_000`
  - `HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS = 32_000`
- Extend `FirecrawlOpts` to accept an `apiTimeoutMs` (sent in the Firecrawl request body as `timeout`) in addition to the existing local `timeoutMs` (AbortController).
- **ALWAYS send `timeout` in the Firecrawl request body** — no ambiguity. Normal callers get `timeout: 12000`, high-priority callers get `timeout: 30000`.
- Default (no opts) behavior: normal API timeout 12_000 in body, local abort 12_000.
- High-priority callers: API `timeout: 30000` in body, local abort 32_000 (local strictly larger than API so Firecrawl can return a structured response before local abort fires).

### 2. `supabase/functions/analyze-entity-url-v2/index.ts`
- When `priority === "high"` (already derived from `isKnownJsHeavyHost(safe.url)` — Nykaa is already in `host_hints.ts`), pass the high-priority timeout options into `runFirecrawlScrape()` at BOTH call sites:
  - fetch-failure recovery branch
  - weak-signals recovery branch
- Normal hosts keep the existing 12s behavior (now with explicit `timeout: 12000` in the request body).
- Preserve the strict Phase 6 fallback contract unchanged: only convert to 200 success when Firecrawl returns HTML AND `extractFromHtml()` produces `predictions !== null`. Otherwise return the original fetch error.
- **Keep the 3 diagnostic logs in place** through the Nykaa validation run. They will be cleaned up in a separate follow-up patch after validation.

### 3. `supabase/functions/analyze-entity-url-v2/firecrawl_test.ts`
- Add tests asserting the exact `timeout` field is present in the request body:
  - Default/normal request body includes `timeout: 12000`.
  - High-priority request body (via `apiTimeoutMs: 30000`) includes `timeout: 30000`.
- Add a test that the local AbortController honors a configured local timeout (hanging fetch → `FIRECRAWL_TIMEOUT`).
- Existing error-code mapping tests (402, 5xx, malformed JSON, oversize HTML, missing key, abort) remain unchanged and must still pass.

## Out of scope (not in this patch)
- Frontend, V1, DB/RPC/secrets, `ssrf.ts`, `fetcher.ts`, `extractor.ts`, `weak_signals.ts`, Firecrawl trigger rules, error envelope shape, Gemini / Phase 7 logic, category resolution, brand creation.
- Diagnostic log cleanup — deferred to a separate follow-up patch AFTER the Nykaa retest confirms behavior. Do not remove logs in this patch.

## Validation
After redeploy, re-test the same Nykaa URL and report all 6 signals:
1. Firecrawl API timeout used (12_000 vs 30_000)
2. Firecrawl duration_ms
3. Firecrawl `ok: true` or error code
4. Whether HTML was returned
5. Whether `extractFromHtml()` produced `predictions !== null`
6. Final response path: 200 success or original `FETCH_BAD_STATUS`

## Decision matrix after re-test
- Firecrawl returns HTML + extractor produces predictions → V2 success. Then schedule a separate diagnostic-log cleanup patch.
- Firecrawl returns HTML + extractor `predictions: null` → Phase 6 working as designed; move to Phase 7 (Gemini URL Context / Google Search).
- Firecrawl still `FIRECRAWL_TIMEOUT` after 30s → Nykaa is beyond an acceptable Firecrawl budget; do not keep raising — move to Phase 7.
- Firecrawl returns `FIRECRAWL_HTTP_ERROR` / `FIRECRAWL_INSUFFICIENT_CREDITS` / `FIRECRAWL_BAD_RESPONSE` → Firecrawl integration/account issue, separate fix.