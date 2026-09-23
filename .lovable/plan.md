# Group 4 — Explore grids and carousels

Yes, there is a saved document: `docs/verification/entity-image-fallback-inventory.md`. It uses exactly your numbering, and its Group 4 line lists Featured Entities, Category Highlights, Sibling Carousel and the entity detail skeleton. This plan follows that document and your summary, so my earlier "Group 4 = search rows" numbering is dropped; those search rows move into the remaining-surfaces group instead.

## Groups 3A and 3B — verified complete

- None of the five migrated files still reference the stock-photo helper, the shared retry image component, `/placeholder.svg`, or an inline stock address.
- All of them resolve pictures through the shared fallback contract; the two big-picture cards use the new shared renderer plus the separate source-classification module.
- Both focused test files are registered and passing; full suite 750, type check and build clean; evidence and checklist lines recorded.

No rework needed, so Group 4 can start.

## What Group 4 changes

The larger entity pictures in collections. Live surfaces:

1. Explore — Featured entities (192px-tall picture area) and the Discover / category rows (128px-tall picture areas, three separate blocks in one file).
2. Entity page — the "other items like this" sibling strip (256px-wide cards with a 128px-tall picture) and the related-items grid (square picture areas).
3. Entity page sidebar — the related-by-creator rows (40×40 thumbnails).

Behaviour after this group, on every one of them:

- Real picture → unchanged, same crop, same hover zoom.
- No picture, broken picture, or one of the known old stock addresses → the canonical icon for that item's type on the existing neutral tile.
- Unrecognised type → the neutral icon, never a guessed one.
- Missing and broken look identical; one real attempt, then the local icon, no second request.

Every card keeps its current aspect ratio, crop, radius, spacing, hover behaviour, and layout. No picture area is added where one doesn't exist, and none is removed.

## Two judgement calls inside this group

- **Bigger empty areas.** The Featured entities tile is the largest in this group. The icon treatment already approved for the profile cards (neutral tile, centred icon) is reused here so the app stays consistent. I will capture a controlled desktop and mobile fixture of the grid and carousel empty states before close-out, and adjust only icon size or background tone if it reads sparse — never the frame.
- **The loading skeleton stays out.** The entity detail skeleton is a loading placeholder, not a missing-picture state; it renders while data is still arriving and has no entity to resolve. Recommendation: leave it as a pure loading state and record that decision in the inventory so it stops appearing as deferred work.

## Explicitly not in Group 4

The responsive entity header and other large hero placeholders (your Group 5, needs its own visual decision), admin screens and version-gated legacy pages (Group 6), the global search and recommendation-picker rows I inventoried (they still show stock photos — folding them into Group 6 rather than expanding this one), the shared retry image component, the legacy stock helpers, the global resolver, database rows, schema, generated types, My Stuff cards, and every user avatar or initials fallback.

## Technical notes

Files to migrate, each through `useEntityImageFallback` + `getEntityFallbackIcon` inside the existing wrapper:

- `src/components/explore/FeaturedEntities.tsx` — `h-48 relative` block; remove `fallbackSrc="/placeholder.svg"` and the `entityType` stock path.
- `src/components/explore/CategoryHighlights.tsx` — all three `h-32 relative` blocks (personalised, type-filtered, and default lists); same removals.
- `src/components/entity/SiblingCarousel.tsx` — `w-full h-32 rounded-md overflow-hidden bg-muted mb-3`; drop the `getEntityTypeFallbackImage` import and preserve `group-hover:scale-105 transition-transform` on real images.
- `src/components/entity/RelatedEntitiesSection.tsx` — `aspect-square mb-3 rounded-md overflow-hidden bg-gray-100`; same hover preservation.
- `src/components/entity/EntityRelatedCard.tsx` — `w-10 h-10 rounded overflow-hidden bg-muted` row thumbnail (live via `EntitySidebar`, not commented out).

Types parsed through the canonical registry, no `product`/`place` coercion. Badges, labels, links, keyboard behaviour and skeleton loaders untouched. `getOptimalEntityImageUrl` unchanged globally; legacy placeholder recognition only through the shared contract.

Tests: one focused file (`src/components/explore/group4GridCarouselImages.test.tsx`, registered in `vitest.config.ts`) asserting per surface: real image renders with the exact preserved wrapper and crop classes; missing → canonical icon with an accessible missing-image label; broken (error event) → identical icon and no second request; registered legacy placeholder → icon; unknown type → neutral icon with no stock address and no `/placeholder.svg` in the output; hover-zoom classes still present on real images.

Verification: focused tests, full suite, `bunx tsgo --noEmit`, focused lint (pre-existing findings reported separately), preview build, then inventory + roadmap lines recording this group and the skeleton decision, plus the still-open Group 5/6 and cleanup items. Authenticated runtime capture is unavailable on this project, so controlled fixtures stand in; I stop for your visual approval and do not begin Group 5.

roadmap.md will also get the new lines from your message: Group 5 (entity header / large placeholders, visual decision), Group 6 (admin, legacy, plus the search and recommendation-picker rows), retry-component cleanup, legacy helper cleanup, optional historical data cleanup, global resolver decision, and the final inventory audit.
