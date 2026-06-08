# Firecrawl Deterministic Recovery Patch — `analyze-entity-url-v2`

(Pre-Phase-8 hotfix. Not Gemini merge. Fixes how V2 consumes Firecrawl's own scrape output.)

## Diagnosis

Latest edge logs for the Nykaa URL:

```
fetch failed { code: "FETCH_BAD_STATUS" }
firecrawl recovery failed: weak extraction { code: "FETCH_BAD_STATUS", durationMs: 3028 }
gemini { ok: true, used_url_context: true, used_google_search: true }
```

Firecrawl is **not** failing — it returns rich `metadata` (`og:type=product`, `og:title`/`ogTitle`, `og:image`/`ogImage`, `product:price:amount`, `product:price:currency`) and full product `markdown` (H1, price, description). But V2's Firecrawl client only requests/keeps `html`/`rawHtml`, and `extractFromHtml()` only parses JSON-LD/OG inside HTML — recovery returns `null` and V2 surfaces the original `FETCH_BAD_STATUS`. Gemini works (Phase 7.1) but Phase 7 is diagnostic-only.

## Scope

Touches only:
- `supabase/functions/analyze-entity-url-v2/firecrawl.ts`
- `supabase/functions/analyze-entity-url-v2/index.ts`
- new file `supabase/functions/analyze-entity-url-v2/firecrawl_recovery.ts`
- `supabase/functions/analyze-entity-url-v2/firecrawl_test.ts` and new `firecrawl_recovery_test.ts`

**Out of scope (do not touch):** V1 (`analyze-entity-url`), frontend, DB/schema/migrations, SSRF, fetcher, `extractor.ts`, weak-signal rules, host hints, Gemini client, prompt generator, V2 response envelope/error union, Phase 8.

## Changes

### 1) Preserve Firecrawl `markdown` and `metadata`

In `firecrawl.ts`:
- Change request `formats` from `["html","rawHtml"]` → **`["html","markdown"]`**.
- Response parsing stays **tolerant of `rawHtml`**: `html = data.html ?? data.rawHtml ?? ""`.
- Extend `FirecrawlSuccess` with `markdown: string | null` and `metadata: Record<string, unknown> | null`.
- 2 MB cap continues for `html`. Same cap for `markdown` (oversize → `markdown: null`, scrape does not fail).
- **Usability rule:** treat scrape as usable if **any one** of `html` (non-empty), `markdown`, or `metadata` is present. Do not fail just because `html` is missing — this patch exists specifically to recover from metadata/markdown.
- `metadata` and `markdown` are **internal** — never returned in V2 response, never logged in full.
- All other behavior preserved: `onlyMainContent: false`, `waitFor: 1500`, `timeout`, error codes, `safeBaseUrl`.

### 2) New deterministic extractor `firecrawl_recovery.ts`

Exports `extractFromFirecrawl({ metadata, markdown, finalUrl })` returning the same `ExtractResult` shape as `extractFromHtml`.

**Type the return against the Phase 5/6 extractable subset only**, not the full canonical list. Allowed emit types:

```
product, book, movie, tv_show, course, app, game, food, place
```

This typing prevents future drift even though the initial map only emits a subset.

**Product-first conservative map** (matching low-risk OG types already handled by `extractor.ts`):

| signal | emitted type | suggested_category_path |
|---|---|---|
| `og:type = product` | `product` | `"product"` |
| any `product:*` key present (no `og:type`) | `product` | `"Product"` |
| `og:type = book` / `books.book` | `book` | raw og:type |
| `og:type = video.movie` | `movie` | `"video.movie"` |
| `og:type = video.tv_show` / `video.episode` | `tv_show` | raw og:type |
| **anything else** (`article`, `website`, `profile`, `music.*`, `restaurant.*`, `business.*`, `place`, unknown) | **weak / null** | — |

Notes:
- **Do not** map `restaurant.restaurant` to `food`. In V2 taxonomy, restaurants/venues are `place`, not `food` (only recipes are food). For this hotfix do **not** add restaurant/business/place mappings at all — Nykaa doesn't need them and they introduce edge cases. They can be added later with fixtures.
- Type comes **only** from structured metadata. Never infer from markdown keywords ("Add to bag", "Price ₹…").
- `suggested_category_path` is the **raw og:type string** when type came from `og:type`; `"Product"` when type came only from `product:*`; never fabricated.

**Metadata key normalization** (`getMeta(m, keys)`):
- Key matching is **case-insensitive** (lowercase both sides on key comparison).
- Values are **trimmed only** — casing preserved. Never lowercase names, brands, descriptions, URLs, or image paths (`"DIOR Homme Intense Eau De Parfum Intense"` must stay as-is).
- Returns first non-empty string match.

Lookups:
- name: markdown H1 in main region → `["og:title","ogTitle","title"]`
- description: `["og:description","ogDescription","description","twitter:description"]` → first markdown paragraph
- image: `["og:image","ogImage","twitter:image"]` → first http(s) markdown image; `safeAbsoluteUrl(..., finalUrl)`; drop `javascript:`/`data:`
- brand: `["og:brand","product:brand"]` if present
- currency: `["product:price:currency","og:price:currency"]`
- price: see (3)

**Markdown safety.** Parse markdown only within the **main product region** = start through the first `## ` heading (or first 4 KB, whichever is smaller). Prevents "Customers also viewed" leaking.

**Prediction shape** (matches V2 exactly): `type`, `name`, `description`, `category_id: null`, `matched_category_name: null`, `tags: []`, `suggested_category_path`, `confidence: 0.75`, `reasoning: "Extracted from Firecrawl metadata/markdown"`, `image_url`, `images: [{ url }]`, `additional_data: { brand?, price?, currency? }`.

**Source tags** internal only: `firecrawl:metadata:og:type`, `firecrawl:markdown:h1`, etc.

### 3) Conservative price handling

- Metadata price from `["product:price:amount","og:price:amount"]` (numeric coerce).
- Markdown price only from the main product region (see §2), matching `(?:₹|\$|€|£|USD|INR|EUR|GBP)\s?([\d,]+(?:\.\d+)?)` near/above first paragraph.
- If both present and differ by >5% → **omit `price`**, keep `currency`.
- If only one present → use it.
- Never inject MRP/List Price when a sale price is also visible.

### 4) Wire into both Firecrawl paths in `index.ts`

- **Path A (direct fetch failed → Firecrawl):**
  1. `extractFromHtml(fc.html, base)`
  2. If `predictions === null`, call `extractFromFirecrawl({ metadata, markdown, finalUrl: base })`
  3. If either yields predictions → success with `used_firecrawl: true`, `stage: "firecrawl-recovered"`, `firecrawl.improved: true`
  4. Only if both fail → return the original fetch error unchanged

- **Path B (direct fetch succeeded but weak):**
  1. Existing `extractFromHtml` + `isStrictlyBetter` check stays
  2. If still not better, attempt `extractFromFirecrawl(...)`; treat non-null as strictly better than weak/null direct extract
  3. Otherwise keep current `firecrawl_no_improvement` behavior

Gemini eligibility, Phase 7 diagnostic invocation, and strong-direct skip behavior are **unchanged**.

### 5) Privacy / logging

- `markdown` and `metadata` never serialized into V2 response.
- **Logs stay minimal** — existing codes and `durationMs` only. **Do not** log raw metadata, raw markdown, product names, descriptions, image URLs, prices, page URLs, source tag names/values, headers, or API keys. No new log lines added for this patch beyond changing the existing `firecrawl recovery failed: weak extraction` outcome.
- V2 success/error envelope keys unchanged. V1 untouched.

## Tests

`firecrawl_test.ts` updates:
- Body sent to Firecrawl contains `formats: ["html","markdown"]`.
- 200 with `metadata` + `markdown` populated → `FirecrawlSuccess` exposes both.
- Backward-compat: 200 with only `rawHtml` (no `html`) → succeeds, `html` populated from `rawHtml`.
- 200 with only `metadata` (no `html`, no `markdown`) → succeeds, `html === ""`, `metadata` populated.
- 200 with only `html` → `markdown: null`, `metadata: null`, ok.
- Oversize markdown → `markdown: null`, scrape still succeeds.
- 200 with all three missing/empty → still fails as malformed.
- Existing 402, 5xx, timeout, oversize html, malformed JSON, `safeBaseUrl` tests keep passing.

New `firecrawl_recovery_test.ts` (no network), Nykaa-shaped fixture from user's playground JSON:
- Direct HTML returns null; `extractFromFirecrawl` returns a `product` prediction:
  - `name` from markdown H1, **casing preserved** (`"DIOR Homme Intense Eau De Parfum Intense"`)
  - `description` from `og:description`
  - `image_url` from `og:image`
  - `currency: "INR"`
  - `additional_data.price` **omitted** (metadata `14900` vs markdown `10600` >5%)
  - `suggested_category_path === "product"`
- Variant with `ogTitle` / `ogImage` camel-case only → same extraction; value casing preserved.
- Variant with no `og:type` but `product:price:amount` → type `product`, `suggested_category_path === "Product"`.
- Variant with no markdown price → `price: 14900` accepted.
- Variant `og:type: "article"` → weak (null).
- Variant `og:type: "website"` / `"profile"` / `"music.song"` / `"restaurant.restaurant"` / `"business.business"` → all weak (null) in this hotfix.
- Variant `og:type: "video.movie"` → returns `movie`, path `"video.movie"`.
- Variant `og:image: "javascript:alert(1)"` → `image_url === null`.
- Variant no H1 but `og:title` → name from `og:title`, casing preserved.
- "Customers also viewed" section after `## ` → not picked up for name/price.

## Validation after deploy

1. `supabase--test_edge_functions` for `analyze-entity-url-v2` — all green.
2. Re-analyze:
   - `https://www.nykaa.com/dior-homme-intense-eau-de-parfum-intense/p/950905?skuId=768775`
   - `https://www.nykaa.com/dior-sauvage-eau-forte/p/20232222?root=cav_pd&skuId=20232221`
   Expected: 200, `predictions.type === "product"`, casing preserved, `used_firecrawl: true`, `stage: "firecrawl-recovered"`.
3. Edge logs no longer show `firecrawl recovery failed: weak extraction` for these URLs.
4. Strong-direct page (e.g. Wikipedia) still skips Firecrawl/Gemini.
5. Truly bad page (404, or `og:type=article` only) still returns the original fetch error unchanged.
6. Phase 8 untouched.

## Files touched

- `supabase/functions/analyze-entity-url-v2/firecrawl.ts` — request `["html","markdown"]`; tolerate `rawHtml` in response; expose `metadata` + `markdown`; markdown cap; usability = any of html/markdown/metadata.
- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery.ts` — **new**; product-first deterministic extractor typed against the 9 extractable types; case-insensitive key lookup with value casing preserved; strict-type rule; main-region markdown parsing; conservative price handling; consistent `suggested_category_path`.
- `supabase/functions/analyze-entity-url-v2/index.ts` — wire `extractFromFirecrawl` into both Firecrawl paths.
- `supabase/functions/analyze-entity-url-v2/firecrawl_test.ts` — body-shape assertions; metadata/markdown passthrough; rawHtml fallback; metadata-only usability; oversize markdown.
- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery_test.ts` — **new**; Nykaa-shaped regression suite incl. type-subset enforcement and value-casing assertions.

V1 and all other files: untouched.
