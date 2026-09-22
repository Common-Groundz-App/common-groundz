# Entity fallback consistency — close Groups 0A/0B/1, then Group 2

## Audit verdict

Groups 0A/0B/1 are correctly implemented and stayed within scope:

- all 15 canonical entity types use the shared local-icon mapping, while unknown types use the neutral icon;
- exact known legacy stock URLs are recognized without treating all Unsplash images as placeholders;
- missing and broken images converge on the same fallback and reset when the entity or source changes;
- `getOptimalEntityImageUrl` and `ImageWithFallback` were not globally changed;
- only the selected composer chip adopted the shared fallback, retaining its 32px pill and 20px circular frame;
- the three traced client creation paths now save a real image or `null`, while existing valid images are preserved;
- no data cleanup, helper deletion, or Group 2+ migration leaked into the completed work.

Two verification leftovers prevent a literal “nothing remains” close-out:

1. write behavior is tested at the shared-helper level, but the changed creation paths do not yet have direct regression tests;
2. the selected chip’s desktop/mobile presentation is documented from its preserved classes, but authenticated runtime screenshots were not successfully captured.

## Step 1 — close the prerequisite proof gate

- Add focused mocked-write tests for the changed creation paths:
  - new entity with a valid real image saves that image;
  - new entity with no image or an exact known placeholder saves `null`;
  - an existing entity is returned unchanged rather than being overwritten;
  - an image-resolution failure does not clear an existing valid image.
- Capture the selected composer chip in the authenticated create flow at desktop and mobile widths.
- Confirm the pill remains 32px high, the circular image remains 20×20px, missing/broken states use the same icon, and no surrounding layout shifts.
- If either proof fails, fix only Groups 0A/0B/1 and stop before Group 2.

## Step 2 — migrate active small-thumbnail surfaces

Adopt the shared image-source/failure contract in these active surfaces only:

1. Search result rows (`EntityResultItem`) — retain the 48×48 rounded-square frame and cover crop.
2. Product-search rows — retain the 48×48 rounded-square frame and cover crop.
3. Review subject selection — retain the 48×48 rounded-square frame, cover crop, and lazy loading.
4. Entity child rows (`EntityChildrenCard`) — retain the 48×48 rounded frame and cover crop.
5. Entity sidebar parent row — retain the 48×48 rounded frame, inner padding, and contain fit.
6. Entity sidebar related rows — retain the 32×32 rounded frame and cover crop.
7. Circle-recommending entity cards (`RecommendationEntityCard`) — retain the 64×64 rounded frame and cover crop.
8. Composer/review selector dropdown rows — retain both existing variants: 44×44 rounded-square in the modal and 32×32 rounded in the inline selector.

For each migrated surface:

- keep the existing wrapper, dimensions, shape, crop mode, spacing, loading behavior, text, navigation, and accessibility unchanged;
- resolve a valid real image through `getOptimalEntityImageUrl`;
- treat only exact registered legacy placeholders as missing;
- attempt the real source once, then render the canonical local icon in the same frame;
- make missing and broken sources produce the identical local fallback;
- use the neutral icon for unknown or malformed types, never Product or Place;
- do not add remote stock fallbacks, `/placeholder.svg`, initials, a second request, or a second type map.

`EntityChildrenCard` will no longer substitute the parent’s image when the child has no usable image; it will show the child type’s canonical fallback in the unchanged frame. This is a source-only correction.

## Explicit exclusions

- `EntityTabsContent` children cards: these use an optional full-width 128px image region, not a small list thumbnail. Showing a fallback when the region is currently absent would alter card layout, so defer it to the grid/card group.
- `EntityRelatedCard`: its image-row example is commented out and nothing live can be migrated; leave it untouched.
- `RelatedEntitiesSection`, Saved cards, My Stuff cards, recommendation/review cards, chat cards, carousels, explore grids, entity headers, admin surfaces, and version-gated legacy pages.
- `ImageWithFallback`, broad helper cleanup, database row cleanup, schema changes, and generated types.
- Pre-existing keyboard behavior on clickable rows; accessibility refactoring is separate because this pass freezes interaction markup.

## Technical approach

- Reuse `useEntityImageFallback` and `getEntityFallbackIcon` inside each surface’s existing image wrapper rather than forcing square and rectangular surfaces through circular `EntityImage`.
- Keep `EntityImage` as the circular convenience renderer.
- Do not change `getOptimalEntityImageUrl` globally.
- Remove legacy stock-helper imports only from the migrated call sites after proving those imports have no other use in the same file; do not delete shared helpers yet.
- Add focused renderer tests for representative sizes/crop modes plus missing, broken, valid, exact-placeholder, unknown-type, and source-change behavior.

## Verification and stop gate

- Run focused fallback, write-path, and migrated-surface tests, then the full test suite and typecheck.
- Run focused lint on new/shared files and record any pre-existing issues separately.
- Verify live desktop and mobile views for search rows, review subject selection, entity sidebar rows, and both selector-dropdown variants where fixtures are available.
- Confirm valid real images are visually unchanged and each frame’s computed dimensions, radius, and object-fit match its pre-migration contract.
- Confirm one real-image request only, followed directly by a local icon on failure.
- Update the verification matrix and roadmap with exact evidence.
- Stop after these eight active surfaces; do not begin the card/grid group.