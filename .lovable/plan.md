# Phase 6 — Firecrawl Fallback (Final, ready to implement)

## Goal
After Phase 5 runs, fall back to Firecrawl when (a) direct safe-fetch failed on an eligible non-SSRF code, or (b) Phase 5 returned `predictions: null`, or (c) Phase 5 returned `metadata.weak_signals === true`. Recovered HTML is re-run through the existing Phase 5 `extractFromHtml()`. No frontend, V1, DB, brand, Gemini, category, fetcher, ssrf, or extractor changes.

## Decisions locked in (post-review)
- **Narrow trigger only.** `criticalFieldsMissing` is **deferred to Phase 7/8** (Gemini/normalization/image candidates).
- **Strict fetch-failure conversion.** If direct fetch failed and Firecrawl returns HTML but extraction still yields `predictions: null`, V2 returns the **original fetch error** unchanged. Firecrawl-recovered success requires `predictions !== null`.
- **`metadata.fetch` presence rule (new clarification):**
  - Present **only when direct safe-fetch completed successfully** (regardless of whether extraction was strong, weak, or later replaced by Firecrawl).
  - **Omitted** when direct safe-fetch failed and Firecrawl recovered predictions — there is no successful direct transport to report.
  - `metadata.firecrawl` records Firecrawl usage/recovery in that case.
- **`metadata.extract` reflects the final extraction.** If Firecrawl replaces a weak direct result, `metadata.extract` describes the Firecrawl-based extractor output; `metadata.firecrawl.improved = true` signals the swap.
- **Firecrawl status lives in a separate `metadata.firecrawl` block**, plus the existing top-level `metadata.used_firecrawl` boolean.
- **Error responses stay sanitized.** `V2ErrorResponse` does not gain `warnings`. Firecrawl failure diagnostics on the error path are logged only.
- **Warning codes ≠ error codes (new clarification).** Firecrawl diagnostic codes that appear only in success-path `warnings[]` are **not** added to `V2ErrorCode`. `warnings` stays `string[]`. `V2ErrorCode` remains reserved for top-level error envelopes.
- **SSRF preserved.** Firecrawl only ever receives the SSRF-preflighted normalized `safe.url`. `BLOCKED_HOST`, `INVALID_URL`, `DNS_RESOLUTION_FAILED` never call Firecrawl.

## Trigger logic

```text
fetchFailedEligible = fe.code in {
  FETCH_BAD_STATUS, FETCH_TIMEOUT, FETCH_NETWORK_ERROR,
  FETCH_BAD_CONTENT_TYPE, FETCH_TOO_LARGE, FETCH_TOO_MANY_REDIRECTS
}

shouldUseFirecrawl =
     fetchFailedEligible
  || extract.predictions === null
  || extract.metadata.weak_signals === true

firecrawlPriority = shouldUseFirecrawl && isKnownJsHeavyHost(safe.url)
                    ? 'high' : 'normal'   // diagnostic only; never gates
```

## Files

### New
- `supabase/functions/analyze-entity-url-v2/firecrawl.ts`
  - `runFirecrawlScrape(url, { timeoutMs?: 12000, fetchImpl?, apiKey? }): Promise<FirecrawlResult>`
  - `POST https://api.firecrawl.dev/v2/scrape`, body `{ url, formats: ['html','rawHtml'], onlyMainContent: false, waitFor: 1500 }`. Picks `data.html ?? data.rawHtml`. No markdown.
  - Reads `FIRECRAWL_API_KEY` via `Deno.env.get`. Missing → `{ ok:false, code:'FIRECRAWL_NOT_CONFIGURED' }` (no fetch).
  - 12 s `AbortController` budget.
  - **2 MB HTML cap** (mirrors Phase-4B). Oversize → `FIRECRAWL_RESPONSE_TOO_LARGE`.
  - Sanitizes Firecrawl-returned `finalUrl` / `metadata.sourceURL` via `safeBaseUrl(candidate, fallback=safe.url)` — `http:`/`https:` only, else `safe.url`. The sanitized URL is handed to `extractFromHtml()`.
  - Error codes (internal strings only, **not** added to `V2ErrorCode`): `FIRECRAWL_NOT_CONFIGURED`, `FIRECRAWL_TIMEOUT`, `FIRECRAWL_HTTP_ERROR`, `FIRECRAWL_INSUFFICIENT_CREDITS` (402), `FIRECRAWL_BAD_RESPONSE`, `FIRECRAWL_RESPONSE_TOO_LARGE`.
  - Logs `{ code, status?, durationMs }` only. Never logs URL, HTML, or API key.

