# Phase 4B — `validateAndFetchUrl` safe fetcher (FINAL, build-ready)

Phase 4A is complete. Phase 4B turns V2 from "stub-only" into **safe-fetch-only**: V2 performs **one safe fetch operation** per Analyze call (which may issue up to `1 + maxRedirects` HTTP requests internally), but still returns `predictions: null` and does no extraction.

## Scope (locked)

**Edit / create only:**

| File | Action |
|---|---|
| `supabase/functions/analyze-entity-url-v2/fetcher.ts` | **new** — `validateAndFetchUrl()`, `withDeadline`, `readWithDeadline`, `FetchError` |
| `supabase/functions/analyze-entity-url-v2/fetcher_test.ts` | **new** — Deno tests, injected `fetch` + resolver, no real network |
| `supabase/functions/analyze-entity-url-v2/schema.ts` | **edit** — add 6 fetch error codes; add minimal `metadata.fetch` block |
| `supabase/functions/analyze-entity-url-v2/index.ts` | **edit** — mandatory DNS gate, call `validateAndFetchUrl`, sanitized error mapping, `stage: 'safe-fetch'`, remove Phase-4A `dns_check_skipped` branch |
| `supabase/functions/analyze-entity-url-v2/README.md` | **edit** — Phase 4B contract, total-budget timeout, "best-effort pre-fetch DNS revalidation" wording, admin-only caveat, scope rules |

**Do not touch:** `supabase/functions/analyze-entity-url/**`, `src/components/admin/CreateEntityDialog.tsx`, `src/hooks/useAnalyzeUrlEngine.ts`, `supabase/config.toml`, DB / RPC / secrets, anything Gemini / Firecrawl / extraction / category / brand related.

## Step 0 — Pre-build runtime verification (must pass before any code change)

Before flipping DNS from optional (Phase 4A) to mandatory (Phase 4B), prove the Supabase Edge runtime exposes `Deno.resolveDns`. If it doesn't, V2 would return `503 DNS_RESOLUTION_FAILED` for every request and Phase 4B would be dead on arrival.

**Check:** `supabase--curl_edge_functions` POST to the already-deployed Phase 4A `analyze-entity-url-v2` with body `{ "url": "https://example.com" }` (admin auth from preview session).

- ✅ **Pass:** response 200 and `warnings` does **not** include `'dns_check_skipped'` → DNS works in production runtime, safe to proceed.
- ❌ **Fail:** `warnings` includes `'dns_check_skipped'` → **stop and surface to user**. Do not implement the mandatory-DNS gate until this is resolved.

## Timeout model — single total budget (Option B)

`timeoutMs` is a **single total budget** for the entire `validateAndFetchUrl()` operation. **No per-hop reset.** Default **8000ms**. Covers, end to end:

1. Initial SSRF / DNS preflight.
2. Every redirect-hop SSRF / DNS re-check.
3. Request headers (per hop).
4. Full response body streaming.

**Mechanism:**

- One `AbortController` created once. Its `signal` passed to every `fetchImpl()` call and remains attached for response/body — but is **not the sole** body-stream timeout mechanism.
- One `setTimeout(() => controller.abort('timeout'), timeoutMs)` started before preflight, cleared in `finally`. Never reset.
- **`withDeadline`** wraps `assertSafeUrl()` calls (initial + every redirect hop) **and** every `reader.read()` call. The race-against-deadline is the authoritative timeout enforcement; body-read uses it explicitly via `readWithDeadline` so streams that ignore `AbortSignal` (e.g. `ReadableStream` with never-resolving `pull()`) still trip the deadline deterministically.

**Why preflight-timeout maps to `FETCH_TIMEOUT` and not `DNS_RESOLUTION_FAILED`:** the resolver didn't fail — the operation ran out of time. Internal `reason: 'preflight_timeout'` for diagnostics; never exposed.

**Orphaned promise hygiene:** lost DNS / `reader.read()` promises settle into the void. `withDeadline` returns the timeout side; late settlement cannot mutate response state. Best-effort `reader.cancel().catch(() => {})` issued on timeout/error paths.

## `fetcher.ts` contract

