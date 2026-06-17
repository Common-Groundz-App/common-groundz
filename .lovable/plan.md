## What the logs prove

Request `8a744df6-0825-4bd0-9275-b984b8acf420`:
- Direct fetch → `FETCH_TOO_LARGE` on Amazon
- Firecrawl recovery → weak/no usable extraction
- Primary Gemini → `503 UNAVAILABLE`
- Search-only fallback → ran (`attempted: true`, `skip_reason: null`), but `GEMINI_TIMEOUT` at ~8s
- V2 preserved original `FETCH_TOO_LARGE`; UI showed the hard "V2 engine failed" modal

The fallback wiring is correct. Two backend issues remain: the 8s window is too tight for Google-Search-grounded Gemini during model high-demand, and the fallback prompt was carrying noisy page evidence instead of behaving like V1.

## Phase 1 — Backend only (this change)

### 1A. Raise search-only fallback timeout

`supabase/functions/analyze-entity-url-v2/gemini.ts`:
- `SEARCH_FALLBACK_TIMEOUT_MS`: `8_000` → `14_000`
- `SEARCH_FALLBACK_BUDGET_BUFFER_MS`: keep `1_000`

`supabase/functions/analyze-entity-url-v2/index.ts`:
- Keep `REQUEST_TOTAL_BUDGET_MS = 45_000` + budget guard.
- Skip rule unchanged: `remainingMs < SEARCH_FALLBACK_TIMEOUT_MS + SEARCH_FALLBACK_BUDGET_BUFFER_MS` → `budget_exhausted`.
- Skip-reason precedence unchanged: `prior_prediction_valid` → `firecrawl_succeeded` → `primary_gemini_succeeded` → `gemini_not_configured` → `budget_exhausted` → `null`.

### 1B. New sanitized fallback-evidence URL helper

Add `sanitizeFallbackEvidenceUrl(rawUrl: string): string | null` in `host_hints.ts` (or a small new util colocated with it). Rules, applied for ALL hosts:

1. Parse with `new URL(rawUrl)` in a try/catch. On parse failure → return `null`.
2. **Protocol allowlist (defense in depth):** if `url.protocol !== "http:" && url.protocol !== "https:"` → return `null`. This explicitly rejects `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, and any custom scheme even if a future caller passes unvalidated input.
3. Strip `username`, `password`, `search` (query string), and `hash` (fragment).
4. If host matches an Amazon product URL with extractable ASIN (`/dp/<ASIN>` or `/gp/product/<ASIN>`) → return canonical `https://<host>/dp/<ASIN>/`.
5. Otherwise → return `${url.origin}${url.pathname}` (no trailing-slash normalization beyond what `URL` produces).
6. Enforce 512-char cap. If over the cap after step 4/5 → return `null` (do not truncate mid-path).

The search-only fallback prompt's `url` field uses ONLY this helper's output. `canonicalizeAmazonUrl` is no longer used to build the fallback prompt URL. If the helper returns `null`, the `url` field is omitted from the prompt entirely (raw input is never sent).

### 1C. Clean search-only fallback evidence (whitelist + caps, all untrusted)

When `searchOnly: true`, build a separate minimal prompt path that ONLY contains this explicit whitelist. Every field is framed as untrusted evidence (same framing already used for slug); Zod, recovery gate, and merge rules remain authoritative and unchanged.

| Field | Source | Cap |
|---|---|---|
| `url` | `sanitizeFallbackEvidenceUrl(safe.url)` | 512 chars (helper enforces) |
| `host` | `new URL(safe.url).host` | 128 chars |
| `amazon_path_slug` | `extractAmazonPathSlug(safe.url)` (when non-null) | 120 chars (already sanitized) |
| `extract_metadata.title` | metadata title if already available in V2 | 200 chars |
| `extract_metadata.description` | metadata description if already available in V2 | 400 chars |
| `extract_metadata.site_name` | OG/twitter site_name if already available | 80 chars |
| `extract_metadata.mapped_type` | `extract.metadata.mapped_type` | enum |

EXCLUDED (never sent to the fallback prompt):
- raw direct-fetch HTML
- Firecrawl HTML
- Firecrawl markdown
- bot-wall content / large text bodies
- raw model output
- query strings, fragments, username/password (any host)
- non-http(s) URL schemes
- image URLs (any list)
- arbitrary OG/Twitter/JSON-LD blobs
- headers, cookies, redirect chains

