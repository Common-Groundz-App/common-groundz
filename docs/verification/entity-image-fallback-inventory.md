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

## Group 2B close-out evidence (relationship and recommendation thumbnails)

Source-rule decision, documented and approved before implementation: `EntityChildrenCard`'s child → parent → stock precedence was an undocumented fallback shortcut, not intentional child identity or relationship context. Child rows now resolve only the child's real image, then the canonical child-type icon (neutral Tag for unknown types). This change applies only to the child thumbnail source; the parent relationship, parent navigation, parent metadata usage, and parent-description fallback remain unchanged.

Migrated surfaces:

- `src/components/entity/EntityChildrenCard.tsx` — child rows preserve the 48×48 `rounded-md` `object-cover` frame. The old parent-image substitution and remote type-stock fallback are removed; missing, registered-placeholder, or broken child images render the same canonical local icon. Row click behavior and accessible labels are unchanged.
- `src/components/entity-v4/EntitySidebar.tsx` — the parent row now resolves through the shared contract instead of raw `image_url`, preserving the 48×48 `rounded-lg`, padded, `object-contain` frame. Related rows now resolve through the shared contract instead of raw `image_url || '/placeholder.svg'`, preserving the 32×32 `rounded` `object-cover` frame. Row navigation and current accessibility behavior are unchanged.
- `src/components/entity/RecommendationEntityCard.tsx` — the 64×64 `rounded-md` `object-cover` frame is preserved. The entity first-letter fallback is replaced by the canonical entity-type icon; recommender `ProfileAvatar` elements and all user initials remain unchanged. Card navigation and analytics are unchanged.

Tests: `src/components/entity/group2bEntityThumbnails.test.tsx` (14 tests) — exact frame/radius/crop preservation; valid child, parent, related, and recommendation images render unchanged; missing and broken sources converge on the same canonical icon; exact registered legacy placeholders render the canonical icon; unknown types render neutral Tag; entity-switch source reset; child-with-no-image does not render the parent's valid image; parent-description fallback remains; recommendation avatar boundary remains; child-row callback, sidebar parent/related navigation, and recommendation analytics/navigation remain intact.

Verification run: Vitest 49 files / 724 tests passed; `bunx tsgo --noEmit` clean; focused ESLint on the changed files reports only pre-existing `no-explicit-any` errors on untouched `EntitySidebar` lines; preview production build passed. Authenticated runtime capture remains unavailable (`external_unmanaged`), so rendered-output assertions are the approved substitute for live screenshots.

Stopped after Group 2B. No card/grid/header/admin migration was started.

## Group 3A close-out evidence (card thumbnails)

Group 3A migrated three card surfaces to the shared fallback contract. Every surface kept its existing wrapper classes, size, radius, crop, spacing and layout; only the image-source decision changed. Real images render byte-identically. Missing and broken images now converge on the canonical entity-type icon; unknown types render the neutral Tag icon. One real-source attempt, then the local icon — no stock photo, no `/placeholder.svg`, no initials, no second network request.

- `src/components/mystuff/saved/SavedEntityCard.tsx` — 64×64 `rounded-lg` `object-cover` frame preserved. Its file-local 6-type icon map was deleted in favour of the 15-type canonical map; the image now resolves through the shared contract instead of raw `image_url`, and broken images converge on the same icon as missing ones (previously a remote stock photo via `ImageWithFallback`).
- `src/components/chat/ChatEntityCard.tsx` — 48×48 `rounded-md` `object-cover` frame preserved. Both stock helpers and the `onError` stock reassignment were removed; the silent `unknown → product` type coercion is gone — unknown types render the neutral Tag icon.
- `src/components/common/EntityPreviewCard.tsx` — the responsive `w-full sm:w-24 h-24` bordered `rounded-lg` frame preserved verbatim. The inline hard-coded Unsplash literal is removed. Approved one-time fallback-content change: the visible "No image" text block is replaced by the canonical type icon, and the fallback element carries `role="img"` with an `aria-label` naming the entity so the missing-image state keeps accessible meaning. Its only live caller (`profile/reviews/steps/StepThree.tsx`) is entity-only.