```ts
export type FetchErrorCode =
  | 'FETCH_TIMEOUT'
  | 'FETCH_TOO_LARGE'
  | 'FETCH_TOO_MANY_REDIRECTS'
  | 'FETCH_BAD_CONTENT_TYPE'
  | 'FETCH_BAD_STATUS'
  | 'FETCH_NETWORK_ERROR'
  | 'BLOCKED_HOST'
  | 'DNS_RESOLUTION_FAILED'
  | 'INVALID_URL';

export class FetchError extends Error {
  code: FetchErrorCode;
  /** Internal diagnostic only. Never echoed to clients, never logged with URL/body. */
  reason?: string;
}

export interface FetchOpts {
  /** Total budget covering preflight DNS, redirects, headers, and body streaming. Default 8000ms. */
  timeoutMs?: number;
  /** Hard cap on actually-received bytes. Default 2_097_152 (2 MiB). */
  maxBytes?: number;
  /** Default 3. */
  maxRedirects?: number;
  /** Default ['text/html','application/xhtml+xml']. Parameters stripped before match. */
  allowedContentTypes?: string[];
  /** REQUIRED. Production handler passes Deno.resolveDns. Tests inject a fake. */
  resolveDns: DnsResolver;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

/** Internal result. NOT serialized to the edge response. */
export interface FetchResult {
  finalUrl: string;
  status: number;
  contentType: string;      // lowercased, parameters stripped
  bodyText: string;         // INTERNAL — Phase 5 consumer. Never logged, never serialized.
  bytes: number;
  redirectChain: string[];  // INTERNAL — never serialized.
  durationMs: number;
}

export async function validateAndFetchUrl(input: string, opts: FetchOpts): Promise<FetchResult>;
```

### Helpers

```ts
/** Races a promise against an absolute deadline (ms epoch).
 *  `onTimeout` may be sync or async; it MUST throw. Typed as `() => never | Promise<never>`
 *  so async cancel-then-throw works without swallowing the FetchError. */
async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  onTimeout: () => never | Promise<never>,
): Promise<T>;

/** Dedicated body-read helper. Races reader.read() against the deadline,
 *  invokes reader.cancel() before throwing FetchError('FETCH_TIMEOUT', { reason: 'body_stream_timeout' }). */
async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: number,
): Promise<ReadableStreamReadResult<Uint8Array>>;
```

### Algorithm

```text
deadline = now + timeoutMs
controller = new AbortController()
timer = setTimeout(() => controller.abort('timeout'), timeoutMs)
try:
  await withDeadline(
    assertSafeUrl(input, { resolveDns }),
    deadline,
    () => { throw FetchError('FETCH_TIMEOUT', { reason: 'preflight_timeout' }) },
  )
  current = safe.url
  redirectChain = [current]
  for hop in 0..maxRedirects:
    resp = await fetchImpl(current, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'Accept-Language': 'en' },
    })
    // AbortError / signal aborted → FETCH_TIMEOUT
    // Other thrown → FETCH_NETWORK_ERROR (raw msg only in internal reason)
    if isRedirect(resp.status):
      loc = resp.headers.get('Location')
      if !loc: throw FETCH_BAD_STATUS reason 'redirect_no_location'
      next = new URL(loc, current).toString()
      await withDeadline(
        assertSafeUrl(next, { resolveDns }),
        deadline,
        () => { throw FetchError('FETCH_TIMEOUT', { reason: 'redirect_preflight_timeout' }) },
      )
      current = nextSafe.url
      redirectChain.push(current)
      continue
    if !(200..299).includes(resp.status): throw FETCH_BAD_STATUS reason String(status)
    ct = parseContentType(resp.headers.get('Content-Type'))
    if !allowedContentTypes.includes(ct): throw FETCH_BAD_CONTENT_TYPE
    bytes = 0; chunks = []
    reader = resp.body.getReader()
    try:
      while true:
        { done, value } = await readWithDeadline(reader, deadline)
        if done: break
        bytes += value.byteLength
        if bytes > maxBytes:
          await reader.cancel().catch(() => {})
          throw FETCH_TOO_LARGE
        chunks.push(value)
    finally:
      reader.releaseLock?.()
    return FetchResult{...}
  throw FETCH_TOO_MANY_REDIRECTS
finally:
  clearTimeout(timer)
```

### Security posture (honest wording)

JSDoc on `validateAndFetchUrl` must state:

