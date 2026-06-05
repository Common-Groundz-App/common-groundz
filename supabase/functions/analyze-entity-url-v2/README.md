# analyze-entity-url-v2

**Status:** Phase 4B — safe-fetch boundary. Still stub (no extraction).

## What this is

A brand-new, isolated edge function that will eventually replace
`analyze-entity-url` (V1). Phase 4B introduces a safe HTTP fetcher
(`validateAndFetchUrl`) and wires it into the handler. V2 now performs
**one safe fetch operation** per Analyze call, which may issue **up to
`1 + maxRedirects` HTTP requests** internally (default: up to 4). The
response still carries `predictions: null` and `method: 'stub'` — no
extraction yet.

## What this is NOT (Phase 4B)

- **No extraction.** Body is fetched and discarded; `predictions: null`.
- No Gemini, no Firecrawl, no exact-page extraction.
- No category matching, no brand creation, no image extraction.
- No DB reads/writes, no RPC calls beyond admin check, no new secrets.
- Does not import anything from `supabase/functions/analyze-entity-url/`.

## Auth model (matches V1)

`supabase/config.toml` sets `verify_jwt = false` for this function so we can
return our own CORS-safe error envelope. Auth is enforced manually:

| Scenario | Status | Code |
|---|---|---|
| Admin + valid public http(s) URL, fetch OK | 200 | success envelope (with `metadata.fetch`) |
| Non-admin authenticated user | 403 | `NOT_ADMIN` |
| Missing `Authorization` header | 401 | `MISSING_AUTH` |
| Invalid / expired bearer token | 401 | `INVALID_TOKEN` |
| Non-POST request | 405 | `METHOD_NOT_ALLOWED` |
| Body is not JSON | 400 | `INVALID_JSON` |
| Body fails Zod validation | 400 | `INVALID_URL` (with `details`) |
| URL has userinfo / private IP / blocked host / blocked port | 400 | `BLOCKED_HOST` |
| DNS unavailable in runtime | 503 | `DNS_RESOLUTION_FAILED` |
| DNS lookup hard-fails | 400/503 | `DNS_RESOLUTION_FAILED` |
| Fetch total budget exceeded | 504 | `FETCH_TIMEOUT` |
| Response body > maxBytes | 413 | `FETCH_TOO_LARGE` |
| More than `maxRedirects` hops | 400 | `FETCH_TOO_MANY_REDIRECTS` |
| Non-HTML content type | 415 | `FETCH_BAD_CONTENT_TYPE` |
| Upstream non-2xx | 502 | `FETCH_BAD_STATUS` |
| Generic network error | 502 | `FETCH_NETWORK_ERROR` |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

## SSRF rules (preflight + per-redirect re-check)

`ssrf.ts` exposes `normalizeUrl` and `assertSafeUrl`. `fetcher.ts` invokes
`assertSafeUrl` on the initial URL **and on every redirect target**.
Normalization, port allowlist, hostname suffix blocklist, IP-literal blocks
(v4 + v6), and DNS A/AAAA checks are unchanged from Phase 4A — see
`ssrf.ts` for the full rule set.

## Phase 4B — safe fetch helper

- V2 transitions from **stub-only → safe-fetch-only**. Still no extraction.
- V2 performs **one safe fetch operation** per call, which may issue
  **up to `1 + maxRedirects` HTTP requests** internally (default: up to 4).
- `validateAndFetchUrl` requires `resolveDns`. The production handler
  enforces it — if `Deno.resolveDns` is missing in the runtime, the handler
  returns `503 DNS_RESOLUTION_FAILED` **before any fetch**. The Phase-4A
  `dns_check_skipped` warning is **gone in Phase 4B** and MUST NOT appear
  in production responses.

### Timeout model — single total budget

- `timeoutMs` is a **single total budget** covering preflight DNS, every
  redirect-hop DNS re-check, request headers, and full body streaming.
  **Default 8000ms. No per-hop reset.**
- Implementation: one `AbortController` started at the top; its `signal` is
  passed to every `fetchImpl()` call. **Body-stream timeout is enforced by
  an explicit `withDeadline` / `readWithDeadline` race around
  `reader.read()`** — not by relying on `AbortSignal` propagating into the
  stream. This guarantees the budget is honored even when a stream ignores
  the signal entirely (e.g. a `ReadableStream` with a never-resolving
  `pull()`).
