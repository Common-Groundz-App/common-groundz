# Step 5 — Entity-image fallback consistency inventory (audit only)

Audit and document only. No component, helper, query, schema, or visual change in this step.

## The objective, narrowed

We are standardising **only what appears when an entity has no usable image**, not how entity images are presented. Every surface keeps its existing width, height, aspect ratio, circle/square/rounded shape, border radius, object-fit, spacing, position, surrounding UI and navigation exactly as they are.

Target contract, one decision everywhere:

```text
entity → getOptimalEntityImageUrl() → real image
                    ↓ missing OR broken (same outcome)
        canonical local icon for the entity's canonical type
        neutral icon for unknown/malformed types
        no remote stock photo, no second network request
        state resets when the entity or source changes
```

The icon simply sits inside whatever frame the surface already has — circular in a pill, square in a search row, 4:3 in a card.

## What the first pass suggests (hypotheses, to be proven)

- Two fallback systems coexist: the pills use `getOptimalEntityImageUrl` plus a **local** canonical icon; most other surfaces route through `ImageWithFallback`, which falls back to **remote Unsplash stock photos** and also retries a second network request on error.
- Roughly 35 files touch `ImageWithFallback`; four separate type-to-stock-image maps exist across `utils/entityImageUtils.ts`, `utils/imageUtils.ts`, `services/entityTypeHelpers.ts` and `utils/fallbackImageUtils.ts`; two may be unreachable.
- Real-image resolution is already largely consistent (~24 surfaces call `getOptimalEntityImageUrl`); the inconsistency is concentrated in the fallback layer.

These counts and the suspected dead helpers are treated as unproven until caller and route tracing confirms them. Nothing is classified dead on the strength of a missing component import alone — it may be re-exported or used by non-visual processing.

## Work in this step

1. Read each unresolved surface end to end and record its actual behaviour: `EntityResultItem`, `ProductResultItem`, `ProductSearch`, `ProductCard`, `EntitySidebar`, `EntityChildrenCard`, `SiblingCarousel`, `MyStuffItemCard`, `RecommendationCard`, `RecommendationEntityCard`, `RecommendationsModal`, `ReviewCard`, `ChatEntityCard`, `SubjectSelectStep`, `UnifiedEntitySelector`, `FeaturedEntities`, `CategoryHighlights`, `EntityHeader`, `EntityDetailSkeleton`, plus the admin surfaces.
2. Trace every caller and re-export of each fallback helper before classifying it.
3. Write `docs/verification/entity-image-fallback-inventory.md` with:
   - the matrix: surface | route/flow | file | resolver | missing-image behaviour | broken-image behaviour | second network request? | fallback local or remote | current size/shape/aspect/object-fit (recorded so it can be frozen) | alt/decorative | status (live, non-visual, admin-only, legacy) | how it can adopt the shared fallback decision without any presentation change | risk.
   - every helper classified KEEP / MIGRATE THEN REMOVE / DEAD PENDING PROOF / NON-VISUAL.
   - explicit exclusions: all `supabase/functions/*` image work (ingestion, refresh, migration, cleanup, enrichment, search, notifications), storage/proxy URL builders, review media galleries, profile covers, user avatars, location imagery, SEO/structured-data URLs.
4. Propose the **smallest shared mechanism** that centralises the fallback decision while every renderer keeps its own markup. Compare the realistic options rather than assuming one: a shared resolver plus canonical-icon function consumed by existing markup, a small shared hook that owns source and failure state, or the existing `EntityImage` where a surface is already circular and identical in behaviour. No surface is required to adopt `EntityImage`.
5. Propose migration groups ordered by risk, each listing exact files, the fallback change, tests, and a stop gate: prerequisite contract; circular thumbnails; small square/rectangular thumbnails; cards; curated grids and carousels; heroes and large detail placeholders (separately gated — swapping a large stock photograph for an icon is a real product decision); admin surfaces last or excluded.
6. Add one inventory-gate line to `roadmap.md`.

## Acceptance rule carried into every future migration group

When a valid real entity image exists, the surface must be visually and structurally equivalent before and after migration. The only intended difference is what shows when the image is missing or fails. Dimensions, aspect-ratio and `rounded-*` classes, object-fit, padding, margins, surrounding layout, navigation and accessible labelling stay as they are; loading behaviour changes only where required to remove the second fallback request.

## Explicitly not touched in this step

Posted and composer pills, `EntityImage`, `getOptimalEntityImageUrl`, all fallback helpers, every rendering surface, every edge function, database, generated types and routing. The earlier "make `EntityImage` presentation-agnostic" idea is withdrawn as an assumption; whether any shared component work is needed at all is an audit output, not a premise.

## Deliverable

The inventory document, the inconsistencies found, the duplicate-helper classification, the proposed minimal fallback contract, the recommended first migration group, files explicitly excluded, unresolved questions and risks — then stop for approval before any migration or helper deletion.