> Performs **best-effort pre-fetch DNS revalidation** on the initial URL and every redirect target. **Does not pin the connected socket to the validated IP** — standard `fetch()` resolves DNS again internally at connect time, so a hostile authoritative DNS server could in principle return a public IP during preflight and a private IP at connect (DNS rebinding). For this reason, V2 stays admin-only in Phase 4B.

### Out of scope for Phase 4B (locked)

HTML parsing / extraction (Phase 5). Weak-signal / Firecrawl (Phase 6). Gemini (Phase 7). Brand (Phase 8). Per-host rate limiting, caching, gzip/br tuning.

## `index.ts` integration

```ts
// MANDATORY: production must have DNS. No silent skip.
// deno-lint-ignore no-explicit-any
const resolveDns = (Deno as any).resolveDns?.bind(Deno);
if (typeof resolveDns !== 'function') {
  return errorResponse(503, 'DNS_RESOLUTION_FAILED', 'Could not resolve host');
}

let fetchResult: FetchResult;
try {
  fetchResult = await validateAndFetchUrl(safe.url, { resolveDns });
} catch (e) {
  if (e instanceof FetchError) {
    console.warn('[v2] fetch failed', { code: e.code }); // code only — no URL, no reason
    return errorResponse(httpStatusFor(e.code), e.code, humanMessageFor(e.code));
  }
  throw e;
}

// bodyText intentionally discarded. NOT in response. NOT logged.
const response: V2SuccessResponse = {
  success: true,
  predictions: null,
  metadata: {
    analyzed_url: safe.url,
    normalized_url: safe.url,
    extraction_version: EXTRACTION_VERSION,
    edge_function: EDGE_FUNCTION_NAME,
    method: 'stub',
    timestamp: new Date().toISOString(),
    used_url_context: false,
    used_google_search: false,
    used_firecrawl: false,
    phase: 4,
    stage: 'safe-fetch',
    fetch: {
      final_url: fetchResult.finalUrl,
      status: fetchResult.status,
      content_type: fetchResult.contentType,
      bytes: fetchResult.bytes,
      redirect_count: fetchResult.redirectChain.length - 1,
      duration_ms: fetchResult.durationMs,
    },
  },
  warnings: ['stub: extraction not yet implemented'],
};
```

`httpStatusFor`: `FETCH_TIMEOUT → 504`, `FETCH_TOO_LARGE → 413`, `FETCH_BAD_CONTENT_TYPE → 415`, `FETCH_TOO_MANY_REDIRECTS → 400`, `FETCH_BAD_STATUS → 502`, `FETCH_NETWORK_ERROR → 502`, `BLOCKED_HOST/INVALID_URL → 400`, `DNS_RESOLUTION_FAILED → 503`.

`humanMessageFor`: short generic strings — no URL, no upstream details, no `reason`. E.g. `'Request timed out'`, `'Response too large'`, `'Unsupported content type'`, `'Too many redirects'`, `'Upstream returned an error status'`, `'Network error fetching URL'`.

**Phase 4A's `dns_check_skipped` warning branch is removed** from `index.ts`. The mandatory-DNS gate makes it unreachable in production.

## `schema.ts` edits

- Extend `V2ErrorCode` with the 6 fetch codes above.
- Extend `V2SuccessResponse.metadata` with an optional `fetch` block — exactly these 6 fields, nothing else:

```ts
fetch?: {
  final_url: string;
  status: number;
  content_type: string;
  bytes: number;
  redirect_count: number;
  duration_ms: number;
};
```

**Deliberately excluded:** `redirect_chain`, `body`, `body_snippet`, `headers`, `reason`, raw upstream URLs beyond `final_url`.

## `fetcher_test.ts` (Deno, no real network)

All tests inject `fetchImpl` and `resolveDns`. Cover:

**Happy path:**
- 200 `text/html` 50 KB → `redirect_count` 0, `bodyText.length > 0`.
- 200 `application/xhtml+xml; charset=utf-8` → parameters stripped, allowed.
- 301 → 200 within hop limit → `finalUrl` is the redirected URL.

**Limits:**
- Body > 2 MiB → `FETCH_TOO_LARGE`; reader cancelled.
- 4 redirects with `maxRedirects: 3` → `FETCH_TOO_MANY_REDIRECTS`.

