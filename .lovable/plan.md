# Phase 6 Diagnostic Patch — Redeploy + Sanitized Logs (revised)

## Goal

Determine why the Nykaa request returned `FETCH_BAD_STATUS` with **no Firecrawl log at all**, by:

1. Forcing the deployed `analyze-entity-url-v2` revision to pick up the newly added `FIRECRAWL_API_KEY`.
2. Adding minimal, sanitized diagnostic logs that prove (or disprove) whether Firecrawl is configured and whether the Firecrawl branch is entered.

No behavior changes. No Phase 7 work. No touching V1, frontend, DB, fetcher, ssrf, extractor, firecrawl.ts, schema.ts, weak_signals.ts, or host_hints.ts.

## Scope (in-scope)

- `supabase/functions/analyze-entity-url-v2/index.ts` — add exactly 3 sanitized `console.log` lines
- Redeploy `analyze-entity-url-v2`
- Re-test the exact Nykaa URL
- Read edge function logs and report findings

## Out of scope (explicitly NOT changing)

- V1 (`analyze-entity-url`)
- `fetcher.ts`, `ssrf.ts`, `extractor.ts`, `weak_signals.ts`, `host_hints.ts`, `firecrawl.ts`, `schema.ts`
- Frontend, DB, RPCs, secrets (already added)
- Firecrawl fallback logic, eligibility set, strict fetch-failure contract
- Gemini / URL Context / Google Search (Phase 7)

## The 3 logs to add (sanitized, corrected)

All inserted in `index.ts` only. Structured objects with **only** the listed fields — no URL, no API key, no HTML, no headers, no body.

1. **Right after `firecrawlConfigured` and `priority` are defined** (just after the SSRF block, before safe fetch — placement guarantees both consts exist so no TS error):
   ```ts
   console.log("[analyze-entity-url-v2] phase6 firecrawl_configured", {
     configured: firecrawlConfigured,
     priority,
   });
   ```

2. **Inside the fetch-failure recovery branch**, right before `runFirecrawlScrape` (only fires when eligible + configured):
   ```ts
   console.log("[analyze-entity-url-v2] phase6 firecrawl branch entered (fetch recovery)", {
     fetch_error_code: e.code,
     priority,
   });
   ```

3. **Inside the weak-signals recovery branch**, right before `runFirecrawlScrape`. Uses the actual return shape `{ weak, reasons: string[] }` from `detectWeakSignals()` — reasons are controlled diagnostic strings (`"predictions_null"`, `"weak_signals_flag"`), safe to log:
   ```ts
   console.log("[analyze-entity-url-v2] phase6 firecrawl branch entered (weak recovery)", {
     priority,
     weak_reasons: ws.reasons,
   });
   ```

Existing `console.warn` lines (firecrawl call failed, firecrawl recovery failed) are already sanitized — leave them as-is.

## Forbidden log content

- Full URL, query string, or final URL
- `FIRECRAWL_API_KEY` (or any prefix/suffix of it)
- `fetchResult.bodyText`, `fc.html`, `fc.rawHtml`
- Request headers, response headers
- Raw Firecrawl response body

## Steps

1. Edit `supabase/functions/analyze-entity-url-v2/index.ts` to add the 3 logs above at the specified positions.
2. Deploy only `analyze-entity-url-v2` (forces cold boot → picks up `FIRECRAWL_API_KEY`).
3. Ask user to re-run the exact Nykaa URL:
   `https://www.nykaa.com/dior-homme-intense-eau-de-parfum-intense/p/950905?skuId=768775`
4. Read the edge function logs for that request and report:
   - direct fetch error code
   - `firecrawl_configured` value at runtime
   - whether the Firecrawl branch was entered (and which one)
   - Firecrawl result: `ok` / error code / status / `durationMs`
   - if `ok`: did `extractFromHtml()` produce `predictions` or `null`?
   - final V2 response (200 success vs original fetch error)

## Decision matrix after re-test

| Log outcome | Conclusion | Next step |
|---|---|---|
| `configured: false` | Secret not injected into runtime even after redeploy | Investigate secret scoping / redeploy mechanism |
| `configured: true` + branch NOT entered for `FETCH_BAD_STATUS` | Phase 6 wiring bug | Fix `index.ts` branch condition |
| `configured: true` + branch entered + Firecrawl error (`FIRECRAWL_HTTP_ERROR` / `INSUFFICIENT_CREDITS` / `BAD_RESPONSE` / `TIMEOUT`) | Firecrawl integration / API / credits issue | Address that specific error |
| `configured: true` + Firecrawl `ok` + extraction `predictions: null` | **Expected Phase 6 behavior** — Nykaa HTML lacks parseable product metadata | Move to Phase 7 (Gemini URL Context / Google Search) |
| `configured: true` + Firecrawl `ok` + extraction succeeds | Phase 6 works; original V2 error was a deploy-stale issue | Remove diagnostic logs |

## Cleanup (follow-up, NOT in this patch)

After diagnosis is confirmed, remove logs 2 and 3, and keep only a permanent sanitized summary log if useful. That cleanup happens in a separate small patch.

## Acceptance criteria

- Exactly 3 `console.log` lines added, all sanitized per the rules above
- Log #1 placed after `firecrawlConfigured` and `priority` are defined
- Log #3 uses `ws.reasons` (array), not `ws.reason`
- `analyze-entity-url-v2` redeployed
- Edge function logs for the Nykaa re-test clearly answer all 6 report questions
- No other files changed
