# Entity-image fallback consistency inventory (Step 5 — audit only)

Read-only audit. No component, helper, query, schema, or visual change was made in this step.

## Objective

Standardise **only what is displayed when an entity has no usable image**. Every surface keeps its existing dimensions, aspect ratio, shape, border radius, object-fit, spacing, position, surrounding UI and navigation.

Target contract:

```text
entity → getOptimalEntityImageUrl() → real image
            ↓ missing OR broken (identical outcome)
    canonical local icon for the entity's canonical type
    neutral local icon for unknown/malformed types
    no remote stock photo, no second network request
    failure state resets when entity/source changes
```

## Headline findings

1. **Real-image resolution is already mostly consistent.** 24 files call `getOptimalEntityImageUrl` (`src/utils/entityImageUtils.ts:72`). The divergence is almost entirely in the fallback layer.
2. **The fallback layer has five competing behaviours:**
   - local canonical Lucide icon — `src/components/common/EntityImage.tsx:28-49` (pills only);
   - remote Unsplash stock photo via `ImageWithFallback` (`src/components/common/ImageWithFallback.tsx:35-37`) — the default for most surfaces;
   - explicit `fallbackSrc="/placeholder.svg"` (local) — explore surfaces;
   - inline `|| '/placeholder.svg'` — `EntitySidebar.tsx:287`;
   - nothing at all (broken-image glyph) — `ProductSearch.tsx:110`, `MyStuffItemCard.tsx:72`, `SubjectSelectStep.tsx:63`, `RecommendationEntityCard.tsx:99`, `EntityDetailSkeleton.tsx:106`, `UnifiedEntitySelector.tsx:703`.
3. **`ImageWithFallback` makes a second network request on failure** (`ImageWithFallback.tsx:103-111`: proxied URL fails → retry direct → then stock photo). Two network attempts before any fallback shows.
4. **Four separate type→stock-image maps exist**, all remote Unsplash literals:
   - `src/utils/entityImageUtils.ts:143` (v1) — one caller, `ChatEntityCard.tsx:208,247`;
   - `src/utils/imageUtils.ts:215` (v2) — consumed inside `ImageWithFallback.tsx:35`, so it is the implicit default for ~35 call sites, plus `src/services/recommendation/entityOperations.ts:141` (non-visual write path);
   - `src/services/entityTypeHelpers.ts:63` (v3) — the widely imported one (entity detail, entity-v4, children, siblings, review/recommendation cards, selector);
   - `src/utils/urlUtils.ts:100` (v4) — `EntitySidebar.tsx:21,127` and `use-entity-search.ts:230,359` (the latter is a write path).
5. **Unknown types silently become `product` or `place`** in several places — a direct violation of the canonical-taxonomy rule: `EntityV4.tsx:472`, `EntityDetail.tsx:433,498`, `EntityDetailV2.tsx:375,449,1034`, `ChatEntityCard.tsx:208,247`, `UnifiedEntitySelector.tsx:430,625`, `RecommendationCard.tsx:131`, `ProductResultItem.tsx:38`.
6. **Stock-photo fallbacks are written into the database**, not only rendered: `entityOperations.ts:141` and `use-entity-search.ts:230,359` persist an Unsplash URL as `image_url` when no real image is found. This means some entities *have* a stock `image_url` and no client-side change alone will make them show an icon. This is the single biggest finding and needs its own decision.

## Surface matrix

Presentation columns are recorded so they can be frozen byte-for-byte during migration.