**Total-budget timeout:**
- **Multiple redirects collectively exceed total budget** — 3 hops each delayed 3s with `timeoutMs: 5000` → `FETCH_TIMEOUT`.
- **Body streaming exceeds total budget (delayed chunks)** — headers immediate, cumulative chunk delay > `timeoutMs: 50` → `FETCH_TIMEOUT`, internal `reason === 'body_stream_timeout'`.
- **Body streaming via never-resolving `ReadableStream.pull()` → `FETCH_TIMEOUT` (deadline race, not signal)** — proves `readWithDeadline` enforces the budget even when the stream ignores `AbortSignal`.
- **Headers themselves slow past total budget** → `FETCH_TIMEOUT`.
- **Initial DNS/preflight exceeds budget** — `resolveDns` never resolves, `timeoutMs: 50` → `FETCH_TIMEOUT`, internal `reason === 'preflight_timeout'`, **`fetchImpl` mock never called**.
- **Redirect-target DNS/preflight exceeds remaining budget** — first hop returns 302 immediately, second-hop `resolveDns` hangs → `FETCH_TIMEOUT`, internal `reason === 'redirect_preflight_timeout'`.

**Orphaned promise hygiene:**
- After preflight-timeout test, flush microtasks; assert no unhandled rejection, no late state mutation.
- After body-stream-timeout, late-resolving `pull()` does not throw or mutate.

**Content-type:**
- 200 `application/json` → `FETCH_BAD_CONTENT_TYPE`.
- 200 missing `Content-Type` → `FETCH_BAD_CONTENT_TYPE`.

**Status:**
- 404 → `FETCH_BAD_STATUS`, internal `reason === '404'`.
- 500 → `FETCH_BAD_STATUS`.
- 302 without `Location` → `FETCH_BAD_STATUS`, internal `reason === 'redirect_no_location'`.

**Per-redirect SSRF re-check (best-effort):**
- 302 → `http://10.0.0.1/` → `BLOCKED_HOST`.
- 302 → relative `/admin` against public base → allowed.
- 302 → `http://[::1]/` → `BLOCKED_HOST`.

**DNS mandatory:**
- `resolveDns` returns `NotCapable` for both A/AAAA → `validateAndFetchUrl` throws `DNS_RESOLUTION_FAILED`, `fetchImpl` never called.

**Network errors:**
- `fetchImpl` throws `Error('boom')` → `FETCH_NETWORK_ERROR`; client-facing message does not contain `'boom'` (only `reason` carries it).
- `fetchImpl` throws `AbortError` → `FETCH_TIMEOUT`.

**Preflight short-circuit:**
- `validateAndFetchUrl('http://localhost/', { resolveDns })` → `BLOCKED_HOST`, `fetchImpl` never called.

**Response-shape sanity:**
- Helper asserts `JSON.stringify(simulatedSuccessResponse)` does NOT contain body text and does NOT contain a `redirect_chain` key.

**Helper unit tests:**
- `withDeadline` with async `onTimeout` that awaits before throwing → rejection carries the thrown `FetchError` (not swallowed, not the resolved value).
- `withDeadline` resolves with the promise value when it beats the deadline.

## `README.md` additions

**Phase 4B — safe fetch helper:**

- V2 transitions from **stub-only → safe-fetch-only**. Still no extraction.
- V2 performs **one safe fetch operation** per call, which may issue **up to `1 + maxRedirects` HTTP requests** internally (default: up to 4).
- `validateAndFetchUrl` requires `resolveDns`. Production handler enforces it — missing `Deno.resolveDns` → `503 DNS_RESOLUTION_FAILED` before any fetch. `dns_check_skipped` is Phase-4A-only / test-only and **MUST NOT appear in production Phase 4B+ responses**.
- **`timeoutMs` is a single total budget covering preflight DNS, redirects, headers, and body streaming. Default 8000ms.** No per-hop reset. Preflight timeout maps to `FETCH_TIMEOUT` (not `DNS_RESOLUTION_FAILED`). Internal `reason` distinguishes `preflight_timeout` / `redirect_preflight_timeout` / `body_stream_timeout` for diagnostics; never exposed to clients.
- Body-stream timeout enforced by explicit `withDeadline`/`readWithDeadline` race around `reader.read()` — not by relying on `AbortController.signal` reaching the stream. `signal` still attached to `fetchImpl` for real-fetch benefits.
- Error responses include `code` + generic human message only — no raw upstream messages, no body snippets, no headers, no internal `reason`.
- Server-side logs include `code` only — never URL query strings, headers, body, or internal `reason`.
- **`bodyText` and `redirectChain` are internal — never returned in the response, never logged.**

