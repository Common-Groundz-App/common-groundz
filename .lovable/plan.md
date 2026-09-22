# Entity fallback consistency — close Groups 0A/0B/1, then Group 2A

## Audit verdict

Groups 0A/0B/1 are correctly implemented and stayed within scope:

- all 15 canonical entity types use the shared local-icon mapping, while unknown types use the neutral icon;
- exact known legacy stock URLs are recognized without treating all Unsplash images as placeholders;
- missing and broken images converge on the same fallback and reset when the entity or source changes;
- the global image resolver and `ImageWithFallback` were not changed;
- only the selected composer chip adopted the shared fallback, retaining its 32px pill and 20px circular frame;
- the three traced creation paths now save a real image or nothing, while existing valid images are preserved;
- no data cleanup, helper deletion, or later-group migration leaked into the completed work.

Two verification leftovers remain, so the groups are not yet formally closed:

1. write behavior is tested at the shared-helper level, but the changed creation paths have no direct regression tests;
2. the selected chip's presentation is documented from its preserved styles, not from runtime evidence.

## Step 1 — close the prerequisite proof gate (no Group 2 work)

- Add focused mocked-write tests for each of the three changed creation paths, asserting the actual saved payload:
  - new entity with a valid real image saves that image;
  - new entity with no image saves an explicit empty image value, not an omitted or undefined field;
  - new entity whose only image is an exact registered legacy placeholder also saves that explicit empty value;
  - new entity with a legitimate Unsplash image that is not in the registry keeps and saves that image;
  - an existing entity is reused and receives no image update at all;
  - a failed image lookup never clears an existing valid image.
- Capture the selected composer chip at desktop and mobile widths. If authentication prevents a real capture, use a controlled component fixture and state plainly that the authenticated runtime capture was unavailable, rather than inferring the result from styles.
- Confirm the pill stays 32px high, the circular image stays 20×20px, and missing and broken images produce the same icon.
- In the same chip proof, verify source reset end to end: an entity whose image fails shows the fallback, and switching to a different entity with a valid image renders that real image instead of inheriting the previous failure.
- Record the evidence, then stop. If anything fails, fix only Groups 0A/0B/1 and stop again. Step 1 touches no rendering surface, no shared image resolver, no `ImageWithFallback`, no helper cleanup, and no existing data.

## Step 2 — Group 2A: search and selection rows (only after Step 1 passes)

Adopt the shared image-source/failure contract in these four surfaces only:

1. Search result rows — keep the 48×48 rounded-square frame and cover crop.
2. Product-search rows — keep the 48×48 rounded-square frame and cover crop.
3. Review subject selection — keep the 48×48 rounded-square frame, cover crop, and lazy loading.
4. Composer/review selector dropdown rows — keep both variants: 44×44 rounded-square in the modal and 32×32 rounded inline.

For each surface:

- keep the wrapper, dimensions, shape, crop mode, spacing, loading behavior, text, navigation, and accessibility exactly as they are;
- resolve a real image through the existing shared resolver;
- treat only exact registered legacy placeholders as missing;
- attempt the real source once, then show the canonical local icon in the same frame;
- make missing and broken sources produce the identical local fallback;
- use the neutral icon for unknown or malformed types, never Product or Place;
- add no remote stock fallback, no `/placeholder.svg`, no initials, no second request, no second type map.

Remove now-unused fallback imports from these four files only; shared helpers stay in place for unmigrated callers.

Then verify and stop for visual approval before Group 2B.

## Step 3 — Group 2B: entity-context rows (separately approved later)

Deferred to its own gate: entity child rows, the entity sidebar parent row, the entity sidebar related rows, and the circle recommendation thumbnail.

Group 2B also carries one product decision that will not ride along silently. Entity child rows currently resolve the child's own image, then substitute the parent entity's image, then a stock type image. The surrounding code treats this as a convenience shortcut — the same pattern also borrows the parent's description — but that reading will be documented explicitly before anything changes. If it is only a fallback shortcut, the child's canonical type fallback replaces it. If it turns out to be intentional relationship context, the parent substitution is preserved and raised as a separate product decision. Either way it is approved in writing before implementation.

## Explicit exclusions

- Entity tab child cards: their image region is optional, so adding a fallback would change card layout. Deferred to the card/grid group.
- The related-entities card: its image row exists only as commented-out example code; nothing live to migrate.
- Related-entities sections, Saved cards, My Stuff cards, recommendation/review cards, chat cards, carousels, explore grids, entity headers, admin surfaces, and version-gated legacy pages.
- `ImageWithFallback`, shared helper deletion, database row cleanup, schema changes, and generated types.
- Existing keyboard behavior on clickable rows; this pass is source-only and freezes interaction markup.

## Technical approach

- Reuse the shared fallback hook and canonical icon resolver inside each surface's existing image wrapper, rather than routing square frames through the circular `EntityImage`.
- Keep `EntityImage` as the circular convenience renderer.
- Leave the global image resolver unchanged.
- Add focused renderer tests per migrated surface covering valid, missing, broken, exact-placeholder, unknown-type, and source-change cases.

## Verification and stop gates

- Run focused tests, the full suite, typecheck, and focused lint; report pre-existing issues separately.
- Check desktop and mobile views for each migrated surface.
- Confirm real images look identical to before and each frame's computed size, radius, and crop match its pre-migration values.
- Confirm one real-image request only, followed directly by a local icon on failure.
- Update the inventory document and roadmap with exact evidence.
- Stop after Step 1. Stop again after Group 2A. Do not start Group 2B or the card/grid group.
