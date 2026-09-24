# Post-Group-6 cleanup: Step 2 (the old picture helper)

## Check result: 6E and Step 1
- 6E is complete. The child tab cards use the shared rules, nothing from the old helper is left in that file, and the tests are registered.
- Step 1 is complete. The unused product list card has been deleted, and the unused line is gone from the related-items card, which still shows "Coming Soon". All 846 checks pass and the type check is clean.
- Nothing else is left over from Group 6. The old helper is now used only on screens where the picture does not belong to an entity.

## Step 2: what changes on each screen when a picture fails
| Screen | Today | After |
|---|---|---|
| Profile → cover banner | Your default cover | **Same** (it keeps its own default) |
| Location search in the post composer | Its own food photo | **Same** (it keeps its own photo) |
| Review → upload a photo → preview | Random stock photo | The existing box stays empty, so you can see the upload is broken |
| Admin → New Entity → search rows (two lists) | Random stock photo | The existing box stays empty |
| Admin → New Entity → image candidates | A product stock photo, then the candidate is marked broken | The candidate is marked broken, as today, with no stock photo |
| Admin → auto-fill preview (image choices and the preview row) | A type stock photo | The existing box stays empty |

Box sizes, corners and layout are unchanged on every screen. A picture that works looks exactly as it does today.

## What changes in the helper
- The built-in random photo and the type-to-photo lookup are removed. A screen gets a fallback only if it supplies its own.
- The second attempt (after the proxy fails, it loads the picture directly) is removed. Each picture makes one request, then shows the fallback or stays empty.
- If there is no link at all, the helper draws nothing instead of loading a stock photo.

**Stop** after Step 2. The next steps are unchanged and each needs its own approval:
- **Step 3:** delete the old stock-photo lists, one at a time, once each has no users left.
- **Step 4:** optional database tidy-up, which needs a separate yes.
- **Step 5:** the central-rule decision and the final inventory.

## Technical details
- In `src/components/common/ImageWithFallback.tsx`, drop the `entityType` prop, the `getEntityTypeFallbackImage` import, the default Unsplash URL and the `proxyAttempted` retry branch. When there is no fallback: `src` is empty → render `null`; on error → hide the `<img>` (render `null`), then call `onError` once. When `fallbackSrc` is set: swap to it once, and never loop if the fallback itself fails.
- Remove `entityType=` from ImageCandidateGrid and from both AutoFillPreviewModal sites. The `markBroken` logic in ImageCandidateGrid is untouched.
- Remove the `images.unsplash.com` entry from `shouldUseCors` only if nothing else relies on it. If something does, keep it and record why.
- New test `src/components/common/imageWithFallbackStep2.test.tsx`, registered in vitest.config.ts. It checks:
  - No src and no fallback → renders nothing, with no request.
  - An error with no fallback → hidden, with no second request and `onError` called once.
  - An error with a fallback → the fallback is used exactly once.
  - A failed fallback → no loop.
  - A real image → unchanged src and classes.
  - No Unsplash or `/placeholder.svg` appears unless the caller supplies it.
- Checks: the full suite, tsgo, focused lint and the build log. Notes go in `docs/verification/post6-step2-image-helper.md`, the inventory and the roadmap.