| Surface | Route / flow | File:line | Resolver | Missing behaviour | Broken behaviour | 2nd network request | Fallback | Size / shape / fit | Alt | Status | Adoptable without presentation change | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Posted entity pill | feed + post detail | `feed/PostedEntityPill.tsx` → `common/EntityImage.tsx` | optimal | local icon | local icon | no | **local canonical icon** | 22px circle, object-cover | name | live | already compliant | none |
| Composer entity chip | `/create` | `feed/composer/EntityHeroPill.tsx` → `EntityImage` | optimal | local icon | local icon | no | **local canonical icon** | 28px circle, object-cover | decorative | live | already compliant | none |
| Search result row | `/search`, SearchDialog, EnhancedSearchInput, Explore | `search/EntityResultItem.tsx:33,42-48` | optimal | Unsplash (via `entityType`) | Unsplash after direct retry | yes | remote stock | 48×48 `rounded-lg`, object-cover | name | live | yes — swap fallback only | low |
| Product search list | `/product-search` | `pages/ProductSearch.tsx:108-113` | optimal | empty grey box | broken-image glyph (no onError) | no | none | 48×48 `rounded-lg`, object-cover | name | live | yes | low |
| Review subject picker | review creation flow | `profile/reviews/steps/SubjectSelectStep.tsx:61-66` | optimal | empty grey box | broken glyph | no | none | 48×48 `rounded-lg`, object-cover | name | live | yes | low |
| Entity children list | entity page sidebar + tabs | `entity/EntityChildrenCard.tsx:62-66,173-178` | optimal | Unsplash (v3 helper) | Unsplash after retry | yes | remote stock | 48×48 `rounded-md`, object-cover | name | live | yes | low |
| Entity-v4 tab children | entity page tabs | `entity-v4/EntityTabsContent.tsx:275-279` | raw field | Unsplash (v3) | Unsplash after retry | yes | remote stock | as coded | name | live | yes | low |
| Entity-v4 sidebar parent | entity page sidebar | `entity-v4/EntitySidebar.tsx:124-127` | raw field | Unsplash (v4 helper) | Unsplash after retry | yes | remote stock | 48×48 `rounded-lg`, object-cover | name | live | yes | low |
| Entity-v4 sidebar related | entity page sidebar | `entity-v4/EntitySidebar.tsx:286-289` | raw `image_url` | `/placeholder.svg` | broken glyph (no onError) | no | local placeholder svg | 32×32 `rounded`, object-cover | name | live | yes | low |
| Related entities card | entity page | `entity/EntityRelatedCard.tsx:118-121` | raw field | Unsplash default | Unsplash after retry | yes | remote stock | small square, object-cover | name | live | yes | low |
| Sibling carousel | entity page reviews section | `entity/SiblingCarousel.tsx:83-88` | raw `image_url` | Unsplash (v3) | Unsplash after retry | yes | remote stock | 256×128 tile `rounded-md`, object-cover | name | live | yes | low |
| Saved entity card | My Stuff → Saved | `mystuff/saved/SavedEntityCard.tsx:47-58` | raw `image_url` | type icon (own local map, 6 types only) | Unsplash after retry | yes | mixed: local icon when absent, remote stock when broken | 64×64 `rounded-lg`, object-cover | name | live | yes — also unifies its own 6-type icon map | low |
| My Stuff item card | My Stuff, Profile → Stuff | `mystuff/MyStuffItemCard.tsx:70-75` | optimal | image block not rendered at all | broken glyph | no | none | `aspect-video`, object-cover | name | live | yes — needs a decision on rendering a fallback block where none exists today | medium (layout appears/disappears) |
| Recommendation entity card | entity-v4 network recs, RecommendationsModal | `entity/RecommendationEntityCard.tsx:97-102` | optimal | empty grey box | broken glyph | no | none | 64×64 `rounded-md`, object-cover | name | live | yes | low |
| Recommendation card | Feed, profile recs, journey recs, alternatives drawer | `recommendations/RecommendationCard.tsx:53,131,364-369` | optimal + legacy `image_url` | Unsplash (v3, category-keyed) | Unsplash after retry | yes | remote stock | `h-48` `rounded-md`, object-cover | descriptive | live | yes | low |
| Review card (profile) | profile reviews | `profile/reviews/ReviewCard.tsx:81,139,650-655` | optimal + `ensureHttps` | Unsplash (v3) or `/placeholder.svg` | Unsplash after retry | yes | remote stock | `h-48` `rounded-md`, object-cover | descriptive | live | yes | low |
| Chat entity card | AI assistant chat | `chat/ChatEntityCard.tsx:208,241-247` | optimal, stock pre-resolved with `||` | Unsplash (v1) | inline `onError` reassigns to Unsplash (v1) | yes | remote stock | 48×48 `rounded-md`, object-cover | name | live | yes | low |
| Composer selector dropdown row | `/create` entity search | `feed/UnifiedEntitySelector.tsx:619-626` | optimal | Unsplash (v1) | Unsplash after retry | yes | remote stock | 44×44 / 32×32 `rounded-lg`/`rounded`, object-cover | name | live | yes | low |
| Composer selector selected chip | `/create` | `feed/UnifiedEntitySelector.tsx:689,703-710` | raw field first, then optimal | coloured type-letter circle | broken glyph (no onError) | no | none | 20px circle, object-cover | `alt=""` | live | **yes — closest direct `EntityImage` candidate** | low |
| Featured entities grid | Explore | `explore/FeaturedEntities.tsx:111-116` | optimal | `/placeholder.svg` | `/placeholder.svg` after retry | yes | local placeholder svg | `h-48` tile, object-cover | name | live | yes | low |
| Category highlights (3 blocks) | Explore | `explore/CategoryHighlights.tsx:120-125,181-186,276-281` | optimal | `/placeholder.svg` | same after retry | yes | local placeholder svg | `h-32`/`h-48` tiles, object-cover | name | live | yes | low |
| Entity page hero | `/entity/:slug` (entity-v4) | `entity-v4/EntityHeader.tsx:173-181`, src from `EntityV4.tsx:472` | raw `image_url` **with stock already substituted** | Unsplash (v3, defaults to `product`) | Unsplash after retry; also flips an "expired image" refresh affordance | yes | remote stock | mobile full-width `h-48`, desktop 96×96, `rounded-lg`, object-cover/contain for brands | name | live | **separately gated** — a large photo becoming an icon is a real product change, and the refresh affordance depends on the error path | high |
| Entity detail optimistic hero | `/entity/:slug` transition state | `entity/EntityDetailSkeleton.tsx:104-109` | optimal | nothing rendered | broken glyph | no | none | 4:3 `AspectRatio`, object-cover | name | live | yes | low |
| Review flow preview card | review creation, StepThree | `common/EntityPreviewCard.tsx:96-104` | raw `image_url` | initials block | hard-coded Unsplash literal `fallbackSrc` | yes | remote stock (inline literal) | 96×96 `rounded-lg`, object-cover | name | live | yes | low |
| Legacy entity detail (V2 / original) | reached only via internal version branch in `EntityDetail.tsx:1039-1041` | `pages/EntityDetailV2.tsx:375,449,793,960,1034`, `pages/EntityDetail.tsx:433,498` | raw `image_url` | Unsplash (v3, defaults to `place`) | Unsplash after retry | yes | remote stock | various | name | conditionally live (non-default branch) | defer — version-gated legacy | medium |
| Admin entity surfaces | `/admin/*` | `AdminEntityEdit.tsx:1056`, `AdminEntitiesPanel.tsx:108`, `AdminEntityManagementPanel.tsx:736-738`, `AdminSuggestionsPanel.tsx:344`, `SuggestionReviewModal.tsx:170`, `ClaimReviewModal.tsx:237` | optimal, several with `|| image_url` | varies | varies | varies | mixed | admin thumbnails | name | admin-only | last, or deliberately excluded | low |
| Explore product card | — | `explore/ProductCard.tsx:118-131` | optimal | icon block | no onError | no | local icon | rectangular | name | **dead — no importers** | n/a | n/a |
| Product search result row | — | `search/ProductResultItem.tsx:34-40` | optimal | Unsplash (metadata type or `'product'`) | Unsplash after retry | yes | remote stock | 48×48 `rounded-md` | name | **dead — no importers** | n/a | n/a |

