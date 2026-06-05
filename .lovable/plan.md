# Phase 5 — Deterministic Exact-Page Extraction (LOCKED, FINAL)

Parse `FetchResult.bodyText` from Phase 4B into structured predictions. **No new network, no AI, no Firecrawl, no DB, no frontend, no V1 changes.**

## Locked policy

### Taxonomy split
- **Canonical taxonomy (stable, 15)** lives in `_shared/entityTypes.ts` — mirrors `getActiveEntityTypes()` in `src/services/entityTypeHelpers.ts`:
  `movie, book, tv_show, course, app, game, experience, food, product, place, brand, event, service, professional, others`.
  Legacy `generic` key intentionally excluded.
- **Phase-5 extraction subset (policy, 9)** lives in `extractor.ts` as `EXACT_PAGE_EXTRACTABLE_TYPES`, typed `ExactPageExtractableType extends CanonicalEntityType`:
  `product, book, movie, tv_show, course, app, game, food, place`.
- **Deferred (6):** `experience, brand, event, service, professional, others` → `predictions: null` + `warnings:['weak_signals']`.

### Type-inference rule (hard)
- `type` set **only** from a recognized JSON-LD `@type` or recognized `og:type`.
- Title, `<h1>`, meta description, Twitter card text, URL patterns, hostnames **never** produce a `type`. They may fill `name`/`description` only.
- No recognized structured type → `predictions: null` + `weak_signals`.

### JSON-LD parsing
- **`@type` arrays:** normalize to `Array<string>`, pick **first recognized** value from mapping table.
- **`@graph` flattening:** iterate nodes; first node with a recognized `@type` wins.
- **One-level wrapper unwrap:** if top-level `@type` ∈ {`WebPage, WebSite, Article, NewsArticle, BlogPosting, CollectionPage, ItemPage, ProductPage`} and a child object exists at `mainEntity` / `subjectOf` / `about` with its own `@type`, evaluate that child. **Single level only — no recursion.** Source recorded as `"jsonld:WebPage→Product"` etc. in `metadata.extract.sources`.
- Malformed JSON-LD blocks: skipped silently; remaining blocks / OG fallback continue.

### URL safety
- `safeAbsoluteUrl(value, baseUrl)`:
  1. `new URL(value, baseUrl)` in try/catch.
  2. Allow only `http:` / `https:`. Drop `javascript:`, `data:`, `blob:`, `file:`, `mailto:`, etc.
  3. Return absolute string or `null`.
- Applied to `image_url`, every `images[]` entry, `additional_data.canonical_url`, any favicon/icon.

### No-mapping rules
- `Organization` → never `brand`. `Person` → never `professional`. No inference of `others`.
- Raw product-brand **text** (`Product.brand.name` string) allowed in `additional_data.brand`. Brand **entity** creation stays deferred (Phase 8).

## V1-compatible response shape

```ts
type CanonicalEntityType =
  | 'movie' | 'book' | 'tv_show' | 'course' | 'app' | 'game'
  | 'experience' | 'food' | 'product' | 'place' | 'brand'
  | 'event' | 'service' | 'professional' | 'others';

// extractor.ts only
type ExactPageExtractableType = Extract<CanonicalEntityType,
  'product' | 'book' | 'movie' | 'tv_show' | 'course' | 'app' | 'game' | 'food' | 'place'>;

interface V2Predictions {
  type: CanonicalEntityType;                 // Phase 5 always emits ExactPageExtractableType
  name: string;
  description: string | null;
  category_id: null;                         // Phase 5: never resolved
  suggested_category_path: string | null;    // RAW schema.org type verbatim: "Product", "Movie", "TVSeries", "Restaurant". Never a fabricated path like "Product>Electronics". Never lowercased.
  matched_category_name: null;               // Phase 5: never resolved
  tags: string[];                            // []
  confidence: number;                        // 0.9 (JSON-LD) | 0.8 (OG) — no other tier
  reasoning: string;
  image_url: string | null;
  images: Array<{ url: string }>;            // [] or [{ url: image_url }]
  additional_data: Record<string, unknown>;
}
```

**No** top-level `suggested_category` key. Weak-signal path returns `predictions: null` and still populates `metadata.extract`.

## Files

