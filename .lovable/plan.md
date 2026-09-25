# Post-Group-6 cleanup: Step 3 (delete the old stock-photo lists)

## Step 2 check result
- Complete, with no leftovers. The picture helper has no built-in stock photo, no type lookup and no `entityType` setting.
- The old review photo preview is gone and nothing refers to it.
- The only remaining mention is inside a commented-out example in the "Coming Soon" related card. It never runs and stays as it is.
- The latest build is clean.

## What Step 3 removes (one at a time, each proven unused first)
| # | Stock-photo list | Who uses it today | Action |
|---|---|---|---|
| 3a | Type photo list in the general image tools | Nobody | Delete |
| 3b | Type photo list in the link tools | Nobody | Delete |
| 3c | Type photo list in the entity image tools | Nobody | Delete |
| 3d | Category and recommendation photo file (whole file) | Nobody outside the file itself | Delete the file |
| 3e | Type photo list in the entity type helpers | Only 3d and one old taxonomy test | Delete after 3d. Remove only the one test line that checks it returns a web link |

Nothing changes on screen, because no screen calls any of these any more.

## Kept on purpose (not touched)
- **The legacy-placeholder list.** This is how the app recognises old saved stock links and shows the icon instead. It must stay.
- **Profile default cover, location food photo, the founder photo on the reviews section, the review avatar default.** These are separate, deliberate photos. They are not type lists, and they are recorded in the inventory.
- **The server-side search function's own stock list.** It still adds stock photos to some search results. It runs on the server and can affect saved data, so it gets its own step (**3f**), with a separate plan and your approval. It is only reported here.

## Rules
- Before each deletion, a fresh search of the whole app, including tests and dynamic imports, must show zero callers.
- One deletion at a time, then run the full checks.
- Stop after 3e. Then 3f, Step 4 (optional database tidy-up) and Step 5 (central rule and final inventory), each with its own approval.

## Technical details
- 3a: remove `getEntityTypeFallbackImage` from `src/utils/imageUtils.ts`
- 3b: remove `getEntityTypeFallbackImage` from `src/utils/urlUtils.ts` (`ensureHttps` stays)
- 3c: remove `getEntityTypeFallbackImage` from `src/utils/entityImageUtils.ts` (`getOptimalEntityImageUrl`, `validateImageUrlForStorage` and the others stay)
- 3d: `rm src/utils/fallbackImageUtils.ts` (`getCategoryFallbackImage`, `getRecommendationFallbackImage`)
- 3e: remove `getEntityTypeFallbackImage` from `src/services/entityTypeHelpers.ts`. Drop that import and assertion in `src/services/__tests__/entityTaxonomyCompatibility.test.ts`. Update the comment in `reviewDisplayType.ts`
- Registry in `src/utils/entityImageFallback.ts` stays unchanged
- Add a guard test `src/utils/post6Step3NoStockHelpers.test.ts` that asserts none of these exports exist, then register it in vitest.config.ts
- Checks: `bunx vitest run`, `bunx tsgo --noEmit`, focused lint and the build log. Notes go in `docs/verification/post6-step3-stock-helpers.md`, plus updates to the inventory and the roadmap
