## Phase 1.8c.5 — Firecrawl request/response shape diagnostic (final)

**Scope:** Diagnostic-only logging. No behavior changes (no timeout/budget/parser/Gemini/Zod/merge/guard/V1/frontend/DB/non-Amazon/Phase 2 changes, no new wire-response field).

This revision folds in **all** ChatGPT + Codex refinements from both rounds:

- `request_id` correlation, `call_site: "main" | "recovery"`
- UTF-8 byte sizes via `TextEncoder`
- Safe error-shape fields (`error_kind`, `aborted`, `parse_ok`, `body_parse_failed`)
- Capped metadata key list (50 keys × 40 chars, names only)
- Exported pure helper so tests can call it without runtime coupling
- **New (Codex round 2):** `data_unwrap_path` enum so logs are unambiguous about which object was treated as the Firecrawl data payload
- **New (Codex round 2):** explicit metadata presence booleans
- **New (ChatGPT round 2):** `url_host` derived from the already-validated/normalized URL the code uses for the actual Firecrawl request (not from a raw user string)
- Designed for easy removal: single helper + single `console.log` call site per Firecrawl invocation, gated behind a `FIRECRAWL_SHAPE_DIAG_ENABLED` module constant (default `true`) so the whole feature flips off via one boolean when the investigation is done

---

### 1. New exported pure helper

In `supabase/functions/analyze-entity-url-v2/firecrawl.ts`:

```ts
export function buildFirecrawlShapeDiagnostic(input: {
  requestArgs: {
    urlHost: string;              // host of already-normalized URL, never raw
    urlHasQueryString: boolean;
    isAmazon: boolean;
    formats: string[];
    onlyMainContent: boolean;
    waitForMs: number;
    apiTimeoutMs: number;
    localTimeoutMs: number;
    maxHtmlBytes: number;
    payloadKeys: string[];        // Object.keys(body).sort()
  };
  response?: {
    httpStatus: number;
    contentType: string | null;
    body: unknown;                // parsed; helper inspects shape only
    parseOk: boolean;
    bodyParseFailed: boolean;
  };
  failure?: {
    errorKind: "http_error" | "timeout" | "parse_error" | "network_error" | "unknown";
    aborted: boolean;
  };
  htmlOversizeDropped: boolean;
  durationMs: number;
  context: { requestId: string; callSite: "main" | "recovery" };
}): Record<string, unknown>
```

Pure: no I/O, no `console.log` inside. `runFirecrawlScrape` calls it once per invocation (success + failure + timeout paths) and logs exactly one line with the stable prefix:

```
[analyze-entity-url-v2] firecrawl.shape_diag { ... }
```

Gated by a single module-level `FIRECRAWL_SHAPE_DIAG_ENABLED = true` constant for easy disable later.

### 2. Minimal signature addition to `runFirecrawlScrape`

Add optional `diagContext?: { requestId: string; callSite: "main" | "recovery" }` to `FirecrawlOpts`. Defaults to `{ requestId: "unknown", callSite: "main" }` when omitted, so the 20+ existing tests in `firecrawl_test.ts` keep working unchanged. Wire it from the two `runFirecrawlScrape` call sites in `index.ts` (main path → `"main"`, fetch-recovery path → `"recovery"`), passing the existing per-invocation `request_id`.

`url_host` is computed inside `runFirecrawlScrape` from the **already-validated** URL the function is about to send to Firecrawl (the same value used for `fetch`), via `new URL(targetUrl).host`. Never from a raw caller string.

### 3. Final field list

**Correlation / context**
- `request_id`, `call_site`, `is_amazon`, `url_host`, `url_has_query_string`

**Request shape**
- `endpoint: "v2/scrape"` (literal, no host string), `method_used: "scrape"`
- `formats_requested`, `only_main_content`, `wait_for_ms`
- `api_timeout_ms`, `local_timeout_ms`, `max_html_bytes`
- `proxy_setting_present`, `location_setting_present`, `cache_setting_present`
- `request_payload_keys` (keys only, sorted)