Explicitly unchanged: `ImageWithFallback`, `getOptimalEntityImageUrl`, the shared legacy helpers (still used by unmigrated surfaces), `RecommendationCard`/`ReviewCard` h-48 blocks (Group 3B, separate approval), `MyStuffItemCard` (no image block when no image, as agreed), explore grids, carousels, headers, skeletons, admin, database rows, schema, generated types, keyboard markup, and every user/profile avatar or initials fallback.

Tests: `src/components/mystuff/saved/group3aCardThumbnails.test.tsx` (14 tests) — real image unchanged per surface with exact frame classes; missing → canonical icon; broken (error event) → identical icon; registered legacy placeholder → icon; unknown type → neutral Tag (and no product icon in the chat card); entity-switch source reset; EntityPreviewCard fallback exposes an accessible label and no "No image" text remains.

Verification run: Vitest 50 files / 738 tests passed; `bunx tsgo --noEmit` clean; focused ESLint on the four files reports only three pre-existing `no-explicit-any` errors on untouched `ChatEntityCard` lines (metadata/rating casts); preview build watcher reported `build OK`. Authenticated runtime capture remains unavailable (`external_unmanaged`), so rendered-output assertions stand in, as in earlier groups.

Stopped after Group 3A. No Group 3B, explore-grid, carousel, header, or admin migration was started.

## Group 3B close-out — large subject-image area on profile review and recommendation cards

Scope: `src/components/profile/reviews/ReviewCard.tsx` (live via `ProfileReviews`) and `src/components/recommendations/RecommendationCard.tsx` (live via `ProfileRecommendations`). New shared modules: `src/components/cards/EntityCardFallbackImage.tsx` (renderer) and `src/components/cards/entityCardMediaSources.ts` (source classification + visibility rules).

Root problem corrected: both cards previously merged author media, a legacy single `image_url` **and** the subject (entity) image into one `mediaItems` array. Because the entity image entered that array, a broken entity URL rendered inside `PostMediaDisplay` and could never reach any fallback, while a missing entity image fell through to a remote stock photograph via `ImageWithFallback`.

Now:

- `getAuthorMediaItems` returns author-authored sources only (explicit media array, then legacy `image_url`). The subject image is no longer part of it.
- `shouldShowAuthorMedia` reproduces the existing rule verbatim: with `hideEntityFallbacks` only an explicit media array displays, so a legacy `image_url` stays suppressed on entity-detail callers exactly as before.
- `shouldRenderEntityFallbackArea` renders the large area only where the cards render it today: never in `compact` mode, never when `hideEntityFallbacks` is set, and only when there is no author media at all.
- `EntityCardFallbackImage` resolves the subject image through `useEntityImageFallback`, so valid / missing / broken / registered-legacy-placeholder sources converge on `getEntityFallbackIcon(type)` — one real source, no second network request, no stock photo, no `/placeholder.svg`.
- Presentation frozen: wrapper `rounded-md overflow-hidden relative bg-gray-50 mt-2 mb-3 h-48` (flex centering added for the icon only), real images keep `w-full h-full object-cover`, icon `h-12 w-12`, fallback carries `role="img"` with an `aria-label` naming the subject.
- Removed from these paths: `ImageWithFallback`, `getEntityTypeFallbackImage`, the `'/placeholder.svg'` literal, both `getFallbackImage` helpers, and the now-unused `getOptimalEntityImageUrl`/`ensureHttps` imports. Strict typing preserved (`resolveReviewDisplayType`; `recommendation.category` parsed canonically), unknown → neutral Tag icon.

Untouched: `src/components/ReviewCard.tsx` (Entity V4 reviews), `PostFeedItem` recommendation posts, `RecommendationEntityCard`, journey and chat cards, `MyStuffItemCard`, explore grids, carousels, headers, skeletons, admin, version-gated legacy pages, `ImageWithFallback`, `getOptimalEntityImageUrl`, the legacy stock helpers, database rows, schema, generated types, and every user avatar or initials fallback.

Tests: `src/components/profile/reviews/group3bLargeFallback.test.tsx` (12 tests) — author media wins over a legacy image; legacy image treated as author media, never as the subject image; large area renders only with no author media; `hideEntityFallbacks` shows only an explicit array and suppresses the legacy image, the subject image and the icon; compact never gains the large block; valid subject image renders in the preserved frame; missing / broken (error event) / registered placeholder all converge on the same icon; unknown type → neutral icon with no `images.unsplash.com` or `placeholder.svg` in the output.