- `supabase/functions/analyze-entity-url-v2/weak_signals.ts`
  - Imports the actual return type of `extractFromHtml()` (compile-time alignment).
  - `detectWeakSignals(extract): { weak: boolean, reasons: string[] }` — checks `predictions === null` and `metadata.weak_signals === true`. **No `criticalFieldsMissing` in Phase 6.**

- `supabase/functions/analyze-entity-url-v2/host_hints.ts`
  - `isKnownJsHeavyHost(url): boolean` over `amazon.*`, `flipkart.com`, `myntra.com`, `nykaa.com`, `ajio.com`, `meesho.com`. Safe on malformed URLs.

- Tests: `firecrawl_test.ts`, `weak_signals_test.ts`, `host_hints_test.ts`.

### Modified
- `supabase/functions/analyze-entity-url-v2/index.ts` — see flow below.
- `supabase/functions/analyze-entity-url-v2/schema.ts`
  - Additive on success only:
    - `metadata.firecrawl?: { used: boolean, priority: 'high'|'normal', duration_ms?: number, error_code?: string, improved?: boolean }`
  - **`metadata.fetch` shape unchanged**; doc-comment updated to: *"Present only when direct safe-fetch completed successfully. Omitted when Firecrawl recovered the entity after a direct-fetch failure."*
  - `metadata.used_firecrawl` (already exists) reflects whether Firecrawl HTML was used for the final extraction.
  - `warnings?: string[]` (already exists) — Firecrawl warning codes piggyback here as plain strings. **No `V2ErrorCode` additions.**
  - **No change** to `V2ErrorResponse`.

### Untouched
`ssrf.ts`, `fetcher.ts`, `extractor.ts`, V1 function, brand/category code, all frontend.

## Flow in `index.ts`

```text
Auth + Zod + SSRF preflight (unchanged).

try fetchResult = validateAndFetchUrl(safe.url, ...)
catch FetchError fe:
  if fetchFailedEligible(fe) and FIRECRAWL_API_KEY present:
    fc = await runFirecrawlScrape(safe.url)
    if fc.ok:
      base = safeBaseUrl(fc.finalUrl, safe.url)
      extract = extractFromHtml(fc.html, base)
      if extract.predictions !== null:
        // Firecrawl actually recovered the page → success
        metadata.used_firecrawl = true
        metadata.firecrawl = { used:true, priority, duration_ms, improved:true }
        metadata.extract = extract.metadata   // final extraction = Firecrawl-based
        // metadata.fetch OMITTED (no successful direct safe-fetch result)
        return success response
      // Firecrawl returned HTML but extraction still null → fall through
    // fc.ok=false → log {code,status?,durationMs}, fall through
  // Return original fetch error unchanged. No warnings on error envelope.
  return errorResponse(httpStatusFor(fe.code), fe.code, humanMessageFor(fe.code))

// Direct fetch succeeded.
extract = extractFromHtml(fetchResult.bodyText, fetchResult.finalUrl)
ws = detectWeakSignals(extract)

if ws.weak and FIRECRAWL_API_KEY present:
  fc = await runFirecrawlScrape(safe.url)
  if fc.ok:
    base = safeBaseUrl(fc.finalUrl, safe.url)
    extract2 = extractFromHtml(fc.html, base)
    if isStrictlyBetter(extract2, extract):
      extract = extract2                                   // final extraction = Firecrawl-based
      metadata.used_firecrawl = true
      metadata.firecrawl = { used:true, priority, duration_ms, improved:true }
      warnings += extract2.warnings
    else:
      metadata.firecrawl = { used:true, priority, duration_ms, improved:false }
      warnings += ['firecrawl_no_improvement']
  else:
    metadata.firecrawl = { used:false, priority, error_code: fc.code }
    warnings += [fc.code]   // success-path warnings allowed; plain strings
else if ws.weak and !FIRECRAWL_API_KEY:
  warnings += ['FIRECRAWL_NOT_CONFIGURED']

// metadata.fetch present (direct safe-fetch succeeded), unchanged shape.
// metadata.extract = extract.metadata (final extraction, may be Firecrawl-based).
// metadata.used_firecrawl + metadata.firecrawl describe Firecrawl usage.
Build V2SuccessResponse exactly as today (V1-compatible predictions).
```

### `isStrictlyBetter(b, a)` (Phase-6 narrow form)
```text
true iff:
  (a.predictions === null && b.predictions !== null)
  || (a.metadata.weak_signals === true && b.metadata.weak_signals === false)
```