## Helper classification

| Helper | File:line | Callers | Class |
|---|---|---|---|
| `getOptimalEntityImageUrl` | `utils/entityImageUtils.ts:72` | 24 live files | **KEEP** — the real-image resolver, unchanged |
| `isStoredImageUrl`, `isProxyUrl`, `validateImageUrlForStorage` | `utils/entityImageUtils.ts:44,58,109` | resolver internals + write paths | **KEEP** |
| `FALLBACK_ICONS` / `getEntityFallbackIcon` | `common/EntityImage.tsx:28-49` | `EntityImage` only | **KEEP and promote** — the only canonical local mapping; should be extracted so non-circular renderers can use it without adopting the circular markup |
| `getEntityTypeFallbackImage` v1 | `utils/entityImageUtils.ts:143` | `ChatEntityCard.tsx:208,247` | **MIGRATE THEN REMOVE** |
| `getEntityTypeFallbackImage` v2 | `utils/imageUtils.ts:215` | `ImageWithFallback.tsx:35`; `entityOperations.ts:141` (write path) | **MIGRATE THEN REMOVE for rendering**; the write-path call needs a separate decision |
| `getEntityTypeFallbackImage` v3 | `services/entityTypeHelpers.ts:63` | entity detail, entity-v4, children, siblings, review/recommendation cards, tabs; plus `entityTaxonomyCompatibility.test.ts:55` which asserts it returns an `http(s)` URL | **MIGRATE THEN REMOVE** — note the test contract must change with it |
| `getEntityTypeFallbackImage` v4 | `utils/urlUtils.ts:100` | `EntitySidebar.tsx:127`; `use-entity-search.ts:230,359` (write paths) | **MIGRATE THEN REMOVE for rendering**; write-path calls decided separately |
| `getCategoryFallbackImage` | `utils/fallbackImageUtils.ts:12` | only `getRecommendationFallbackImage` in the same file | **DEAD PENDING PROOF** — no external importer found; do not delete in this step |
| `getRecommendationFallbackImage` | `utils/fallbackImageUtils.ts:30` | none found anywhere in `src` | **DEAD PENDING PROOF** |
| `ImageWithFallback` | `common/ImageWithFallback.tsx` | ~35 files | **KEEP, then change its default** — it also owns HTTPS coercion, proxy routing and CORS mode, which are still needed. Its stock-photo default and second network attempt are the parts to replace |
| `getProxyUrlForImage`, `isValidImageUrl`, `saveExternalImageToStorage` | `utils/imageUtils.ts` | rendering + ingestion | **NON-VISUAL / KEEP** |
| `getEntityTypeFallbackImage` at write time | `entityOperations.ts:141`, `use-entity-search.ts:230,359` | entity creation/search enrichment | **NON-VISUAL, own decision** — these persist stock URLs into `entities.image_url` |