Verification run: Vitest 51 files / 750 tests passed; `bunx tsgo --noEmit` clean; focused ESLint reports only two pre-existing `no-explicit-any` errors on untouched `RecommendationCard` lines (props and `getEntityRoute`); preview build watcher reported `build OK`. Authenticated runtime capture remains unavailable (`external_unmanaged`); the empty state was reviewed through a controlled desktop (1280px) and mobile (390px) fixture reproducing the exact frame classes and 48px icon — layout reads calm and balanced, so no presentation adjustment was applied.

Programme status: this closes the large-fallback group for the profile review and recommendation cards only. Still open or intentionally exempt: explore grids, carousels, `EntityDetailSkeleton`, responsive entity headers, admin surfaces, version-gated legacy pages, shared `ImageWithFallback`, the legacy fallback helpers, and `MyStuffItemCard`.

## Group 4 close-out — explore grids and entity collections

Scope (four live surfaces, fallback-source only): `src/components/explore/FeaturedEntities.tsx` (`h-48` area), `src/components/explore/CategoryHighlights.tsx` (all three `h-32` branches: trending, hidden gems, type-filtered), `src/components/entity/SiblingCarousel.tsx` (`h-32` picture in each `w-64` card), `src/components/entity/RelatedEntitiesSection.tsx` (`aspect-square` area). New shared renderer: `src/components/entity/EntityCollectionImage.tsx`.

Each caller keeps its own wrapper element, so every height, aspect ratio, radius, crop, spacing, hover treatment, navigation and surrounding layout is preserved verbatim. Only the content of that wrapper changed: valid real image → unchanged; missing / broken (`onError`) / registered legacy placeholder → canonical local type icon with `role="img"` and an `aria-label` naming the entity; unknown type → neutral Tag icon. One real source attempt, then the local icon — no stock photo, no `/placeholder.svg`, no initials, no second network request.

Real-image precedence preserved per surface, as approved:

- Featured entities and all category-highlight branches already resolved through `getOptimalEntityImageUrl`, so they pass the whole entity and keep selecting the stored metadata photo exactly as today. Their now-unused `getOptimalEntityImageUrl` imports were removed (the hook resolves it).
- The sibling strip and the related-items grid read `image_url` directly today, so they pass only `{ id, image_url }` into `useEntityImageFallback`. A stored metadata photo therefore cannot displace the photo those surfaces display now. Real-source standardisation remains a separate, unproposed decision.

Hover behaviour: `group-hover:scale-105 transition-transform` retained on the sibling strip and related grid; neither explore file has any hover-scale classes today and none was added. Icon sizes: `h-12 w-12` in the `h-48` featured area, `h-10 w-10` in the `h-32` and `aspect-square` areas.

Deliberately out of Group 4:

- `src/components/entity/EntityRelatedCard.tsx` — **not live**. It renders a centred "Coming Soon" card; its 40×40 thumbnail row exists only inside a commented-out example block (lines 113–135). Mounted from `EntitySidebar` and both legacy entity pages, but no related-entity list renders. Left untouched; the original inventory classification was correct.
- `EntityDetailSkeleton` / `EnhancedEntitySkeleton` — **permanently excluded, not deferred**. It represents loading, can render before any entity exists, and treating its placeholder as a missing image would remove loading feedback.

Remaining unmigrated search/picker surfaces, confirmed distinct from the Group 2A files (`EntityResultItem`, `ProductSearch`, `SubjectSelectStep`, the `UnifiedEntitySelector` dropdown rows) — no double count, no gap — and carried to Group 6: `src/components/search/SearchResultHandler.tsx` (48×48, shows "No Image"), `src/components/search/ProductResultItem.tsx` (48×48, generic product photo fallback), `src/components/recommendations/EntitySearch.tsx` (40×40 rows with a hard-coded per-type stock photo, which it also copies into the item created from an external result — a write-path fix).