## Behavioral guarantees
- Predictions shape identical to Phase 5 (V1-compatible).
- No DB writes. No brand create. No category matching. No frontend changes.
- SSRF rejects still return 400/503 — Firecrawl never invoked.
- Wikipedia / strong JSON-LD pages → `used_firecrawl: false`, zero extra latency.
- 403 Amazon-style direct failure → one Firecrawl call; converts to 200 only if `predictions !== null`. Otherwise the original 502 is returned unchanged, no `metadata.fetch`, no `metadata.firecrawl` (error envelope unchanged).
- Direct success + weak extraction → one Firecrawl attempt; replaced only if strictly better. `metadata.fetch` present in both branches.
- Direct success + strong extraction (even with missing image/brand/price/description) → no Firecrawl call. (Deferred to Phase 7/8.)
- `FIRECRAWL_API_KEY` missing → V2 behaves like Phase 5; single `FIRECRAWL_NOT_CONFIGURED` warning on success-path only.

## Secrets
Requires `FIRECRAWL_API_KEY`. Verify with `fetch_secrets` at implementation start; link via `standard_connectors--connect` (Firecrawl connector) if absent. Code degrades gracefully when missing.

## Tests

**`weak_signals_test.ts`**
- `predictions === null` → weak
- `metadata.weak_signals === true` → weak
- strong product with image/brand/price → not weak
- **product missing image_url but strong otherwise → NOT weak** (proves criticalFieldsMissing is NOT a trigger in Phase 6)
- movie missing description but strong otherwise → not weak
- typed against actual `extractFromHtml()` return shape

**`host_hints_test.ts`**
- `amazon.in`, `amazon.com`, `www.flipkart.com`, `myntra.com`, `m.nykaa.com` → true
- `wikipedia.org`, `example.com` → false
- malformed URL → false (no throw)

**`firecrawl_test.ts`** (inject `fetchImpl`)
- missing API key → `FIRECRAWL_NOT_CONFIGURED`, no fetch
- 200 `data.html` → ok
- 200 only `data.rawHtml` → ok (fallback)
- 200 with neither → `FIRECRAWL_BAD_RESPONSE`
- 402 → `FIRECRAWL_INSUFFICIENT_CREDITS`
- 5xx → `FIRECRAWL_HTTP_ERROR` (status preserved)
- hanging fetch → `FIRECRAWL_TIMEOUT` within budget
- 3 MB HTML → `FIRECRAWL_RESPONSE_TOO_LARGE`
- malformed JSON → `FIRECRAWL_BAD_RESPONSE`
- `safeBaseUrl`: valid https → used; missing → `safe.url`; `javascript:`/`data:`/malformed → `safe.url`

**Integration (`supabase--curl_edge_functions` after deploy)**
- Wikipedia URL → `used_firecrawl=false`, no `metadata.firecrawl`, `metadata.fetch` present
- Amazon product with rich JSON-LD direct → no Firecrawl call, `metadata.fetch` present
- Amazon 403 direct + Firecrawl recovers product → 200, `used_firecrawl=true`, `firecrawl.improved=true`, **no `metadata.fetch`**, `metadata.extract` describes Firecrawl-based extraction
- Amazon 403 direct + Firecrawl returns generic HTML (still null) → **original 502 preserved**, plain error envelope
- Direct success + weak extraction + Firecrawl improves → 200, `metadata.fetch` present (direct), `metadata.extract` is Firecrawl-based, `firecrawl.improved=true`
- Direct success + weak extraction + Firecrawl no-improvement → 200 with original direct prediction, warning `firecrawl_no_improvement`, `metadata.fetch` intact
- Private IP URL → 400 `BLOCKED_HOST`, Firecrawl never invoked

## Risks & rollback
- **Cost**: bounded — one Firecrawl call per request only when weak/failed, 12 s budget, no retries. Narrow trigger keeps spend predictable. Disable instantly by deleting `FIRECRAWL_API_KEY`.
- **Latency on weak pages**: +≤12 s worst case. Direct-strong pages unaffected.
- **Credit exhaustion (402)**: logged + (success path) warning; original direct result still returned.
- **Schema drift**: success `metadata.firecrawl` is optional; `metadata.fetch` shape unchanged (doc clarified as conditionally present); `V2ErrorResponse` unchanged; `V2ErrorCode` unchanged.
- **Rollback**: revert the Phase-6 branch in `index.ts` and remove the three new files. Additive schema fields can remain. No DB/grant changes to revert.

## Out of scope (explicit, for future phases)
- `criticalFieldsMissing` trigger for missing image/brand/price/description on otherwise-valid predictions → **Phase 7/8** (with Gemini/normalization).
- Gemini, URL Context, Google Search → Phase 7.
- Per-field confidence, brand suggestion → Phase 8.
- Logging table → Phase 10.
- Any frontend or V1 change.

## Implementation handoff
After build, stop and show: file diffs, all three new test files passing, and the integration-curl proofs listed above. Do not proceed to Phase 7.