**New**
- `supabase/functions/_shared/entityTypes.ts` — exports **`CANONICAL_ENTITY_TYPES` (15) + `CanonicalEntityType` only**. Header: "Edge-function mirror of `src/services/entityTypeHelpers.ts::getActiveEntityTypes()`. Stable canonical taxonomy. NOT the universal source of truth; must stay in sync until a repo-level shared module exists. Phase-specific extraction subsets live with their phase code, not here. Legacy `generic` intentionally excluded."
- `supabase/functions/analyze-entity-url-v2/extractor.ts` — pure `extractFromHtml(html, finalUrl)`; exports `safeAbsoluteUrl`, `EXACT_PAGE_EXTRACTABLE_TYPES`, `ExactPageExtractableType`. Header comment: "Phase-5 policy subset of CanonicalEntityType. Not part of the universal taxonomy."
- `supabase/functions/analyze-entity-url-v2/extractor_test.ts`

**Edited**
- `supabase/functions/analyze-entity-url-v2/index.ts` — wire extractor after fetcher; never log/serialize `bodyText`.
- `supabase/functions/analyze-entity-url-v2/schema.ts` — add `V2Predictions`, `ExtractMetadata`, import `CanonicalEntityType` from `_shared`.
- `supabase/functions/analyze-entity-url-v2/README.md` — document taxonomy split, sync caveat, type-inference rule, URL-scheme policy, brand/person/event deferral, `@type`-array + one-level-unwrap behavior, `suggested_category_path` = raw schema.org type only.

**Untouched (verified):** `analyze-entity-url/**`, `fetcher.ts`, `ssrf.ts`, `src/**` (incl. `CreateEntityDialog.tsx`, `useAnalyzeUrlEngine.ts`), `supabase/config.toml`, DB/RPC/secrets, Gemini, Firecrawl, category/brand resolution.

## Extractor pipeline

1. Regex-extract `<script type="application/ld+json">…</script>` blocks from **raw HTML** (before any stripping); `JSON.parse` each in try/catch.
2. For each parsed JSON-LD root: flatten `@graph` arrays into candidate nodes.
3. For each candidate node:
   a. Normalize `@type` to `Array<string>`.
   b. If first type is a wrapper (`WebPage, WebSite, Article, NewsArticle, BlogPosting, CollectionPage, ItemPage, ProductPage`), look at `mainEntity`/`subjectOf`/`about` (single level). If that child has a recognized `@type`, replace the node with the child.
   c. Walk normalized `@type` array, pick first value that maps in the table below.
4. Strip `<script>`/`<style>` blocks.
5. Regex-extract `<meta name|property=…>`, `<title>`, `<link rel="canonical|icon">`.
6. **Type resolution table:**
   - JSON-LD: `Product`→product · `Book|Audiobook`→book · `Movie`→movie · `TVSeries|TVSeason|TVEpisode`→tv_show · `Course`→course · `SoftwareApplication|MobileApplication|WebApplication`→app · `VideoGame`→game · `Recipe`→food · `Restaurant|LocalBusiness|Hotel|Place`→place
   - OG: `video.movie`→movie · `video.tv_show`→tv_show · `product`→product · `book`→book
   - Anything else (incl. `Organization`, `Person`, `Event`, `Service`, `Thing`) → not extractable.
   - **`suggested_category_path` carries the matched raw schema.org/og type verbatim** (e.g. `"TVSeries"`, `"Restaurant"`, `"video.movie"`). Never derived, never lowercased, never a path.
7. **Field resolution** (precedence JSON-LD → OG → Twitter/meta → `<title>`/`<h1>`): `name`, `description`, `image_url` (via `safeAbsoluteUrl`).
8. Confidence: JSON-LD type+name = **0.9**; OG type+name = **0.8**. No other tier.
9. No recognized type OR no `name` → `predictions: null` + `warnings:['weak_signals']`.

## additional_data (by type, all optional)

- product: `price`, `currency`, `rating`, `rating_count`, `brand` (text), `availability`, `sku`, `gtin`
- book: `author`, `isbn`, `published_date`, `page_count`
- movie/tv_show: `release_date`, `runtime`, `director`, `rating`
- course: `provider`, `instructor`, `duration`
- app: `operating_system`, `app_category`, `rating`
- game: `platform`, `genre`, `rating`
- food (Recipe): `cuisine`, `total_time`, `servings`
- place: `address`, `latitude`, `longitude`, `phone`, `cuisine`
- all (if present, http(s)-only): `canonical_url`

