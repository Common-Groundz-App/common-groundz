# Group 3B — large subject-image area on profile review and recommendation cards

Closes the large-fallback group for the profile Reviews and Recs cards. The wider fallback programme stays open: explore grids, carousels, entity headers, skeletons, admin, version-gated legacy pages, `ImageWithFallback` and the legacy fallback helpers remain deferred or intentionally exempt.

## What changes for the user

These cards can show four different things in the large image area today. Only one of them changes:

- Photos the author uploaded — unchanged.
- An older single uploaded photo — unchanged.
- The subject's own picture, used when the author uploaded nothing — still shown, unchanged when it loads.
- A generic stock photograph from the internet when nothing above exists — this disappears.

In its place, the same large area keeps its size, rounded corners and spacing, with a soft neutral background and a centred icon for the subject's type. A subject picture that is missing, broken, or one of the known old stock placeholders now all look the same. On entity pages, where these cards deliberately show no filler image at all, nothing appears — exactly as today.

## Scope

- `src/components/profile/reviews/ReviewCard.tsx` (live via `ProfileReviews`; entity-detail callers pass `hideEntityFallbacks` + `compact`)
- `src/components/recommendations/RecommendationCard.tsx` (live via `ProfileRecommendations`)

Not touched: `src/components/ReviewCard.tsx` (Entity V4 reviews), `PostFeedItem` recommendation posts, `RecommendationEntityCard`, journey and chat cards, `MyStuffItemCard`, explore grids, carousels, headers, skeletons, admin, `ImageWithFallback`, `getOptimalEntityImageUrl`, legacy stock helpers, database rows, schema, generated types. Badges, labels, rating rings, timelines, menus, avatars and initials, navigation and all spacing stay as they are.

## Technical detail

### 1. Separate author media from the subject-image fallback

Today `mediaItems` merges author media, legacy `image_url` **and** the entity image, so a broken entity URL renders inside `PostMediaDisplay` and can never reach a fallback. Fix the classification in both cards:

- `mediaItems` keeps only author-authored sources (`review.media` / `recommendation.media`, then legacy `image_url`). The entity image is removed from this array.
- `shouldShowMedia` is derived from author media only, preserving today's outcome for those cases.
- A new local component (`ReviewEntityFallbackImage` / `RecommendationEntityFallbackImage`) renders the subject image when there is no author media and entity fallbacks are allowed (`!hideEntityFallbacks`). It uses `useEntityImageFallback`, so valid / missing / broken / registered-placeholder sources converge: one real source, then `getEntityFallbackIcon(resolvedType)` centred in the preserved wrapper `rounded-md overflow-hidden relative bg-gray-50 mt-2 mb-3 h-48`, icon `h-12 w-12`, `role="img"` with an `aria-label` naming the subject.
- When `hideEntityFallbacks` is true, neither the subject image nor the icon renders — the current suppression is preserved exactly.
- Remove from these paths: `ImageWithFallback`, `getEntityTypeFallbackImage` in the fallback, the `'/placeholder.svg'` literal in `ReviewCard.getFallbackImage`, and the `getFallbackImage` helpers themselves. `getEntityTypeLabel` / `getCanonicalType` stay for the badges.
- Strict types: `resolvedType` from `resolveReviewDisplayType`; `recommendation.category` parsed canonically. No coercion to `product`/`place`; unknown → neutral tag icon.

Visual note: where the entity image loads, the large area renders the same real image through the same frame and `object-cover` as today.

### 2. Tests

New focused file `src/components/profile/reviews/group3bLargeFallback.test.tsx`, registered in `vitest.config.ts`, covering both cards:

- author media present → author media still wins, entity fallback absent
- no author media + valid entity image → entity image renders in the preserved frame
- no author media + no entity image → type icon in the preserved frame
- entity image present but broken (error event) → same type icon, no second request, no stock URL
- registered legacy placeholder as entity image → same type icon
- unknown / unresolvable type → neutral icon
- `hideEntityFallbacks` true → no entity image and no icon block at all
- no stock photo URL appears in either card's rendered output

### 3. Visual fixture before close-out

Render a controlled desktop and mobile fixture of the empty state, capture both, and review the balance of the neutral background plus centred icon in the ~192px-tall area. If it reads too sparse, adjust only fallback presentation (icon size, background tone) — never the frame, card structure, or spacing — and re-capture. Then stop for visual approval.

### 4. Verification

Focused tests, full suite, `bunx tsgo --noEmit`, focused lint on the two files (pre-existing findings reported separately), preview build, then close-out lines in `docs/verification/entity-image-fallback-inventory.md` and `roadmap.md` recording this as the profile review/recommendation large-fallback group, with the remaining deferred groups still listed as open.
