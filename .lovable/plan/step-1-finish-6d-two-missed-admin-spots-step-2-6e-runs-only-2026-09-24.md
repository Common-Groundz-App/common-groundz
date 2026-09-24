# Step 1: finish 6D (two missed admin spots). Step 2 (6E) runs only after you approve step 1.

## 6D audit result
The ten migrated admin spots are correct, the tests are registered and the build is clean. The audit found two admin picture spots that were missed. Both still swap in a random stock photo, so 6D is **not** closed yet.

## Step 1: 6D addendum (this approval)
| Where in admin | Role | Result |
|---|---|---|
| Suggestions tab → open a suggestion → "Entity Information" (64×64) | Entity's own picture | Real picture, or the type-icon panel if it's missing, broken or an old stock placeholder. Unknown type → neutral icon |
| New Entity → paste a link that already exists → "already exists" window (48×48 per row) | Comparison evidence | Exactly what is stored: the picture, "Image failed to load", or "No image provided". No type icon, no stock photo, no other photo. An old stock link that is really stored is shown as it is, because that tells you something |

- Current sources stay the same. Suggestion: optimal, then raw, as today. Duplicate window: raw link only. Frames and sizes are unchanged.
- **Reset check:** moving to a different suggestion or duplicate row clears any failed state, so the next good picture shows normally.
- **My addition:** in the duplicate window, a broken row next to a good row must not affect the good one.
- A short addendum goes to the 6D note, the inventory and the roadmap. Earlier evidence is not rewritten. EntityTabsContent is not touched in this step. **Stop.**

## Step 2: 6E, entity page tab cards (separate approval, after step 1)
Entity page → the tab listing child items (the picture area on top of each card).
- `image_url` is null or empty → **no picture wrapper is drawn at all**, and card height is unchanged.
- The picture is present but fails to load → the existing wrapper stays and only its contents switch to the type icon. No stock photo, no second request.
- An old stock placeholder → the same icon. A real picture → unchanged. Unknown type → neutral icon.
- **My addition:** a whitespace-only link counts as no picture, so no empty box appears.
- MyStuffItemCard and EntityProductsCard are recorded as intentional "no picture area" exceptions, with no code change. **Stop** before the post-6 cleanup.

## Technical details
- Step 1, `SuggestionReviewModal.tsx`: `EntityCollectionImage` inside a `w-16 h-16 rounded overflow-hidden flex-shrink-0` wrapper, with the entity passed as today.
- Step 1, `ExactUrlDuplicateDialog.tsx`: `EvidenceImage` with raw `c.image_url` inside an `h-12 w-12 rounded bg-muted shrink-0 overflow-hidden` frame, keyed per row.
- Step 1 tests: added to `group6dAdminImages.test.tsx` (states, reset on source change, row isolation).
- Step 2, `EntityTabsContent.tsx`: keep the `child.image_url &&` guard (trimmed) and the `w-full h-32 rounded-md overflow-hidden bg-muted mb-3` wrapper. Render `EntityCollectionImage source={{ id, image_url }}` with `object-cover` and icon `h-10 w-10`. Remove `ImageWithFallback` and `getEntityTypeFallbackImage` imports only if unused afterwards. The tests go in the new `group6eTabCards.test.tsx`, registered in vitest.config.ts.
- Each step runs the full suite, tsgo, focused lint and a build log check.
- Out of scope: ImageWithFallback globally, the stock helpers, getOptimalEntityImageUrl, the database, and Group B admin screens.
