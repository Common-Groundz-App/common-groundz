# Phase 4A — SSRF preflight + URL normalization (FINAL, ready to build)

Preflight-only. No fetch, no Gemini, no Firecrawl, no extraction, no category/brand logic, no DB/RPC/config/secrets changes. V1, `CreateEntityDialog.tsx`, and `useAnalyzeUrlEngine.ts` are untouched.

## Files

| File | Action |
|---|---|
| `supabase/functions/analyze-entity-url-v2/ssrf.ts` | **new** |
| `supabase/functions/analyze-entity-url-v2/ssrf_test.ts` | **new** |
| `supabase/functions/analyze-entity-url-v2/schema.ts` | **edit** — add `BLOCKED_HOST`, `DNS_RESOLUTION_FAILED` to `V2ErrorCode`; add optional `metadata.normalized_url: string` |
| `supabase/functions/analyze-entity-url-v2/index.ts` | **edit** — call `assertSafeUrl()` after Zod; set `analyzed_url` + `normalized_url` to normalized form; `phase: 4`, `stage: 'ssrf-guard'`; append `'dns_check_skipped'` to existing top-level `warnings` when applicable |
| `supabase/functions/analyze-entity-url-v2/README.md` | **edit** — document Phase 4A boundary, DNS-skip safe only because no fetch, TOCTOU deferred to 4B, brand-roadmap wording corrected |
| `src/components/admin/AdminFeatureFlagsPanel.tsx` | **edit, copy-only** — change "Will call `analyze-entity-url-v2` once wired up." to "Calls `analyze-entity-url-v2`. Currently a scaffold and returns no AI prefill yet." |

## `ssrf.ts` rules

### `normalizeUrl(input: string)`
1. `new URL(input.trim())` — invalid → `SsrfError('INVALID_URL')`.
2. **If `u.username || u.password` → `SsrfError('BLOCKED_HOST', { reason: 'userinfo' })`** before any mutation. Never sanitized away.
3. Lowercase `u.hostname`.
4. Clear fragment (`u.hash = ''`).
5. Default-port handling: `new URL().toString()` already strips `:80` for http and `:443` for https. Do not manually re-add or re-strip — read `u.port` for allowlist check **after** parsing, treating empty `u.port` as protocol default (80/443).
6. Do NOT touch pathname slashes, query order, or query casing.
7. Return `{ url: u.toString(), host: u.host, hostname: u.hostname, port: effectivePort }`.

### `assertSafeUrl(input, { resolveDns? })`
1. `normalizeUrl()`.
2. Hostname suffix block list (case-insensitive, after lowercase): exact `localhost`, suffix-match `.localhost`, `.local`, `.internal`, `.lan`, `.intranet`, `.corp`, `.home`, `.home.arpa`.
3. Effective port allowlist `[80, 443, 8080, 8443]`. Anything else → `BLOCKED_HOST` reason `port_not_allowed`.
4. IP-literal detection:
   - IPv4: WHATWG dotted-quad plus accept decimal/octal/hex integer forms (`2130706433`, `0177.0.0.1`, `0x7f000001`) by re-parsing.
   - IPv6: strip surrounding `[`/`]` before classification; preserve URL output formatting from `u.toString()`.
   - Blocked ranges: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16` (incl. `169.254.169.254`), `172.16/12`, `192.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`, `255.255.255.255`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped `::ffff:<v4>` (recurse on the embedded v4).
   - TEST-NET / 6to4 / Teredo are explicitly OUT of 4A; documented as 4B work.
5. If hostname is not an IP literal AND a resolver is available:
   - Resolve A and AAAA in parallel via `Promise.allSettled` (real resolver = `Deno.resolveDns`; injected fake in tests).
   - Use a helper `isDnsNoRecordsError(err)` that matches `Deno.errors.NotFound` (and equivalent name === 'NotFound' from fakes) — treat as "no records of this type", not an error.
   - If runtime throws `Deno.errors.NotCapable` / `PermissionDenied` on **both** types → skip DNS, return `dnsChecked: false`. Handler appends `'dns_check_skipped'` to top-level `warnings`.
   - If **both** types reject with a non-NotCapable, non-NoRecords error → `SsrfError('DNS_RESOLUTION_FAILED')`.
   - Otherwise: classify every returned IP (strip IPv6 brackets first); any blocked → `SsrfError('BLOCKED_HOST', { reason: 'dns_resolves_private' })`.
6. Return `{ url, host, hostname, port, dnsChecked: boolean }`.

`SsrfError` is a typed class with `code: 'INVALID_URL' | 'BLOCKED_HOST' | 'DNS_RESOLUTION_FAILED'` and an optional `reason` string (for diagnostics; never echoed back unsanitized).

## `index.ts` integration

After Zod validation:
```ts
let safe;
try {
  safe = await assertSafeUrl(parsed.data.url, { resolveDns: Deno.resolveDns?.bind(Deno) });
} catch (e) {
  if (e instanceof SsrfError) {
    return errorResponse(400, e.code, e.code === 'BLOCKED_HOST' ? 'URL is not allowed' : e.code === 'DNS_RESOLUTION_FAILED' ? 'Could not resolve host' : 'Invalid URL');
  }
  throw e;
}
const warnings = ['stub: extraction not yet implemented'];
if (!safe.dnsChecked) warnings.push('dns_check_skipped');
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
    stage: 'ssrf-guard',
  },
  warnings,
};
```

## `ssrf_test.ts` (Deno, no real network)

Fake resolver only (object passed via opts). Covers:

**Normalization (allow):**
- `https://example.com` → `https://example.com/`
- `https://example.com:443/x` → `https://example.com/x` (default port stripped by URL)
- `https://example.com:8443/x` → unchanged, allowed
- `https://EXAMPLE.com/Path?Q=B&A=1#frag` → hostname lowercased, fragment dropped, **path case + query order + query case preserved**
- `https://example.com/a//b` → slashes preserved
- `https://example.com/path#secret` → `https://example.com/path` (manual-test parity)