Tests: `src/components/explore/group4GridCarouselImages.test.tsx` (9 tests, registered in `vitest.config.ts`) — explore surfaces keep optimal resolution (stored metadata photo wins); the sibling/related precedence keeps raw `image_url` and cannot be swapped for a stored photo; image classes preserved including hover zoom where it exists and no hover zoom added on explore; a legitimate, unregistered Unsplash photo still renders as a real image and is not treated as missing; missing → canonical icon with accessible label; broken → identical icon with no further `<img>` request; registered legacy placeholder → icon, its path absent from output; unknown type → neutral icon with no `placeholder.svg` and no Unsplash address introduced as a fallback; per-surface icon sizes applied without touching the caller frame.

Verification run: Vitest 52 files / 759 tests passed; `bunx tsgo --noEmit` clean; focused ESLint reports only three pre-existing `no-explicit-any` errors on untouched `SiblingCarousel` rating lines (104, 108, 109); build watcher reported `build OK`. Authenticated runtime capture remains unavailable (`external_unmanaged` — `/explore` redirects to the landing page for an unauthenticated session), so the empty state was reviewed through a controlled desktop (1280px) and mobile (390px) fixture reproducing the exact frame classes and icon sizes for all four surfaces side by side with real photographs. The panels read calm and balanced at both widths; no icon-size or background-tone adjustment was applied and no frame was altered.

Programme status: Group 4 closes the explore-grid and entity-collection surfaces only. Still open: Group 5 (responsive entity header / large entity placeholders — the outstanding product decision), Group 6 (admin plus the three search/picker files above and any remaining version-gated legacy pages), then `ImageWithFallback` cleanup, legacy stock-helper deletion once zero active callers are proven, optional historical database cleanup, the `getOptimalEntityImageUrl` resolver decision, and a final inventory audit. Intentionally exempt: `MyStuffItemCard`, `EntityDetailSkeleton`, the non-live `EntityRelatedCard` example.

## Group 5 close-out — entity page header image (live Entity V4 page)

Scope (fallback-source only): `src/components/entity-v4/EntityV4.tsx` (source resolution) and the header picture area, extracted verbatim into the new `src/components/entity-v4/EntityHeaderImage.tsx` so the migrated behaviour is directly testable without mounting the whole 650-line header.

- `EntityV4.tsx` no longer substitutes a stock photograph: the source is now `entity?.image_url ?? null`, and the unused `getEntityTypeFallbackImage` / `EntityType` imports were removed. The dead `image` property on the local `entityData` object (never declared or read by `EntityHeaderProps`) was deleted rather than made nullable — the image source lives solely in `entityImage`.
- `EntityHeaderProps.entityImage` is now `string | null`; `null`, never `''`, represents "no real source".
- The picture area resolves through `useEntityImageFallback({ id, image_url })` — only the entity's own `image_url`, so today's raw precedence is unchanged and a stored metadata photo cannot displace the displayed photo. `ImageWithFallback` is gone from this surface.
- Frame preserved verbatim: desktop `flex-shrink-0 h-24 w-24 min-w-[96px] rounded-lg overflow-hidden`, mobile `w-full h-48 mb-4 rounded-lg overflow-hidden`, `relative group`, brand `bg-muted` wrapper with `object-contain`, otherwise `object-cover`.
- Fallback: neutral `bg-muted` panel filling the frame with the canonical type icon (`h-10 w-10` desktop, `h-12 w-12` mobile band), `role="img"` and an `aria-label` naming the entity. Unknown type → neutral Tag icon. One real request, then the local icon; no stock photo, no `/placeholder.svg`, no initials, no second request.

Refresh-overlay semantics, strictly three-way and unchanged for real failures:

- no source from the start → icon, no overlay;
- registered legacy placeholder (treated as missing) → icon, no overlay;
- real source attempted and `onError` fired → icon, and for a signed-in person the overlay appears exactly as today.

The expired flag can only be set by a genuine `onError` on a rendered `<img>` (missing and placeholder sources never reach it), the overlay additionally requires a resolved real source, and the reset effect now depends on both entity id and source, so a failure on one entity can never leave an overlay on the next — including entities that share an image value or both have none.