## Explicitly excluded from this work

- Every `supabase/functions/*` image reference: `refresh-entity-image`, `daily-refresh-entity-images`, `migrate-entity-image-urls`, `migrate-place-photos`, `cleanup-orphan-media*`, `enrich-candidate-image`, `enrich-entity-data`, `enrich-brand-data`, `resolve-brand-logo`, `analyze-entity-url*`, `search-*`, `create-brand-entity`, `check-entity-duplicates`, `generate-smart-notifications`, `unified-search-v2`, `fetch-url-metadata-lite`, `proxy-*`.
- Storage and proxy URL builders in `utils/imageUtils.ts`.
- User avatars (`ProfileAvatar`, `AvatarImage`), profile covers (`use-profile-data.ts:12`), uploaded review/post media galleries, location imagery, SEO/structured-data image URLs.
- Preference category icons (`PreferencesSection`) — not entity images.

## Acceptance rule for every migration group

When a valid real entity image exists, the surface must be visually and structurally identical before and after. Only the missing/broken state changes. Dimensions, `aspect-*`, `rounded-*`, object-fit, padding, margins, surrounding layout, navigation and accessible labelling stay as they are; loading behaviour changes only to remove the second fallback request.

## Proposed minimal mechanism

Three options were considered:

- **A — make every surface use `EntityImage`.** Rejected: the component hard-codes `rounded-full`, and only three surfaces are circular.
- **B — shared decision contract, existing markup kept.** Extract the canonical icon map out of `EntityImage` into a small module (`getEntityFallbackIcon(type)`), and add a tiny shared hook that owns "resolved source + failed-source key" exactly as `EntityImage` does today. Each surface renders its existing wrapper and swaps only its fallback branch. `ImageWithFallback` keeps its HTTPS/proxy/CORS duties, but its default fallback becomes the local icon and its second network attempt is removed. `EntityImage` stays as the circular convenience wrapper over the same contract.
- **C — per-surface local fixes.** Rejected: recreates the divergence.

**Recommendation: B.** It is the smallest change that makes the fallback decision identical everywhere while leaving all presentation untouched.

## Prerequisite decision the user must make

Some entities already have an Unsplash URL persisted in `entities.image_url` (written by `entityOperations.ts:141` and `use-entity-search.ts:230,359`). For those, the client sees a *valid* image and will keep showing the stock photo. Full consistency therefore needs one of:

