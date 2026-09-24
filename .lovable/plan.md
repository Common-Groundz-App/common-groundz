# 6D close-out gaps + Group 6E (entity page tab cards)

## 6D audit result
The ten migrated admin spots are correct, the tests are registered and the build is clean. The audit found **two admin picture spots that were missed**. Both still swap in a random stock photo:

| Where in admin | What it is | Role | Fix |
|---|---|---|---|
| Admin → Suggestions tab → open a suggestion → "Entity Information" (64×64 picture) | The entity's own picture | A | Shared type-icon panel |
| Admin → Entities → New Entity → paste a link that already exists → "already exists" window (48×48 per row) | Pictures of existing matching entities (comparison) | C | Truthful evidence box: picture / "Image failed to load" / "No image provided" |

Both keep their current source (Suggestion: optimal then raw, as today. Duplicate window: raw `image_url`). Frames, sizes and rounding stay as they are. The 6D note and inventory get a short addendum. Earlier evidence is not rewritten.

## Group 6E: entity page tab cards
Entity page → the tab that lists child items (grouped cards, each 32-unit-tall picture area on top).

- **Child with no picture:** stays exactly as today, with no picture area and no change in card height. This is an optional slot.
- **Child picture present but broken, or one of the old stock placeholders:** the canonical type icon shows inside the existing area, with no stock photo and no second request.
- **Real picture:** unchanged.
- The only code in this file that changes is the picture. Card, grid, hover shadow, click and text are all untouched.

These are recorded as intentional "no picture area" exceptions, with no code change: My Stuff item card and the entity products card.

## Technical details
- `SuggestionReviewModal.tsx`: `ImageWithFallback` becomes `EntityCollectionImage` inside a `w-16 h-16 rounded overflow-hidden flex-shrink-0` wrapper. The entity is passed as today, so the source precedence stays the same.
- `ExactUrlDuplicateDialog.tsx`: switches to `EvidenceImage` with raw `c.image_url` inside an `h-12 w-12 rounded bg-muted shrink-0 overflow-hidden` frame.
- `EntityTabsContent.tsx`: keeps the `child.image_url &&` guard and wrapper. Inside it, `EntityCollectionImage source={{ id, image_url }}`, `imageClassName="w-full h-full object-cover"`, `iconClassName="h-10 w-10"`. The `ImageWithFallback` and `getEntityTypeFallbackImage` imports are removed from these three files only.
- Tests: `src/components/entity-v4/group6eTabCards.test.tsx`, plus two cases added to the 6D test file. The tests cover no picture → no slot, broken → icon with no retry, placeholder → icon, real → unchanged, and duplicate window truthful states. The new test is registered in vitest.config.ts.
- Checks: the full suite, tsgo, focused lint and the build log. Then update the inventory, the roadmap and `docs/verification/group-6e-tab-cards.md`.
- Out of scope: ImageWithFallback itself, the stock helpers, getOptimalEntityImageUrl, the database, and Group B admin screens. Stop for approval before the post-6 cleanup.