Out of Group 5: legacy `EntityDetail` (v1) / `EntityDetailV2` (v2) 4:3 header blocks, reachable only for internal users via `?version=1|2` → Group 6. `EntityProductsCard` 48×48 product thumbnails omit the image element when absent; adding a fallback would change row height, so it is an intentional exception alongside `MyStuffItemCard`. `EntityDetailSkeleton` remains permanently excluded. `EntitySidebar` rows were already migrated in Group 2B. `EntityMetadataCard` has no image slot. `SEOHead` reads `entity.image_url` directly and is unaffected.

Tests: `src/components/entity-v4/group5HeaderImage.test.tsx` (17 tests, registered in `vitest.config.ts`) — desktop and mobile frames and crop preserved; brand `object-contain` + `bg-muted`; legitimate unregistered Unsplash photo still renders as the real image; raw `image_url` precedence; missing → icon with accessible label; registered placeholder → icon with its path absent from output and no `/placeholder.svg`; broken → identical icon with no further `<img>`; unknown type → neutral icon with no stock address; per-frame icon sizes; overlay appears only after a genuine failure for a signed-in person, never for missing, never for a registered placeholder, never for a signed-out visitor; failed→valid source reset; entity-switch resets with a shared image value and with no image on either side.

Verification run: Vitest 53 files / 776 tests passed; `bunx tsgo --noEmit` clean; focused ESLint reports only pre-existing `no-explicit-any` errors on untouched lines (`EntityHeader.tsx:49`, `EntityV4.tsx:91`, `:156`) plus one pre-existing exhaustive-deps warning in `EntityV4.tsx`; build watcher reported `build OK`. Authenticated runtime capture remains unavailable (`external_unmanaged`), so the empty state was reviewed through a controlled desktop (1280px) and mobile (390px) fixture reproducing the exact frame classes and icon sizes beside real photographs — both the 96px square and the 192px band read calm and balanced, so no icon-size or background-tone adjustment was applied and no frame was altered.

Programme status: Group 5 closes the live entity header only. Still open: Group 6 (admin surfaces, `SearchResultHandler`, `ProductResultItem`, `EntitySearch` including its external-result write path, and the version-gated legacy entity pages), then `ImageWithFallback` cleanup, legacy stock-helper deletion once zero active callers are proven, optional historical database cleanup, the `getOptimalEntityImageUrl` resolver decision, and a final inventory audit.

## Group 6A close-out — outside-result search rows and the Add to My Stuff picker

- `src/components/search/SearchResultHandler.tsx` — the 48×48 outside-result row (Books / Movies / Places / All Items) shared by the Feed/Explore search dropdown (`EnhancedSearchInput`), `SearchDialog`, `src/pages/Search.tsx` and `src/pages/ProductSearch.tsx`. The "No Image" text and the `ImageWithFallback` stock retry are replaced by `EntityCollectionImage` (source `{ id, image_url }`, raw precedence preserved; icon `h-5 w-5`). Wrapper, processing overlay, text, badges and navigation unchanged. The "Already on Groundz" rows (`EntityResultItem`, Group 2A) were not touched. Replacing visible text with an accessibly labelled icon is the one deliberate content change.
- `src/components/recommendations/EntitySearch.tsx` — both 40×40 row lists in the Add to My Stuff picker (My Stuff → Add Item). The six hard-coded stock addresses are gone; `getImageUrl` keeps the stored picture and the Google Places proxy and otherwise returns `null`. The image wrapper gained `w-10 h-10 rounded-md overflow-hidden bg-muted` so the icon panel has the same 40×40 box the photo already had; photo classes unchanged.
- Write/selection path: the preview item built from an outside result now carries `getPersistableEntityImageUrl(...)` — a real picture, or `null` exactly; registered placeholders → `null`. The saving steps (`createEntityFromExternal`, `createEntityQuick`, `entityOperations`) were already on the real-URL-or-null contract from Group 0B and are covered by `entityImageWritePaths.test.ts` / `useEntitySearchWritePaths.test.tsx`; the search-row creation path (`SearchResultHandler` → `useOptimisticEntityCreation` → `createEntityQuick`) passes through `validateImageUrlForStorage`, so no change was needed there.
- Tests: `src/components/search/group6LivePickers.test.tsx` (9, registered). Full suite 785/785, typecheck clean; focused lint shows only pre-existing `no-explicit-any` / exhaustive-deps findings in `EntitySearch.tsx`.