## metadata.extract

```ts
{
  has_jsonld: boolean,
  jsonld_blocks: number,
  has_og: boolean,
  has_twitter: boolean,
  sources: string[],            // e.g. ["jsonld:Product", "jsonld:WebPage→Product", "og:title", "meta:description"]
  mapped_type: CanonicalEntityType | null,
  confidence: number | null,
  weak_signals: boolean
}
```

**Privacy:** raw HTML, `bodyText`, parsed JSON-LD blocks never logged or serialized.

## Tests (extractor_test.ts)

**Structured-type happy paths:**
1. JSON-LD `Product` (price+rating+brand text) → product, conf 0.9, `additional_data.brand` populated, `suggested_category_path === "Product"`.
2. JSON-LD `Movie` → movie, `suggested_category_path === "Movie"`.
3. JSON-LD `TVSeries` → tv_show, `suggested_category_path === "TVSeries"` (raw, not lowercased).
4. JSON-LD `Recipe` → food.
5. JSON-LD `Restaurant` with `geo` → place + lat/lng, `suggested_category_path === "Restaurant"`.
6. JSON-LD `SoftwareApplication` → app.
7. JSON-LD `VideoGame` → game.
8. JSON-LD `Book` with ISBN → book.
9. JSON-LD `Course` → course.
10. OG-only `og:type=video.movie` → movie, conf 0.8, `suggested_category_path === "video.movie"`.

**`@type` array handling:**
11. `"@type": ["Thing","Product"]` → product (first recognized wins).
12. `"@type": ["Foo","Bar"]` (none recognized) → weak_signals.

**Wrapper unwrap:**
13. `WebPage` with `mainEntity: { @type: "Product", … }` → product; `sources` contains `"jsonld:WebPage→Product"`.
14. `Article` with `about: { @type: "Movie", … }` → movie.
15. `WebPage` with no `mainEntity`/`subjectOf`/`about` → weak_signals.
16. `WebPage` → `mainEntity: { @type: "WebPage", mainEntity: { @type: "Product" }}` → weak_signals (one-level only).

**Weak-signal guards:**
17. JSON-LD `Organization` → weak_signals (not brand).
18. JSON-LD `Person` → weak_signals (not professional).
19. JSON-LD `Event` → weak_signals (deferred).
20. JSON-LD `Service` → weak_signals.
21. Title="Buy iPhone 15 Pro" + meta only, no JSON-LD, no og:type → weak_signals (no keyword inference).
22. `https://example.com` minimal HTML → weak_signals.
23. Malformed JSON-LD block → skipped, falls back to OG if present.
24. `@graph` flattening picks first supported node.

**URL safety:**
25. `og:image="javascript:alert(1)"` → dropped, `image_url: null`.
26. `og:image="data:image/png;base64,…"` → dropped.
27. `og:image="/img/a.png"` on `https://x.com/p` → resolved.
28. `<link rel="canonical" href="mailto:x@y">` → dropped.

**Shape contract:**
29. Every successful prediction has all V1 keys: `category_id`, `suggested_category_path`, `matched_category_name`, `tags`, `images`, `image_url`, `additional_data`. No `suggested_category` key. `category_id === null`, `matched_category_name === null`, `tags` is `[]`.
30. `suggested_category_path` is never a fabricated path string — assert no `>` character, no lowercasing of known PascalCase types.

## Acceptance & post-build proof

- Extractor tests pass; 28 fetcher + 34 SSRF tests still green.
- `_shared/entityTypes.ts` lists all 15 canonical types and **does not** export `EXACT_PAGE_EXTRACTABLE_TYPES`.
- `extractor.ts` exports `EXACT_PAGE_EXTRACTABLE_TYPES` with exactly the 9 subset, typed as `Extract<CanonicalEntityType, …>`.
- README documents taxonomy split, sync warning, and `suggested_category_path` raw-type rule.
- Live V2 admin calls: product URL, movie URL, TV-show URL, `https://example.com` (weak_signals), Wikipedia Organization page (weak_signals — not brand), wrapper-unwrap proof (Google Books or similar where the Book sits inside `mainEntity`).
- Diff limited to the 6 files listed.
- V1 endpoint and `CreateEntityDialog.tsx` byte-identical.
- No raw HTML/bodyText in response or logs (grep proof).

Awaiting approval to switch to build mode.