**Block — literals:** `http://localhost`, `http://127.0.0.1`, `http://0.0.0.0`, `http://10.0.0.1`, `http://192.168.1.1`, `http://169.254.169.254`, `http://[::1]/`, `http://[fc00::1]/`, `http://[fe80::1]/`, `http://[::ffff:127.0.0.1]/`, `http://2130706433/`, `http://0177.0.0.1/`, `http://0x7f000001/`.

**Block — userinfo:** `https://user:pass@example.com/` → `BLOCKED_HOST` reason `userinfo`. Verify it is **rejected**, never returned as a sanitized URL.

**Block — port:** `https://example.com:22/` → `BLOCKED_HOST` reason `port_not_allowed`. Also `http://example.com:8080/` allowed.

**Block — suffix:** `http://app.internal/`, `http://db.lan/`, `http://x.home.arpa/`.

**DNS behavior (fake resolver):**
- A-only host (A=`93.184.216.34`, AAAA rejects NotFound) → allowed.
- AAAA-only host (A NotFound, AAAA=`2606:2800:220:1:248:1893:25c8:1946`) → allowed.
- A resolves private (`10.0.0.1`) → `BLOCKED_HOST` reason `dns_resolves_private`.
- AAAA resolves to `::1` → `BLOCKED_HOST`.
- Both reject with generic Error → `DNS_RESOLUTION_FAILED`.
- Both reject with `NotCapable` → allowed, `dnsChecked: false`.
- IPv6 returned without brackets (`fc00::1`) → still classified as private.

## Response shape (additive only)

```ts
{
  success: true,
  predictions: null,                       // unchanged
  metadata: {
    analyzed_url: '<normalized>',          // now normalized URL
    normalized_url: '<normalized>',        // NEW additive
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: 'stub',                        // unchanged
    timestamp: '...',
    used_url_context: false,
    used_google_search: false,
    used_firecrawl: false,
    phase: 4,                              // diagnostic-only
    stage: 'ssrf-guard',                   // diagnostic-only
  },
  warnings: [
    'stub: extraction not yet implemented',
    // 'dns_check_skipped' appended only when runtime DNS unavailable
  ]
}
```

Error envelope unchanged; new codes `BLOCKED_HOST` / `DNS_RESOLUTION_FAILED` are already handled by Phase 3's V2 destructive toast.

## README additions

- Phase 4A = preflight only; **no network fetch happens in this phase**.
- DNS-skip on `NotCapable` is acceptable **only because** there is no fetch. Once Phase 4B introduces real fetching, DNS resolution + per-redirect re-check at connect time become **mandatory**.
- TOCTOU protection, timeout, max-size, redirect cap, content-type allowlist → Phase 4B.
- Brand handling: lookup only during Analyze; create-on-Save after admin confirms (Phase 8).

## Phase roadmap (locked)

1 ✅ → 2 ✅ → 3 ✅ → **4A (preflight + normalization)** → **4B `validateAndFetchUrl` (8s timeout, 2MB streaming cap, ≤3 redirects with per-hop re-normalize + DNS/IP re-check (TOCTOU), content-type allowlist `text/html`/`application/xhtml+xml`, safe structured result, optional broader public-reserved enforcement)** → 5 exact-page extractor (must call 4B, never raw `fetch`) → 6 weak-signal detector + Firecrawl fallback → 7 Gemini URL Context + structured output → 8 brand suggestion + Save-time parent brand handling → 9 admin smoke test → 10 logging (deferred) → 11 compare mode (deferred).

## Stop-and-show after implementation

1. Diff of the 6 files.
2. `supabase--test_edge_functions` output for `analyze-entity-url-v2` (green, no network).
3. Admin + v2 + `https://example.com` → 200, `metadata.normalized_url === 'https://example.com/'`, `phase: 4`, `predictions: null`.
4. Admin + v2 + `http://localhost` → 400 `BLOCKED_HOST`.
5. Admin + v2 + `http://169.254.169.254` → 400 `BLOCKED_HOST`.
6. Admin + v2 + `https://user:pass@example.com/` → 400 `BLOCKED_HOST` reason `userinfo`.
7. Admin + v2 + `https://example.com/path#secret` → 200, `metadata.normalized_url === 'https://example.com/path'`.
8. Confirmation: `predictions: null`, V1 byte-identical, `CreateEntityDialog.tsx` byte-identical to post-Phase-3, `useAnalyzeUrlEngine.ts` untouched, no DB/RPC/config/secrets changes.

Awaiting approval to switch to build mode.
