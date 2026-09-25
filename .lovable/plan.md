# Post-Group-6 cleanup: Step 3 (delete the old stock-photo lists), revised

## Step 2 check result
- Complete, with no leftovers. The picture helper has no built-in stock photo, no type lookup and no `entityType` setting.
- The old review photo preview is gone and nothing refers to it.
- The only remaining mention sits inside a commented-out example in the "Coming Soon" related card. It never runs and stays as it is.
- The latest build is clean.

## My view on the two reviews
I agree with all of it. Three changes are now in the plan:
- **Proof across the whole project, not just the app screens** (ChatGPT). Every check now covers server code, tests and fixtures too.
- **No permanent "these are gone" test file** (Codex). That would only be testing the shape of the project, which the type check, the build and a search already prove. Dropped.
- **The taxonomy test gets renamed, not just trimmed** (Codex), so its name matches what it actually checks.

One thing I would add myself: after the deletions, a final sweep confirms no stock photo lists remain anywhere in the app screens, so the inventory entry is honest rather than assumed.

## What Step 3 removes (one at a time, each proven unused first)
| # | Stock-photo list | Who uses it today | Action |
|---|---|---|---|
| 3a | Type photo list in the general image tools | Nobody | Delete |
| 3b | Type photo list in the link tools | Nobody | Delete |
| 3c | Type photo list in the entity image tools | Nobody | Delete |
| 3d | Category and recommendation photo file (whole file) | Nobody outside the file itself | Delete the file |
| 3e | Type photo list in the entity type helpers | Only 3d and one old taxonomy test | Delete after 3d, then fix and rename that test |

Nothing changes on screen, because no screen calls any of these any more.

## Kept on purpose (not touched)
- **The legacy-placeholder list.** This is how the app recognises old saved stock links and shows the icon instead. It must stay, even for links nothing produces any more, because old saved records still hold them.
- **Profile default cover, location food photo, the founder photo on the reviews section, the review avatar default.** Deliberate single photos, not type lists. Recorded in the inventory.
- **Everything else in those files:** the https helper, the best-image chooser, the storage checks, the proxy helpers.

## Reported, not done here: the server side (Step 3f)
The reviews are right that there is more than one. Server functions that still produce stock photos:
- unified search (its own type-to-photo list)
- place search (a place photo)
- book search (a book photo)
- the image relay also mentions the same photo site and needs checking before any change

These run on the server and can flow into saved records, so **Step 3f inventories all of them first** and comes with its own plan and your approval. Nothing here touches them.

## Rules
- Before each deletion, a fresh search across the **whole project** — app screens, server functions, tests, fixtures, index files and dynamic imports — must show zero callers.
- One deletion at a time.
- After 3e: a final project-wide search, then the focused picture and taxonomy tests, then the full suite, type check, focused code check and the build.
- Stop after 3e. Then 3f, Step 4 (optional database tidy-up) and Step 5 (central rule and final inventory), each with its own approval.

## Technical details
- 3a: remove `getEntityTypeFallbackImage` from `src/utils/imageUtils.ts`
- 3b: remove `getEntityTypeFallbackImage` from `src/utils/urlUtils.ts` (`ensureHttps`, `isValidUrl`, CORS helpers stay)
- 3c: remove `getEntityTypeFallbackImage` from `src/utils/entityImageUtils.ts` (`getOptimalEntityImageUrl`, `validateImageUrlForStorage`, `isStoredImageUrl`, `isProxyUrl` stay)
- 3d: `rm src/utils/fallbackImageUtils.ts` (`getCategoryFallbackImage`, `getRecommendationFallbackImage`)
- 3e: remove `getEntityTypeFallbackImage` from `src/services/entityTypeHelpers.ts`; in `src/services/__tests__/entityTaxonomyCompatibility.test.ts` drop the import and the `toMatch(/^https?:\/\//)` assertion and rename the case to `has a label and icon for every canonical type`, keeping the loop over all 15 canonical types; update the stale comment in `src/components/profile/reviews/reviewDisplayType.ts`
- `src/utils/entityImageFallback.ts` is unchanged — icons plus legacy-placeholder recognition
- No new test file, and no change to `vitest.config.ts`
- Proof commands: `rg -n "getEntityTypeFallbackImage|getCategoryFallbackImage|getRecommendationFallbackImage|fallbackImageUtils" src supabase scripts docs` before each step, and once more at the end
- Checks: `bunx vitest run`, `bunx tsgo --noEmit`, focused lint and the build log. Notes go in `docs/verification/post6-step3-stock-helpers.md`, plus updates to `docs/verification/entity-image-fallback-inventory.md` and `roadmap.md` (including the 3f server-side list)
