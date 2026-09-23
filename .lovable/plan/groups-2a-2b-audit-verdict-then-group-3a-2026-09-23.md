# Groups 2A / 2B audit verdict, then Group 3A

## Audit verdict: 2A and 2B are complete on the current branch

An outside review claimed Group 2B is not present. Direct reads of the current files show that claim is stale:

- `EntityChildrenCard.tsx` — no `ImageWithFallback`, no `getEntityTypeFallbackImage`, no `getChildImage`, no parent-image lookup. It renders `EntityChildThumbnail` on `useEntityImageFallback(child)` + `getEntityFallbackIcon(child.type)`. The remaining `parentEntity` usage is the approved description fallback, not an image source.
- `EntitySidebar.tsx` — parent and related rows use `useEntityImageFallback`; no `ImageWithFallback`, no `/placeholder.svg`, no v4 URL helper.
- `docs/verification/entity-image-fallback-inventory.md` contains the "Group 2B close-out evidence" section; `roadmap.md:324` records Group 2B completion (724 tests, typecheck, build).
- All five Group 2A slots are migrated; entity initials removed, user avatar initials untouched.

Nothing is outstanding from 2A or 2B.

## Group 3A — card thumbnails (this step)

Three card surfaces still decide fallback images their own way. Only the image-source decision changes; every frame, size, radius, crop, spacing, navigation and label stays exactly as it is.

| Surface | Frame (unchanged) | Today | After |
|---|---|---|---|
| `mystuff/saved/SavedEntityCard.tsx` | 64×64 `rounded-lg`, object-cover | raw `image_url`; own 6-type icon map when absent; remote stock when broken | shared resolver; canonical type icon for missing **and** broken alike |
| `chat/ChatEntityCard.tsx` | 48×48 `rounded-md`, object-cover | stock photo pre-resolved with `\|\|`, unknown type coerced to `product`, `onError` swaps in another stock URL | one real source, then canonical icon; unknown type → neutral icon, never coerced |
| `common/EntityPreviewCard.tsx` | responsive `w-full sm:w-24 h-24` bordered `rounded-lg`, object-cover | inline hard-coded Unsplash literal; visible "No image" text block when absent | shared resolver; canonical icon centred in the same bordered responsive frame |

### Explicit decision for EntityPreviewCard

- Its only live caller is `profile/reviews/steps/StepThree.tsx` (review creation) — entity-only, so the entity fallback contract applies cleanly.
- Replacing the visible "No image" text with the canonical type icon is the **one intentional fallback-content change** in this group. It is approved explicitly here; the general "labels stay exactly as they are" rule does not cover this text.
- The icon fallback must keep accessible meaning for the missing-image state: the fallback element carries `role="img"` with an `aria-label` naming the entity (same convention as `EntityImage`), so removing the visible text leaves no unlabeled state.
- The frame is responsive (`w-full sm:w-24 h-24`), not a fixed 96×96 — preserved verbatim.

Rules carried over unchanged: real images render identically; missing and broken produce the same local icon; unknown/malformed types get the neutral icon; one real-source attempt only, no second network request, no stock photo, no `/placeholder.svg`, no initials; failure state resets when the entity changes.

## Deferred to Group 3B (separate approval, not now)

- `recommendations/RecommendationCard.tsx` and `profile/reviews/ReviewCard.tsx` — the `h-48` "no media" blocks currently show a large stock photo. Replacing a full-width photo with an icon is a visible product change, so it gets its own review with before/after evidence.
- `mystuff/MyStuffItemCard.tsx` — stays as agreed: no image block renders when there is no image; introducing one would change card height.

Also untouched: explore grids, carousels, entity headers, skeletons, admin and version-gated pages, `ImageWithFallback`, `getOptimalEntityImageUrl`, the shared legacy helpers, database rows, schema, generated types, keyboard markup, and every user/profile avatar or initials fallback.

## Technical approach

- Reuse `useEntityImageFallback(entity)` and `getEntityFallbackIcon(entity.type)` inside each existing wrapper; keep wrapper class strings verbatim and render the icon centred at the established proportional size.
- `SavedEntityCard`: delete its local 6-type icon map (file-local only) and read the image through the shared resolver instead of raw `image_url`.
- `ChatEntityCard`: remove both stock helpers and the `onError` stock reassignment; drop the `'product'` type coercion.
- `EntityPreviewCard`: remove the inline Unsplash literal and the "No image" text block, keeping the same responsive bordered frame; icon fallback carries the accessible label described above.
- Remove now-unused imports from these three files only; shared helpers stay for unmigrated surfaces.

## Verification

- Focused tests for the three surfaces: real image unchanged, missing → canonical icon, broken (error event) → identical icon, registered legacy placeholder → icon, unknown type → neutral icon, entity-switch reset, frame size/radius preserved; for EntityPreviewCard also that the fallback state exposes an accessible label and that no "No image" text remains.
- Full suite, `bunx tsgo --noEmit`, focused ESLint (pre-existing issues reported separately), preview build.
- Record close-out evidence in `docs/verification/entity-image-fallback-inventory.md` and a roadmap line.
- Authenticated screenshots remain unavailable (`external_unmanaged`); rendered-output assertions stand in, stated honestly.

Stop after Group 3A for visual approval. Do not start Group 3B, explore grids, carousels, headers or admin.
