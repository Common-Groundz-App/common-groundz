# Group 6 — admin, remaining search pickers, and the internal legacy entity pages

Group 5 is confirmed complete: the entity page header picture area sits on the shared fallback contract, the stock substitution is gone from the page above it, the dead image property was removed, the refresh button keeps its strict three-way distinction, and the tests and written evidence are all in place. No leftovers.

Group 6 is the last set of picture areas still using the old behaviour. Everything after it is cleanup, not UI.

## What the user sees today

- Searching from the header or the search page: a result with no picture shows the words "No Image"; a result whose picture fails shows a random stock photograph instead.
- Adding something to My Stuff: the picker rows show a hard-coded stock photograph per type — and picking an outside result saves that stock address onto the new item, so the fake picture becomes permanent.
- Admin entity lists, pickers and review dialogs: entities without a picture fall through to stock photographs or a broken-image glyph.
- The two older entity page versions, reachable only by the internal team through a special link, still substitute a stock photograph before the header renders.

## What it becomes

Every one of those areas keeps its exact frame, size, rounding, crop, spacing and behaviour. Only the empty state changes: the same soft neutral panel with the centred canonical icon for the entity's type that the rest of the app now uses, with the neutral icon for unrecognised types. No text label, no initials, no stock photograph, no second attempt at another address.

The My Stuff picker also stops writing a stock address onto items created from an outside result: no real picture means no picture is stored.

## Scope

Live user-facing (6A):

- `src/components/search/SearchResultHandler.tsx` — the 48×48 row used by the header search, the search page and the product search page; replaces both the "No Image" text branch and the stock-photo branch.
- `src/components/recommendations/EntitySearch.tsx` — the 40×40 picker rows reached through the "add to My Stuff" flow; removes the per-type stock map from display, and removes the stock address from the item it creates when an outside result is picked.

Admin (6B) — every place that shows an entity's own picture:

- `src/components/admin/AdminEntitiesPanel.tsx`, `src/components/admin/AdminEntityManagementPanel.tsx`, `src/components/admin/ParentEntitySelector.tsx` (both slots), `src/components/admin/ClaimReviewModal.tsx`, `src/components/admin/AdminClaimsPanel.tsx`, `src/components/admin/SuggestionReviewModal.tsx`, `src/components/admin/AdminSuggestionsPanel.tsx`, `src/components/admin/entity-create/ExactUrlDuplicateDialog.tsx`, `src/components/admin/entity-create/DuplicateConfirmDialog.tsx`.

Internal legacy pages (6C):

- `src/pages/EntityDetail.tsx` (v1) and `src/pages/EntityDetailV2.tsx` (v2) — the 4:3 header block, plus v2's child-row and parent-row thumbnails. Reachable only for internal users via `?version=1|2`, but they still inject stock addresses, so they are finished rather than left behind.

Deliberately excluded, recorded as exceptions:

- `src/components/admin/entity-create/ImageCandidateGrid.tsx` and `src/components/admin/AutoFillPreviewModal.tsx` — the images there are candidate pictures under review, not an entity's own picture; a missing candidate is a different thing from a missing entity picture.
- `src/components/search/ProductResultItem.tsx` and `src/components/recommendations/RecommendationForm.tsx` — verified to have no remaining callers anywhere, so nothing renders them. Left untouched and recorded as unreachable; deleting files is a separate cleanup decision.
- Unchanged as before: `MyStuffItemCard`, `EntityDetailSkeleton`, the non-live `EntityRelatedCard` example, `EntityProductsCard`, `ImageWithFallback` itself, `getOptimalEntityImageUrl`, the legacy stock helpers, database rows, schema, generated types.

## Technical details

- Each slot renders through the existing shared pieces — `useEntityImageFallback` plus `getEntityFallbackIcon` — reusing `EntityCollectionImage` where a caller-controlled renderer fits, so no new fallback component is introduced.
- Real-image source precedence is preserved per surface, exactly as in Group 4: surfaces already calling `getOptimalEntityImageUrl` keep passing the whole entity; surfaces reading `image_url` directly pass only `{ id, image_url }` so a stored metadata photo can never displace the picture shown today.
- `ImageWithFallback` and its `entityType` / `fallbackSrc` stock retry are dropped from every migrated slot; unused imports (`getEntityTypeFallbackImage`, `EntityType` where it becomes unused) are removed.
- `EntitySearch.tsx`: the `getImageUrl` helper keeps its real-source logic — stored `image_url`, and the Google Places photo proxy for place/food — and loses only the type-keyed stock `switch`, returning `null` instead. The `fallbackSrc={getImageUrl({})}` arguments disappear with it.
- `EntitySearch` write path: the object built when an external result is selected stores `image_url: null` exactly when there is no real picture — never `''`, never a stock address; a legitimate picture is preserved untouched.
- Every fallback element carries `role="img"` and an `aria-label` naming the entity, so the missing-image state keeps accessible meaning.
- A registered legacy placeholder address continues to count as missing; a legitimate, unregistered Unsplash photo that is a surface's real picture still renders normally.

## Tests

New `src/components/search/group6RemainingSurfaces.test.tsx` and `src/components/admin/group6AdminThumbnails.test.tsx`, both registered in `vitest.config.ts`:

- each migrated slot keeps its frame and image classes verbatim (48×48, 40×40, the 4:3 header block, admin row sizes);
- source precedence preserved per surface — optimal resolution where it exists, raw `image_url` where that is current behaviour, with an entity carrying both a raw picture and a different stored metadata photo;
- missing → canonical type icon with accessible label; broken → identical icon and no second request; registered legacy placeholder → icon, its address absent from output;
- unknown type → neutral icon; no `/placeholder.svg` rendered and no stock address introduced as a fallback;
- a legitimate unregistered Unsplash photo still renders as the real picture;
- the "No Image" text no longer appears in the search row;
- write-path coverage extending `src/hooks/useEntitySearchWritePaths.test.tsx`: selecting an external result with no picture stores `image_url: null` exactly, and one with a real picture preserves it.

## Verification and close-out

Focused tests, full suite, `bunx tsgo --noEmit`, focused lint (pre-existing issues reported separately, not fixed), build log check, and controlled desktop (1280px) and mobile (390px) fixtures of the migrated row and header frames — authenticated and admin runtime capture is unavailable for this project, so fixtures stand in, as in earlier groups. Then close-out evidence in `docs/verification/entity-image-fallback-inventory.md` and roadmap lines.

Stop after Group 6 for visual approval. Still open afterwards: `ImageWithFallback` simplification or retirement, legacy stock-helper deletion once zero active callers are proven, the optional historical database cleanup, the `getOptimalEntityImageUrl` resolver decision, and the final inventory audit.