**Known limitation — DNS rebinding / TOCTOU (honest wording):**

> What we have: **best-effort pre-fetch DNS revalidation.** `assertSafeUrl()` runs before the initial fetch and before every redirect target. What we don't have: **socket-level IP pinning.** Standard `fetch()` resolves DNS again internally at connect time, so a hostile authoritative DNS server could return a public IP during preflight and a private IP at connect. This is a known limitation of the WHATWG fetch model in Deno; closing it requires a custom HTTP client that connects to a pinned IP and sets the Host header manually. **For this reason, V2 stays admin-only in Phase 4B.** Future phases that consume `validateAndFetchUrl` inherit this caveat.

**Safe-fetch scope rules (locked):**

- ✅ **Direct HTML page fetches MUST use `validateAndFetchUrl`.** Raw `fetch()` to any user-submitted URL is **forbidden** anywhere under `supabase/functions/analyze-entity-url-v2/`.
- ✅ **Phase 5 exact-page extractor** consumes `FetchResult.bodyText`; it does not perform its own network I/O.
- ❌ **Gemini URL Context and Firecrawl API calls do NOT go through `validateAndFetchUrl`.** They are calls to Google/Firecrawl APIs, not to the user-submitted URL. They receive only **SSRF-preflighted normalized URLs** (output of `assertSafeUrl`).

**Phase 5+ failure-mode guidance** (docs only, no 4B code):

- Phase 4B returns fetch errors directly — proving the safe-fetch boundary is the point.
- Phase 5/6/7 may later convert fetch failures into warnings / partial extraction. `FETCH_BAD_CONTENT_TYPE` → Firecrawl fallback (6); `FETCH_TIMEOUT` → Gemini URL Context (7); `BLOCKED_HOST` always terminal.

Updated roadmap row: `4B ✅ — safe fetch + live integration` → `5 exact-page extractor (consumes FetchResult.bodyText, no raw fetch)`.

## Response shape (additive only)

```ts
{
  success: true,
  predictions: null,
  metadata: {
    analyzed_url, normalized_url, extraction_version, edge_function,
    method: 'stub', timestamp,
    used_url_context: false, used_google_search: false, used_firecrawl: false,
    phase: 4, stage: 'safe-fetch',
    fetch: { final_url, status, content_type, bytes, redirect_count, duration_ms }
  },
  warnings: ['stub: extraction not yet implemented']
}
```

## Stop-and-show

0. **Pre-build:** Step 0 curl result confirming `Deno.resolveDns` works (no `dns_check_skipped`).
1. Diff of the 5 files only.
2. `supabase--test_edge_functions` — all 34 SSRF tests still green, all new fetcher tests green (including never-resolving `pull()` test and `withDeadline` async-onTimeout test), no real network.
3. Diff confirmation: body loop calls `readWithDeadline(reader, deadline)` — **never bare `await reader.read()`**.
4. Live `supabase--curl_edge_functions` proofs (admin + V2) — each described as "one safe fetch operation":
   - `https://example.com` → 200, `metadata.fetch.status === 200`, `content_type === 'text/html'`, `predictions: null`, **no `body` / `redirect_chain` key in JSON**.
   - `http://localhost/` → 400 `BLOCKED_HOST` (fetcher never invoked).
   - `https://httpbin.org/redirect/5` → 400 `FETCH_TOO_MANY_REDIRECTS`.
   - `https://httpbin.org/status/404` → 502 `FETCH_BAD_STATUS`.
   - `https://httpbin.org/json` → 415 `FETCH_BAD_CONTENT_TYPE`.
5. Explicit confirmations:
   - `bodyText` never in any response or log line.
   - `redirect_chain` never in any response.
   - Error responses contain `code` + human message only — no `reason`, no raw upstream message.
   - V1 byte-identical.
   - `CreateEntityDialog.tsx` and `useAnalyzeUrlEngine.ts` untouched.
   - `supabase/config.toml` untouched.
   - No DB / RPC / secrets changes.
   - README documents DNS-rebinding limitation as best-effort, and V2 stays admin-only.

Awaiting approval to switch to build mode.
