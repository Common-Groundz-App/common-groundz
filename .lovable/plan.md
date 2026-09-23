# Group 4 — search and selection result thumbnails

## Verified state of Groups 3A and 3B

Both groups are fully in place on the current branch, with no leftovers:

- The five migrated files (Saved card, chat entity card, entity preview card, profile Review card, Recommendation card) contain no remaining reference to the stock-photo helper, `ImageWithFallback`, `/placeholder.svg`, or an inline Unsplash address.
- All of them resolve their picture through the shared fallback contract, and the two large-area cards use the new shared renderer plus the separate source-classification module.
- Both focused test files are registered and running; the full suite is 750 passing, type check and build clean; evidence and checklist lines are recorded.

Nothing from 3A/3B needs rework, so Group 4 can start.

## What Group 4 covers

The small square thumbnails in the places where you *search for or pick* something. These are the last high-traffic small-thumbnail surfaces still showing borrowed stock photography:

1. Global search results (the search dialog and the search box in the header) — a 48×48 rounded thumbnail. Today a missing picture shows the words "No Image", and a broken picture quietly swaps in a stock photo of the wrong thing.
2. Product/external search rows in the same lists — a 48×48 rounded thumbnail that always falls back to a generic product photo.
3. The "pick something to recommend" / "add to My Stuff" search box — 40×40 thumbnails where *every* type has a hard-coded stock photo, so an item with no picture looks like it has one.

After this group, all three show the same thing as the rest of the app: the real picture when there is one, otherwise a calm neutral tile with the canonical icon for that type. Missing and broken look identical. Unknown types get the neutral icon, never a guessed one.

## One source-hygiene fix included

In the recommendation/My Stuff search box, when you select an external result the app currently copies the stock photo address into the item it creates, so a fake picture can get saved to the database. That line will stop substituting a stock address: a result with no real picture is carried through with no picture at all, exactly as the write rules established earlier in this programme require. Existing valid pictures are untouched, and nothing already saved is modified.

## Explicitly not in Group 4

Explore grids and featured/category highlights, sibling and related carousels, the entity page header and its skeletons, the legacy version-gated entity pages, every admin screen, the shared `ImageWithFallback` component, the legacy stock helpers, database rows, schema, generated types, and every user avatar or initials fallback. This group does not close the wider programme.

## Technical notes

Files to migrate:

- `src/components/search/SearchResultHandler.tsx` — replace the `result.image_url ? ImageWithFallback : "No Image"` branch with `useEntityImageFallback` + `getEntityFallbackIcon` inside the existing `w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group` wrapper. Keep the processing overlay, hover classes, and click handling exactly as they are. Real images keep `w-full h-full object-cover`.
- `src/components/search/ProductResultItem.tsx` — same inside the existing `w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0` wrapper; drop `entityType`/`suppressConsoleErrors` stock behaviour; parse `result.metadata?.type` through the canonical registry with no `'product'` coercion, unknown → neutral icon.
- `src/components/recommendations/EntitySearch.tsx` — migrate only the two entity/external result thumbnail branches (`w-10 h-10 object-cover rounded-md`). Delete the stock-photo `switch` tail of `getImageUrl`, keeping its real-source logic (`item.image_url`, then the Google Places photo proxy). `fallbackSrc={getImageUrl({})}` and the `onError` console logging go away — the local icon handles both cases. Remove the `|| getImageUrl(result)` substitution in the external-selection preview entity so no stock address is carried into creation.

Rules kept from earlier groups: one real source attempt then the local icon, no second network request, no stock photos, no `/placeholder.svg`, no entity initials, no guessed types, `getOptimalEntityImageUrl` unchanged globally, all frames/sizes/radii/crops/spacing/navigation/keyboard behaviour preserved verbatim, People/avatar rows untouched.

Tests: one focused file (`src/components/search/group4SearchThumbnails.test.tsx`, registered in `vitest.config.ts`) covering, per surface: real image renders with the exact preserved frame classes; missing → canonical icon with an accessible missing-image label; broken (error event) → identical icon and no second request; registered legacy placeholder → icon; unknown type → neutral icon with no `images.unsplash.com` and no `placeholder.svg` in the output; "No Image" text no longer rendered; the Google Places proxy source still wins; and the external-selection preview carries `image_url: null` instead of a stock address when the result has no real picture.

Verification: focused tests, full suite, `bunx tsgo --noEmit`, focused lint (pre-existing findings reported separately), preview build, then inventory and roadmap lines. Authenticated runtime capture is unavailable on this project, so a controlled fixture of a mixed result list (real / missing / broken / unknown) is captured for visual approval before close-out, and no further group starts.
