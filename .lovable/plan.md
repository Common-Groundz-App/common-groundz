v8a — approved scope with all codex + chatgpt notes folded in. **v8a ships now.** v8b/v8c/v8d stay deferred behind flags.

**Only file touched:** `supabase/functions/enrich-candidate-image/index.ts` (optional `soft_redirect.ts` helper if extraction grows past ~50 lines).

**Untouched:** Gemini prompt/model, `search-entity-candidates`, URL Analyze, dedup, media reset, `CandidateSource` union, all frontend, Firecrawl, Google CSE, brand-logo lookup.

**Verified:** `extractImage()` (lines 368–386) is a clean single loop with a final `return null`. Nothing to fix there.

---

## 1. Refactor attempt flow so soft-redirect can see the HTML

Current `runAttempt()` discards HTML after `extractImage()` returns null. Split it:

```
fetchHtmlAttempt(url, deadline)          → { finalUrl, html } | { errorCode }
extractImageFromHtml(finalUrl, html)     → { url, method } | null
extractSoftRedirectTarget(finalUrl, html)→ { target, kind } | null
```

Don't bolt soft-redirect onto the existing `runAttempt()` — do the split first, then compose.

## 2. Deterministic fallback order

```
1. fetchHtmlAttempt(originalUrl)
2. extractImageFromHtml(...)             → if found → success (winningAttempt="direct")
3. extractSoftRedirectTarget(...)        → if target present AND passes guards:
     assertSafeUrl(target)
     fetchHtmlAttempt(target)            (one hop only)
     extractImageFromHtml(...)           → if found → success (winningAttempt="soft_redirect")
4. clean-URL retry (existing v7 rule: primary was no_image OR invalid_content_type,
   original URL had a non-empty query, ≥1500 ms budget remains)
5. return no_image
```

Soft-redirect runs **before** clean-URL retry. All three winning branches return `source: 'page_metadata'`. No new `CandidateSource` value.

## 3. Soft-redirect target extraction (first match wins)

**Meta refresh** (case-insensitive, tolerate whitespace, optional quotes):
```
<meta http-equiv="refresh" content="N; url=X">
```

**Explicit JS redirect list** — one literal regex per pattern, tolerate whitespace and optional trailing `;`, support **both single and double quotes** (per chatgpt). No eval, no generic JS parsing:
```
window.location = "X"        window.location = 'X'
window.location.href = "X"   window.location.href = 'X'
location.href = "X"          location.href = 'X'
window.location.assign("X")  window.location.assign('X')
location.assign("X")         location.assign('X')
window.location.replace("X") window.location.replace('X')
location.replace("X")        location.replace('X')
```
(Typo from prior draft fixed: `location.replace("X")` — closing paren present.)

**Canonical** — follow only when **all** hold:
- **Host rule:** `URL(X).hostname === finalUrl.hostname`, OR `finalUrl.hostname` is in `{vertexaisearch.cloud.google.com, www.google.com, duckduckgo.com}`.
- **Meaningful-difference rule:** `URL(X).pathname !== finalUrl.pathname`. If only query differs, skip — clean-URL retry (step 4) handles that.
- **Shallow-root rule:** target path is not `/`, `/home`, `/products`, `/collections`, or `/category` with ≤1 additional segment.

## 4. Self-referential guard

Before fetching the soft-redirect target, compare against **both** the original URL and the direct-fetch `finalUrl`:
```
normalizeForCompare(u) = URL with hash stripped, trailing slash normalized, hostname lowercased
skip if normalizeForCompare(target) === normalizeForCompare(originalUrl)
skip if normalizeForCompare(target) === normalizeForCompare(finalUrl)
```

## 5. Safety envelope (unchanged from v7)

- **One hop maximum.** No recursion.
- **`assertSafeUrl(target)`** before the soft-redirect fetch.
- **Same 6 s total budget** shared across all steps. Skip step 3 if <1500 ms remains.
- **Same per-request rate-limit unit** — soft-redirect fetch does not consume an extra quota unit.
- **Same cache key** (normalized original source URL). Final winning result cached under it.
- **Same `page_metadata` source label** regardless of which step won.

## 6. Structured telemetry — one log line per call, cache hits included