- Preflight timeout maps to `FETCH_TIMEOUT` (not `DNS_RESOLUTION_FAILED`):
  the resolver didn't fail, the operation ran out of time. Internal
  `reason` values (`preflight_timeout`, `redirect_preflight_timeout`,
  `body_stream_timeout`) aid diagnostics but are **never exposed to clients**.

### Privacy

- **`bodyText` and `redirectChain` are internal-only.** They live on
  `FetchResult` for Phase-5 consumers but are **never** returned in the API
  response and **never** logged.
- Error responses include `code` + a generic human message only — no raw
  upstream messages, no body snippets, no headers, no internal `reason`.
- Server-side logs include `code` only — never URL query strings, headers,
  body, or internal `reason`.

### Known limitation — DNS rebinding / TOCTOU (honest wording)

What we have: **best-effort pre-fetch DNS revalidation.** `assertSafeUrl()`
runs before the initial fetch and before every redirect target.

What we **don't** have: **socket-level IP pinning.** Standard `fetch()`
resolves DNS again internally at connect time, so a hostile authoritative
DNS server could return a public IP during preflight and a private IP at
connect. This is a known limitation of the WHATWG fetch model in Deno;
closing it requires a custom HTTP client that connects to a pinned IP and
sets the Host header manually.

**For this reason, V2 stays admin-only in Phase 4B.** Future phases that
consume `validateAndFetchUrl` inherit this caveat.

### Safe-fetch scope rules (locked)

- ✅ **Direct HTML page fetches MUST use `validateAndFetchUrl`.** Raw
  `fetch()` to any user-submitted URL is **forbidden** anywhere under
  `supabase/functions/analyze-entity-url-v2/`.
- ✅ **Phase 5 exact-page extractor** consumes `FetchResult.bodyText`; it
  does not perform its own network I/O.
- ❌ **Gemini URL Context and Firecrawl API calls do NOT go through
  `validateAndFetchUrl`.** Those are calls to Google / Firecrawl APIs, not
  to the user-submitted URL. They receive only **SSRF-preflighted
  normalized URLs** (output of `assertSafeUrl`).

### Phase 5+ failure-mode guidance (docs only)

- Phase 4B returns fetch errors directly — proving the safe-fetch boundary
  is the point.
- Phase 5/6/7 may later convert fetch failures into warnings or partial
  extraction. `FETCH_BAD_CONTENT_TYPE` → Firecrawl fallback (6);
  `FETCH_TIMEOUT` → Gemini URL Context (7); `BLOCKED_HOST` always terminal.

## Locked response envelope

```ts
{
  success: true,
  predictions: null,                 // still null in Phase 4B
  metadata: {
    analyzed_url: string,
    normalized_url?: string,
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: string,                  // 'stub' in Phase 4B
    timestamp: string,
    used_url_context: boolean,       // false in Phase 4B
    used_google_search: boolean,     // false in Phase 4B
    used_firecrawl: boolean,         // false in Phase 4B
    phase?: number,                  // DIAGNOSTIC-ONLY
    stage?: string,                  // DIAGNOSTIC-ONLY ('safe-fetch')
    fetch?: {                        // Phase 4B+: minimal fetch summary
      final_url: string,
      status: number,
      content_type: string,
      bytes: number,
      redirect_count: number,
      duration_ms: number,
    }
  },
  warnings?: string[]
}
```

**Deliberately excluded from `metadata.fetch`:** `redirect_chain`, `body`,
`body_snippet`, `headers`, `reason`, raw upstream URLs beyond `final_url`.

Error envelope:

```ts
{ success: false, error: string, code: V2ErrorCode, details?: unknown }
```

## Phase roadmap

- **Phase 1 ✅** — `entity_extraction.version` admin flag.
- **Phase 2 ✅** — scaffold + locked envelope.
- **Phase 3 ✅** — `CreateEntityDialog` routes via `useAnalyzeUrlEngine()`.
- **Phase 4A ✅** — SSRF preflight + URL normalization.
- **Phase 4B ✅ (this)** — safe fetch + live integration.
- **Phase 5** — exact-page extractor (consumes `FetchResult.bodyText`, no raw fetch).
- **Phase 6** — weak-signal detector + Firecrawl fallback.
- **Phase 7** — Gemini URL Context + structured output.
- **Phase 8** — brand suggestion + Save-time parent brand handling.
- **Phase 9+** — admin smoke test, logging, compare mode.