Still open: 6B (retire entity v1/v2/v3 — deletion manifest first), 6C (retire `ProductResultItem`, `RecommendationForm`), 6D (admin role classification first), 6E (`EntityTabsContent` broken-present-picture case), then the post-Group-6 cleanup list.

## Group 6B — legacy entity pages retired (done)
v1/v2/v3 and the version switch deleted; the /entity doorway always renders V4 and keeps the query string. Canonical ignores ?v=. Orphans recorded: EntityDetailSkeleton, DynamicReviewsSummary. See docs/verification/group-6b-legacy-entity-pages.md.

## Group 6C — unreachable pages and unused components retired (done)
Deleted ProductSearch (/product-search/:query), Books/Movies/Places/Food/Products pages and routes, ProductResultItem, RecommendationForm. No redirects — the old paths fall through to NotFound. The 6A ProductSearch row fix is therefore moot. See docs/verification/group-6c-retired-pages.md.

## Group 6D — admin pictures by role (done)
A (entity own thumbnail → shared type icon): AdminEntityManagementPanel (Entities tab table; "No Image" text replaced), AdminEntitiesPanel (Content tab), PendingEntitiesQueue (Moderation), AdminSuggestionsPanel, AdminClaimsPanel, ClaimReviewModal, ParentEntitySelector ("Part of", fixed wrappers), AdminProductRelationshipsPanel (optional slot kept — no image_url → no box). C (evidence → EvidenceImage, exact source, "Image failed to load" / "No image provided", no stock/icon/retry): DuplicateConfirmDialog, AdminEntityEdit manual-URL Preview (raw image_url). B untouched: candidates, uploads, auto-fill, create-search rows, photo moderation, image health, avatars. See docs/verification/group-6d-admin-images.md.
- 6D addendum: SuggestionReviewModal + ExactUrlDuplicateDialog closed (836 tests). 6E awaits approval.
- 6E done: entity page child cards (846 tests). Next: post-6 cleanup.

## Post-6 Step 1 (addendum)
- EntityProductsCard had zero importers (no lazy load, no tests), so it was dead code, not a live exception. It has been deleted. This corrects the 6E exception list: MyStuffItemCard is now the only remaining no-picture-area exception.
- EntityRelatedCard: removed the unused ImageWithFallback import. It only served commented-out example code. The live "Coming Soon" card is unchanged.

## Post-6 Step 2
- ImageWithFallback no longer supplies any stock photo. Location search keeps its own caller-provided food photo as a deliberate location exception. The review ImageUploader was dead code and has been deleted.

## Post-6 Step 3 — stock-photo lists deleted (2026-09-25)
- All four client `getEntityTypeFallbackImage` copies (imageUtils, urlUtils, entityImageUtils, entityTypeHelpers) and `fallbackImageUtils.ts` (`getCategoryFallbackImage`, `getRecommendationFallbackImage`) deleted after repo-wide zero-caller proof. See `post6-step3-stock-helpers.md`.
- The legacy-placeholder registry in `entityImageFallback.ts` stays: old saved records still hold those links.
- Step 3f (separate approval): server-side stock producers — `unified-search-v2` (own type list), `search-places`, `search-google-books`; `proxy-external-image` mention to be checked.

## Post-6 Step 3f — server-side stock producers removed (2026-09-25)
- `unified-search-v2` (local type-to-stock list deleted), `search-places` and `search-google-books` no longer invent images; they return `image_url: null` when the provider has no real photo. Real Google Places / Google Books / Amazon-OMDb imagery and their proxies are unchanged.
- `proxy-external-image` untouched: its `unsplash.com` entries are a pass-through allowlist, not a fallback.
- `ProductSearchResult.image_url` widened to `string | null` in `use-unified-search.ts` and `use-enhanced-search.ts` (type accuracy only; tsgo clean, no consumer assumed non-null).
- Verified: deno check per function (only pre-existing unrelated errors), 862 tests, build clean, and a live smoke where 11 of 101 sampled places returned `null` instead of a stock cafe photo. See `post6-step3f-server-stock-producers.md`.
- No server search function creates a stock URL any more. Remaining Unsplash references are the proxy allowlist, the legacy-placeholder registry (historical records), and the documented deliberate non-entity photos.
