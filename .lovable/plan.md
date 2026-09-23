# Group 3B — large photo areas on review and recommendation cards

Final step of the fallback-consistency work. Two cards still fall back to remote stock photographs when neither the review/recommendation nor its subject has a real image. They will use the same shared fallback contract as every migrated surface.

## What changes for the user

On a review card and a recommendation card, when there is no real photo:

- Today: a generic stock photograph of food / a shop / a book, fetched from the internet and unrelated to the actual subject.
- After: the same large area, same size and rounded corners, soft neutral background, with a centered icon for the subject's type (film, book, place, product...). Unknown type gets a neutral tag icon.

A missing image and a broken image now look identical. Real photos are untouched — where a review has its own photos, or the subject has a real image, nothing changes at all.

## Scope

Two files:

- `src/components/profile/reviews/ReviewCard.tsx` — the `h-48` fallback block (around line 646) and its `getFallbackImage` helper
- `src/components/recommendations/RecommendationCard.tsx` — the `h-48` fallback block (around line 362) and its `getFallbackImage` helper

Untouched in both: the `PostMediaDisplay` path for real user media, `shouldShowMedia` / `hideEntityFallbacks` logic, the entity-image-as-fallback step, badges, labels, rating rings, user avatars and initials, spacing, navigation, timelines, menus, and the compact variant's media block.

Everything previously declared out of scope stays out of scope: `MyStuffItemCard`, explore grids, carousels, entity headers, skeletons, admin, `ImageWithFallback` itself, `getOptimalEntityImageUrl`, the legacy stock-photo helpers, database rows, schema, generated types.

## Technical detail

1. Add one small local thumbnail component per card (mirroring `EntityChildThumbnail` / `RecommendationEntityThumbnail`) that:
   - resolves the single real source in the existing precedence — review/recommendation media, then legacy `image_url`, then the subject's image via the shared resolver — through `useEntityImageFallback` semantics (one real source, no second network request);
   - on missing or failed load renders the preserved wrapper `rounded-md overflow-hidden relative bg-gray-50 mt-2 mb-3 h-48` with a centered `getEntityFallbackIcon(resolvedType)` at proportional size (`h-12 w-12`), `role="img"` and an `aria-label` naming the subject so the missing-image state keeps accessible meaning.
2. Remove from both files: `ImageWithFallback` usage in this block, `getEntityTypeFallbackImage` in the fallback path, and the `'/placeholder.svg'` literal in `ReviewCard.getFallbackImage`. Keep `getEntityTypeLabel` / `getCanonicalType` imports, which serve the badges.
3. Type resolution stays strict: `resolvedType` from `resolveReviewDisplayType` in `ReviewCard`, `recommendation.category` parsed canonically in `RecommendationCard`. No coercion to `product`/`place`; unknown → neutral icon.
4. Tests: a new focused file `src/components/profile/reviews/group3bLargeThumbnails.test.tsx` registered in `vitest.config.ts`, covering — real image renders unchanged; missing image renders the type icon inside the preserved `h-48` frame; broken image converges to the same fallback; unknown type gets the neutral icon; no stock URL appears in either card's output.
5. Verification: focused tests, full suite, `bunx tsgo --noEmit`, focused lint on the two files (pre-existing findings reported separately), preview build, then close-out lines in `docs/verification/entity-image-fallback-inventory.md` and `roadmap.md`.

This closes the app-wide entity-image fallback consistency work.