If a whitelisted field is not already available inside the V2 Edge Function, it is simply omitted — no new frontend/backend dependency, no extra fetch.

Same fallback contract preserved: same model, `tools: [{ google_search: {} }]` only, no `url_context`, no `responseMimeType`, same tolerant parser, same Zod schema, same recovery gate, same merge rules, same `gemini_search_fallback` source label.

### 1D. Logging / diagnostics

Unchanged sanitization rules. Specifically:
- Do NOT log whitelisted metadata values (no titles, descriptions, image URLs, full URLs, slugs, HTML, markdown, or prompt text in diagnostics).
- Continue logging only: `request_id`, `attempted`, `ok`, `skip_reason`, `duration_ms`, `final_prediction_source`, `original_error_code`, plus `host` (already allowed in `trace`).
- If fallback fails, preserve the original recovery error and record fallback telemetry (already implemented).

## Phase 2 — Frontend metadata-only fallback (deferred)

Not in this change. When revisited, must be clearly labeled "AI details unavailable; using URL metadata" (not AI analysis), may only prefill safe fields (name/title, website URL, preview image(s), source domain). MUST NOT prefill type/category/brand/price/tags/description. Planned/approved separately.

## Out of scope

V1, DB, pricing, Firecrawl config, direct-fetch byte cap, Zod schema, recovery gate, merge rules, frontend modal, Gemini model, `responseMimeType`, parser candidates, save flow, RLS/auth, model retries.

## Tests

Add/update in `supabase/functions/analyze-entity-url-v2/gemini_search_fallback_test.ts` (+ small companion for the URL sanitizer and prompt builder):

- `SEARCH_FALLBACK_TIMEOUT_MS === 14_000`, buffer `1_000`.
- Budget exhaustion still triggers `skip_reason: "budget_exhausted"` and does NOT call Gemini.
- `sanitizeFallbackEvidenceUrl`:
  - Amazon `/dp/<ASIN>?...&ref=...` → `https://www.amazon.in/dp/<ASIN>/`
  - Amazon `/gp/product/<ASIN>/...` → `https://<host>/dp/<ASIN>/`
  - Non-Amazon `https://www.nykaa.com/foo/bar?utm=...#frag` → `https://www.nykaa.com/foo/bar`
  - URL with `user:pass@` → credentials stripped
  - `javascript:alert(1)` → `null`
  - `data:text/html,<x>` → `null`
  - `file:///etc/passwd` → `null`
  - `ftp://example.com/x` → `null`
  - Invalid URL string → `null`
  - >512 chars after normalization → `null`
- Search-only fallback prompt EXCLUDES: raw HTML, Firecrawl markdown, Firecrawl HTML, large text bodies, image URLs, raw OG/JSON-LD blobs, query strings, fragments.
- Search-only fallback prompt INCLUDES (when available): sanitized URL, host, sanitized Amazon slug, whitelisted metadata fields with caps enforced.
- Length caps actually truncate oversize whitelisted metadata fields (title/description/site_name).
- Valid fallback passes Zod + recovery gate and merges.
- Invalid/empty fallback preserves the original recovery error.
- Non-Amazon success path unchanged (`primary_gemini_succeeded` skip reason).
- Tool-isolation test stays green: only `google_search`, no `url_context`, no `responseMimeType`.
- Diagnostics/log line still contains no raw metadata values.
- Non-Amazon URL with query params produces a fallback prompt whose `url` field has NO `?` or `#`.

Run `supabase--test_edge_functions` on `analyze-entity-url-v2`. Deploy.

## Acceptance / retest

For each URL capture: `request_id`, primary Gemini `attempted/ok/error_code`, `search_fallback_attempted/ok/error/duration_ms/skip_reason`, `final_prediction_source`, `merge.path`, whether the AI confirmation modal renders, reasonableness of name/brand/description/images.

1. Moxie Beauty Amazon URL (current failure)
2. Root Hair Serum Amazon URL (earlier failure)
3. A clean Amazon `/dp/<ASIN>/` URL
4. A currently-successful non-Amazon URL (Nykaa / Goodreads)