**Response shape**
- `http_status`, `content_type`
- `firecrawl_success` (`body.success ?? null`)
- `firecrawl_error_present` (boolean)
- `firecrawl_error_code` — `body.error.code` / `body.code` only if a short stable string (≤40 chars, matches `/^[A-Za-z0-9_\-.]+$/`), else `null`. **Never** raw error message text.
- `proxy_used` (`metadata.proxyUsed ?? null`)
- `cache_state` (`metadata.cacheState ?? null`)
- `credits_used` (`body.creditsUsed ?? null`)
- `response_keys` (sorted), `data_keys` (sorted, only when data object found)
- **`data_unwrap_path`** — `"body.data" | "body.result" | "body" | "none"` — records which object the diagnostic treated as the Firecrawl data payload (so we can tell shape-mismatch bugs apart from genuinely empty responses)
- `has_metadata`, `has_markdown`, `has_html`, `has_raw_html`, `has_content`, `has_json`, `has_links`, `has_screenshot`, `has_summary`
- `metadata_key_count` (full count)
- `metadata_keys` — first **50** sorted keys, each truncated to **40 chars** (names only)
- **Explicit metadata presence booleans** (key existence only, no values):
  - `metadata_title_present`
  - `metadata_description_present`
  - `metadata_og_title_present` (matches both `ogTitle` and `og:title`)
  - `metadata_og_description_present` (matches both `ogDescription` and `og:description`)
- `markdown_bytes`, `html_bytes`, `raw_html_bytes`, `content_bytes` — measured with `new TextEncoder().encode(value).length` (UTF-8, not `.length`)
- `json_key_count` (count of keys in `data.json` if object, else 0)
- `html_oversize_dropped` (boolean)
- `duration_ms`

**Failure-shape fields** (always populated; null on success)
- `error_kind`, `aborted`, `parse_ok`, `body_parse_failed`

### 4. Privacy guarantees (enforced in helper + asserted in tests)

NEVER logged: raw `title` / `description` / `ogTitle` / `ogDescription` / `ogImage` values; raw `markdown` / `html` / `rawHtml` / `content` / `summary` / `json` values; raw Firecrawl `error.message` text; full URLs with query strings (host only); API key; `Authorization` header; any nested metadata values.

### 5. Files touched

- `supabase/functions/analyze-entity-url-v2/firecrawl.ts` — add helper, add optional `diagContext` to `FirecrawlOpts`, add `FIRECRAWL_SHAPE_DIAG_ENABLED` constant, emit one `console.log` per invocation across success + failure + timeout paths. No changes to request body, formats, timeouts, return shape, or error codes.
- `supabase/functions/analyze-entity-url-v2/index.ts` — pass `diagContext: { requestId, callSite: "main" | "recovery" }` at the two existing `runFirecrawlScrape` call sites. No other changes.
- `supabase/functions/analyze-entity-url-v2/firecrawl_test.ts` — add these tests:
  1. Success path: helper output contains expected booleans/key counts; raw `title`/`description`/`markdown`/`html` values absent from JSON-stringified output
  2. Non-2xx failure: request shape + `http_status` + `error_kind: "http_error"`
  3. Timeout: request shape + `aborted: true` + `error_kind: "timeout"`
  4. Body parse failure: `body_parse_failed: true` + `parse_ok: false` + `error_kind: "parse_error"`
  5. `metadata_keys` capped to 50 entries, each ≤40 chars, values absent
  6. `firecrawl_error_code` accepts `"INSUFFICIENT_CREDITS"` but rejects long/raw error message → `null`
  7. UTF-8 byte sizes correct for multi-byte chars (`"日本語"` → 9 bytes, not 3)
  8. `call_site` and `request_id` propagated from `diagContext`
  9. `data_unwrap_path` returns `"body.data"` for `{ data: {...} }`, `"body.result"` for `{ result: {...} }`, `"body"` for flat shape, `"none"` for empty
  10. Metadata presence booleans correctly detect both `ogTitle` and `og:title` variants; absent when key missing
  11. `url_host` is derived from a normalized URL (test passes a URL with query string and asserts `url_has_query_string: true` and host-only output)
- `.lovable/plan.md` — append the Phase 1.8c.5 entry.

### 6. Explicitly NOT changing

- Firecrawl request body, `formats`, `waitFor`, `timeout`, `onlyMainContent`
- `NORMAL_FIRECRAWL_*` / `HIGH_PRIORITY_FIRECRAWL_*` constants, `DEFAULT_MAX_HTML_BYTES`, Amazon 4 MiB bump
- `firecrawl_recovery.ts` logic, `index.ts` orchestration / budget / eligibility
- `schema.ts` (no new wire field)
- Gemini, parser, Zod, merge, guard, recovery gate
- V1, frontend, DB, Phase 2

### 7. After it ships

You retest 2–3 Amazon URLs, grep `firecrawl.shape_diag` in edge-function logs, and we use them to decide between (a) proceeding straight to Phase 2, (b) fixing how we consume Firecrawl metadata in our pipeline, (c) adjusting Firecrawl request settings, or (d) emailing Firecrawl with concrete request/response evidence (formats sent, `data_unwrap_path`, metadata presence booleans, bytes, proxy/cache state).

When the investigation is done, flip `FIRECRAWL_SHAPE_DIAG_ENABLED` to `false` (one-line change) to silence the logs without removing the helper.