1. stop writing stock URLs at creation/enrichment time and treat existing stock URLs as "no image" when rendering (a recognition check against the known Unsplash fallback list); or
2. stop writing them and leave existing rows as they are (partial consistency); or
3. stop writing them plus a one-off data cleanup of stock URLs (out of scope for a UI-only change).

## Recommended migration groups

- **Group 0 (prerequisite, no visual change):** extract the canonical icon resolver and the shared source/failure hook; decide the stock-URL question above. Tests: canonical-type coverage, unknown-type neutral icon, reset-on-entity-change, no second request.
- **Group 1 — circular:** `UnifiedEntitySelector` selected chip (and its letter-circle fallback). Lowest risk; the surface is already circular and currently has no error handling at all.
- **Group 2 — small square/rect list thumbnails:** `EntityResultItem`, `ProductSearch`, `SubjectSelectStep`, `EntityChildrenCard`, `EntityTabsContent`, `EntitySidebar` (both blocks), `EntityRelatedCard`, `RecommendationEntityCard`, `UnifiedEntitySelector` dropdown row.
- **Group 3 — cards:** `SavedEntityCard`, `RecommendationCard`, `ReviewCard`, `ChatEntityCard`, `EntityPreviewCard`, `MyStuffItemCard` (needs an explicit decision: today no image block renders at all when there is no image).
- **Group 4 — grids and carousels:** `FeaturedEntities`, `CategoryHighlights`, `SiblingCarousel`, `EntityDetailSkeleton`.
- **Group 5 — separately gated:** entity-v4 hero (`EntityHeader` + `EntityV4.tsx:472`), because replacing a large photo with an icon is a visible product decision and the hero's error path also drives the image-refresh affordance.
- **Group 6 — last or excluded:** admin surfaces; version-gated legacy `EntityDetail`/`EntityDetailV2`.
- **Not migrated:** dead `ProductCard` and `ProductResultItem` (no importers — removal is a separate cleanup, not part of this work).

## Unresolved questions

1. The stock-URL-in-database question above — blocks full consistency.
2. `MyStuffItemCard`: render a fallback block where none exists today (changes card height) or keep the image absent?
3. Entity hero: icon, keep stock photography, or a neutral branded placeholder?
4. `entityTaxonomyCompatibility.test.ts:55` asserts fallbacks are `http(s)` URLs — that contract inverts when helpers become local icons.
5. `getCategoryFallbackImage` / `getRecommendationFallbackImage` look dead but are left in place pending explicit proof.

## Groups 0A/0B/1 implementation evidence

Implemented only the approved prerequisite contract, future-write hygiene, and selected composer-chip proof. Group 2 and all broader surface migrations remain untouched.

- Shared contract: `src/utils/entityImageFallback.ts` owns the 15 canonical local-icon mappings, neutral unknown fallback, and conservative exact Unsplash placeholder identities. Query-string differences are ignored; unrelated Unsplash URLs remain valid.
- Shared state: `src/hooks/useEntityImageFallback.ts` gives missing and broken sources the same local fallback, attempts a real source once, and resets failure behavior when the entity/source key changes.
- Circular convenience renderer: `EntityImage` now consumes the shared contract without changing its circular markup, dimensions, crop, accessibility, or navigation responsibilities.
- Proof surface: only the `UnifiedEntitySelector` selected chip now uses `EntityImage`; its pill remains 32px high and its circular image frame remains 20×20px. The selector dropdown still uses `ImageWithFallback` unchanged.
- Future-write hygiene: the three traced client stock-write paths now persist a real URL or `null`. New entities without a real image write `null`; existing valid images are retained when a later lookup supplies no usable replacement.
- Legacy-row boundary: no database cleanup or broad URL rewrite was performed. Exact known legacy placeholders are recognized only by the new contract/write validation. Unrelated metadata updates do not clear them.
- Explicitly unchanged: `ImageWithFallback`, `getOptimalEntityImageUrl`, My Stuff cards, Saved cards, entity headers, admin/legacy surfaces, dimensions, shapes, object-fit, spacing, and all Group 2+ surfaces.

Verification:

- Vitest: 44 files, 672 tests passed.
- Typecheck: `bunx tsgo --noEmit` passed.
- Focused ESLint for the new contract, hook, component, and tests passed.
- Preview build watcher reported `build OK`; no new runtime console errors were recorded.

## Groups 0A/0B/1 close-out evidence (proof gate)

Direct write-path regression tests now assert the persisted payload itself, not just the shared sanitizer.

- `src/services/__tests__/entityImageWritePaths.test.ts` — `createEntityQuick` and the `createEntity` basic-insert fallback: a valid real image is persisted unchanged; no image persists `image_url: null` exactly (asserted as present-and-null, never `''`, `undefined`, or omitted); an exact registered legacy placeholder also persists `image_url: null`; a legitimate unregistered Unsplash image is preserved. `findOrCreateEntity` reuse of an existing entity performs no insert and no image update. `validateImageUrlForStorage` keeps a stored valid image when the new candidate is missing, empty, or a registered placeholder.
- `src/hooks/useEntitySearchWritePaths.test.tsx` — the same four-case contract for `createEntityFromExternal` and `createEntityFromUrl`.
- `src/components/feed/SelectedEntityChipProof.test.tsx` — controlled fixture reproducing the selected-chip markup exactly: 32px pill retained, 20×20 circular image frame retained, missing and broken sources render the identical circular fallback with no pill height change, and switching from a failed entity to a valid entity renders the new real image without inheriting the previous failure.

Runtime capture limitation, stated plainly: the browser auth status for this project is `external_unmanaged`, so no authenticated composer session can be established in the sandbox and desktop/mobile screenshots of the live chip could not be taken. The controlled fixture above is used instead, as the approved plan allows; the chip's presentation contract is asserted from rendered output, not inferred from styles alone.

Verification run: Vitest 47 files / 694 tests passed; `bunx tsgo --noEmit` clean; focused ESLint on the three new test files clean; preview build watcher reported `build OK`.

## Group 2A close-out evidence (search and selection rows)

Group 2A migrated five thumbnail slots in four files to the shared fallback contract. Every surface kept its existing wrapper classes, size, radius, crop, spacing and layout; only the image source decision changed. Real images render byte-identically (same `src`, `object-cover`, `loading="lazy"` where it existed). Missing or broken images now render the canonical entity-type icon centered in the unchanged frame; unknown types render the neutral Tag icon. One real source attempt, then the local icon — no stock photo, no `/placeholder.svg`, no initials, no second network request.

- `src/components/search/EntityResultItem.tsx` — 48×48 rounded square; the old first-letter initial block removed.
- `src/pages/ProductSearch.tsx` — 48×48 square; exports `EntityResultThumbnail` for tests.
- `src/components/profile/reviews/steps/SubjectSelectStep.tsx` — 48×48 lazy square; exports `SubjectThumbnail`.
- `src/components/feed/UnifiedEntitySelector.tsx` — modal 44×44 and inline 32×32 entity-result rows via exported `EntityRowThumbnail`; the People branch and its avatar/initials fallback are untouched, as are every other avatar/initials surface (ProfileAvatar, AvatarFallback, ProfileDisplay, UserResultItem).

Initiаls boundary held: entity first-letter initials were replaced by canonical type icons; user initials remain everywhere.

Tests: `src/components/search/group2aEntityThumbnails.test.tsx` (16 tests) — real image unchanged per surface; missing → canonical icon; broken (error event) → identical icon; registered legacy placeholder → icon; unknown type (`hovercraft`) → neutral Tag icon; entity-switch source reset; modal/inline frame sizes preserved; and a mixed search-results view proving an image-less product shows the Package icon with no "M" initial while an image-less person still shows the "R" initial.

Verification run: Vitest 48 files / 710 tests passed; `bunx tsgo --noEmit` clean; focused ESLint on the five changed files reports only pre-existing `no-explicit-any` errors on untouched lines (search callbacks, categorized spreads, funnel logging); preview build watcher reported `build OK`.

Authenticated runtime capture remains unavailable (`external_unmanaged`), so live screenshots could not be taken; rendered-output assertions stand in, as in Group 1.

Group 2B (EntityChildrenCard, entity sidebar parent/related rows, RecommendationEntityCard) has not been started. The EntityChildrenCard child → parent → stock source rule must be documented and approved in writing before 2B begins.