**Fresh call:**
```jsonc
{
  event: "enrich_candidate_image",
  host: "example.com",           // host only — never full URL, query, HTML, or PII
  cached: false,
  finalOutcome: "success" | "no_image" | "unsafe_url" | "invalid_content_type" | "timeout" | "blocked" | "rate_limited",
  winningAttempt: "direct" | "soft_redirect" | "clean_url_retry" | null,
  winningMethod: "json_ld" | "og" | "twitter" | "image_src" | null,
  totalLatencyMs: 1234,
  attempts: [
    { kind: "direct",        errorCode: "no_image", method: null,      latencyMs: 120, softRedirectKind: null },
    { kind: "soft_redirect", errorCode: null,       method: "json_ld", latencyMs: 480, softRedirectKind: "meta_refresh" }
  ]
}
```

**Cache hit** — same top-level shape, `attempts` omitted or `[]`. `finalOutcome` reflects the **cached result** (positive or negative), per codex:
```jsonc
// positive cache hit
{ event: "enrich_candidate_image", host: "example.com", cached: true,
  finalOutcome: "success", winningAttempt: "cache", winningMethod: "og", totalLatencyMs: 3 }

// negative cache hit — log the cached outcome, not "success"
{ event: "enrich_candidate_image", host: "example.com", cached: true,
  finalOutcome: "no_image", winningAttempt: "cache", winningMethod: null, totalLatencyMs: 2 }
```

`softRedirectKind` ∈ `"meta_refresh" | "js" | "canonical" | null`. Both success and failure log.

## Verification (manual, after deploy)

Run ~10 searches spanning:
- Vertex/Google interstitial results.
- Retailer product pages (Amazon, Nykaa, Ulta, Sephora).
- Brand-owned product pages.
- One page known to require JS rendering.

From the telemetry alone, report:
- `finalOutcome` distribution.
- `winningAttempt` distribution (direct / soft_redirect / clean_url_retry / cache).
- Top failing hosts + `errorCode`.
- Whether `meta_refresh` / `js` / `canonical` soft redirects actually fired.

That data decides whether v8b (Firecrawl) is worth flipping on next turn.

## Files touched (v8a)

- `supabase/functions/enrich-candidate-image/index.ts` — attempt-flow split, soft-redirect step, self-ref guard, telemetry (fresh + cached, positive + negative).
- `supabase/functions/enrich-candidate-image/soft_redirect.ts` — optional, only if target-extraction grows past ~50 lines. Pure functions, no I/O.

Nothing else changes.

---

# v8b, v8c, v8d — recorded, NOT implemented this turn

**v8b — Firecrawl fallback** (flag `entity_extraction.search_image_firecrawl_enabled`, off). Runs after direct + soft_redirect fail. Extract `scrapeMetadata(url, signal)` from `analyze-entity-url-v2/firecrawl.ts` into a shared helper. Budget bumps to 8 s for this path only. Returns existing `source: 'firecrawl'`. Graceful off when `FIRECRAWL_API_KEY` unset.

**v8c — Google CSE image search** (flag `entity_extraction.search_image_search_enabled`, off). Runs after direct + soft_redirect + Firecrawl fail. `searchType=image, num=3, safe=active`, query `${brand} ${name} ${variant} product`. HEAD probe + logo/banner filter + `isValidPageImageUrl`. Returns `source: 'google_images'`. Draft Review chip: "From image search — verify". Never overwrites `page_metadata` or `firecrawl`.

**v8d — Brand logo lookup for Search rows** (flag `entity_extraction.search_brand_logo_lookup_enabled`, off). New edge function `resolve-brand-logo` (POST `{brand}` → `{logoUrl?, source}`), reusing `analyze-entity-url-v2/brand_logo_lookup.ts` (promoted to `_shared/`). Called from client after `SearchEntryPanel` renders, once per unique visible brand. In-memory cache by normalized brand, 24 h TTL. **Brand logo never used as a product row thumbnail.**

## Out of scope for all phases

URL Analyze. Gemini prompt/model/search backend. Dedup rules (v7 tri-state). Search Apply media reset. `google_grounding` in row thumbnails. New `CandidateSource` values. Client-side image ladder.
