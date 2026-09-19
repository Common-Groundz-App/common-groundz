# Step 5 — App-wide entity-image fallback inventory (audit only)

Audit and document only. No component, helper, query, schema, or visual change in this step.

## What the first pass already shows

Two competing systems decide what an entity thumbnail looks like:

1. The newer contract — `getOptimalEntityImageUrl()` picks the best real image, and the shared circular `EntityImage` falls back to a **local icon** per canonical type. Live only on the two composer/posted pills.
2. The older path — `ImageWithFallback`, used by roughly 35 files, which on a missing or broken image loads a **remote Unsplash stock photo**. This is the behaviour on explore, search, entity detail, saved items, review cards, recommendation cards and chat cards.

There are four separate type-to-fallback-image maps (`utils/entityImageUtils.ts`, `utils/imageUtils.ts`, `services/entityTypeHelpers.ts` via `utils/fallbackImageUtils.ts`) — all pointing at hard-coded Unsplash URLs, two of them probably unreachable. Most surfaces already call `getOptimalEntityImageUrl`, so the resolution half is mostly consistent; the **fallback** half is not.

Shape matters: the shared component is hard-coded `rounded-full`. Only the pills and the selected-entity chip in the composer selector are circular. Everything else is square, rounded-rect, `aspect-video`, 4:3 or a hero banner, so a presentation-agnostic variant is a prerequisite — not a like-for-like swap.

## Work in this step

1. Close the open questions by reading each file end to end: `EntityResultItem`, `EntitySidebar`, `ProductCard`, `MyStuffItemCard`, `RecommendationsModal`, `UnifiedEntitySelector` (selected chip has no error handler), `ProductSearch`. Record the exact resolver, missing-image behaviour, broken-image behaviour and whether a second network request happens.
2. Prove liveness of the duplicate helpers by tracing every import and re-export before labelling anything dead: `getCategoryFallbackImage`, `getRecommendationFallbackImage`, `entityTypeHelpers.getEntityTypeFallbackImage`, `entityImageUtils.getEntityTypeFallbackImage`, `imageUtils.getEntityTypeFallbackImage`.
3. Write `docs/verification/entity-image-fallback-inventory.md` containing:
   - the full matrix: surface | route/flow | file | entity types | resolver | missing behaviour | broken behaviour | second network request? | fallback local or remote | size, shape, object-fit | alt/decorative | status (live, specialized, non-visual, admin-only, legacy) | can adopt the shared contract without layout change? | risk.
   - every helper classified KEEP / MIGRATE THEN REMOVE / DEAD PENDING PROOF / NON-VISUAL.
   - explicit exclusions: every `supabase/functions/*` image reference (ingestion, refresh, migration, cleanup, enrichment, search, notifications), `utils/imageUtils` storage and proxy builders, entity hero photography, review media galleries, profile covers, avatars, location imagery, SEO/structured-data URLs.
4. Add one inventory-gate line to `roadmap.md`.
5. Propose migration groups ordered by risk, each with exact files, expected visual result, tests and a stop gate:
   - Group 0 (prerequisite): make the shared contract presentation-agnostic — shape, size and object-fit driven by the caller, circular staying the default for the pills.
   - Group 1: circular/avatar-like — the composer selector's selected chip and its avatar fallback.
   - Group 2: small square list thumbnails — search results, product search, review subject picker, entity children, entity sidebar.
   - Group 3: cards — saved items, recommendation cards, recommendation entity card, review card, chat entity card.
   - Group 4: curated grids and carousels — featured entities, category highlights, sibling carousel.
   - Group 5 (separate decision): entity hero/header and the 4:3 detail placeholder.
   - Admin surfaces last, or deliberately left alone.

## Explicitly not touched in this step

Posted and composer pills, the shared `EntityImage` component, `getOptimalEntityImageUrl`, all four fallback helpers, every rendering surface, every edge function, database, generated types and routing.

## Deliverable

The inventory document, the inconsistencies found, the duplicate-helper classification, the recommended first migration group, files explicitly excluded, unresolved questions and risks — then stop for approval before any migration.
