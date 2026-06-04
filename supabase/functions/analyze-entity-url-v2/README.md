# analyze-entity-url-v2

**Status:** Phase 4A — SSRF preflight + URL normalization. Still stub (no extraction).

## What this is

A brand-new, isolated edge function that will eventually replace
`analyze-entity-url` (V1). Phase 4A adds preflight SSRF protection and
conservative URL normalization. **No network fetch happens in this phase.**
The response still carries `predictions: null` and `method: 'stub'`.

## What this is NOT (Phase 4A)

- **No real fetch.** No HTTP request is made to the analyzed URL.
- No Gemini, no Firecrawl, no exact-page extraction.
- No category matching, no brand creation, no image extraction.
- No DB reads/writes, no RPC calls, no secrets used.
- Does not import anything from `supabase/functions/analyze-entity-url/`.

## Auth model (matches V1)

`supabase/config.toml` sets `verify_jwt = false` for this function so we can
return our own CORS-safe error envelope. Auth is enforced manually:

| Scenario | Status | Code |
|---|---|---|
| Admin + valid public http(s) URL | 200 | success envelope |
| Non-admin authenticated user | 403 | `NOT_ADMIN` |
| Missing `Authorization` header | 401 | `MISSING_AUTH` |
| Invalid / expired bearer token | 401 | `INVALID_TOKEN` |
| Non-POST request | 405 | `METHOD_NOT_ALLOWED` |
| Body is not JSON | 400 | `INVALID_JSON` |
| Body fails Zod validation | 400 | `INVALID_URL` (with `details`) |
| URL has userinfo / private IP / blocked host / blocked port | 400 | `BLOCKED_HOST` |
| DNS lookup hard-fails | 400 | `DNS_RESOLUTION_FAILED` |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

## SSRF rules (Phase 4A, preflight only)

`ssrf.ts` exposes `normalizeUrl` and `assertSafeUrl`.

**Normalization (conservative):**
- Trim, parse with `new URL`.
- Reject non-http(s) protocol → `INVALID_URL`.
- **Reject userinfo** (`user:pass@host`) before any mutation → `BLOCKED_HOST/userinfo`. URL is rejected, never sanitized.
- Lowercase hostname; clear fragment.
- Do NOT touch path slashes, query order, or query case.
- Default ports (`:80` http, `:443` https) are stripped by the URL parser itself; port allowlist check reads the effective port after parsing.

**Blocks:**
- **Port allowlist:** `[80, 443, 8080, 8443]`.
- **Hostname suffix blocklist:** `localhost`, `.localhost`, `.local`, `.internal`, `.lan`, `.intranet`, `.corp`, `.home`, `.home.arpa`.
- **IP literals (v4 + v6, dotted-quad + decimal/octal/hex integer forms):** loopback, link-local (incl. `169.254.169.254`), RFC1918 private, CGNAT, multicast, reserved, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, IPv4-mapped `::ffff:<v4>` (recursive).
- **DNS (when resolver available):** resolve A + AAAA in parallel; any returned IP in a blocked range → `BLOCKED_HOST/dns_resolves_private`. Missing one record type (A or AAAA) is NOT a failure if the other succeeds.

**DNS-skip caveat (Phase 4A only):**
If the runtime refuses DNS (`Deno.errors.NotCapable` / `PermissionDenied`) for both record types, Phase 4A allows the URL through and the handler appends `'dns_check_skipped'` to the top-level `warnings` array. **This is safe ONLY because Phase 4A performs no network fetch.** Once Phase 4B introduces real fetching, DNS resolution + per-redirect re-check at connect time become **mandatory**, not optional.

**Out of scope for Phase 4A** (deferred to Phase 4B): TEST-NET / 6to4 / Teredo ranges, real fetch, timeouts, redirect handling, content-type allowlist, TOCTOU protection.

## Locked response envelope

```ts
{
  success: true,
  predictions: null,                 // still null in Phase 4A
  metadata: {
    analyzed_url: string,            // normalized URL (Phase 4A+)
    normalized_url?: string,         // Phase 4A+: same value, additive
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: string,                  // 'stub' in Phase 4A
    timestamp: string,               // ISO
    used_url_context: boolean,       // false in Phase 4A
    used_google_search: boolean,     // false in Phase 4A
    used_firecrawl: boolean,         // false in Phase 4A
    phase?: number,                  // DIAGNOSTIC-ONLY, do not branch on this
    stage?: string                   // DIAGNOSTIC-ONLY, do not branch on this
  },
  warnings?: string[]                // top-level; may include 'dns_check_skipped'
}
```

Error envelope:

```ts
{ success: false, error: string, code: V2ErrorCode, details?: unknown }
```

`error` is always a human-readable string. Structured info goes in `details`.

## Phase roadmap

- **Phase 1 ✅** — `entity_extraction.version` admin flag.
- **Phase 2 ✅** — scaffold + locked envelope.
- **Phase 3 ✅** — `CreateEntityDialog` routes via `useAnalyzeUrlEngine()`.
- **Phase 4A ✅ (this)** — SSRF preflight + URL normalization.
- **Phase 4B** — `validateAndFetchUrl` (timeout, max-size streaming cap, ≤3 redirects with per-hop re-normalize + DNS/IP re-check (TOCTOU), content-type allowlist).
- **Phase 5** — exact-page extractor (calls Phase 4B's safe fetcher, never raw `fetch`).
- **Phase 6** — weak-signal detector + Firecrawl fallback.
- **Phase 7** — Gemini URL Context + structured output.
- **Phase 8** — brand suggestion + Save-time parent brand handling (lookup-only during Analyze; create-on-Save after admin confirms).
- **Phase 9+** — admin smoke test, logging, compare mode.
