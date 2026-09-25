# Post-6 Step 3 — old stock-photo lists removed

## Zero-caller proof (before deletion)
`rg -n "getEntityTypeFallbackImage|getCategoryFallbackImage|getRecommendationFallbackImage|fallbackImageUtils" src supabase scripts docs`
showed only the definitions themselves, the taxonomy test, `fallbackImageUtils.ts` internals, historical notes in `docs/`, and the server-side copy in `unified-search-v2` (Step 3f, untouched). No screen, service, hook or write path called any of them.

## Deleted
- 3a `getEntityTypeFallbackImage` from `src/utils/imageUtils.ts` (kept: `getProxyUrlForImage`, `isValidImageUrl`, `saveExternalImageToStorage`, proxy helpers)
- 3b `getEntityTypeFallbackImage` from `src/utils/urlUtils.ts` (kept: `ensureHttps`, `isValidUrl`, CORS helpers)
- 3c `getEntityTypeFallbackImage` from `src/utils/entityImageUtils.ts` (kept: `getOptimalEntityImageUrl`, `validateImageUrlForStorage`, `isStoredImageUrl`, `isProxyUrl`, `EntityImageSource`)
- 3d `src/utils/fallbackImageUtils.ts` deleted whole (`getCategoryFallbackImage`, `getRecommendationFallbackImage`)
- 3e `getEntityTypeFallbackImage` from `src/services/entityTypeHelpers.ts`; taxonomy test renamed to `has a label and icon for every canonical type` (fallback import/assertion removed, 15-type loop kept); stale comment in `reviewDisplayType.ts` updated

## Kept on purpose
- `src/utils/entityImageFallback.ts` unchanged — canonical icons + legacy-placeholder recognition (old saved stock links still exist in records)
- Deliberate single photos: profile default cover, location food photo, reviews-section founder photo, review avatar default
- Server side untouched: `unified-search-v2` (own type list), `search-places`, `search-google-books`, `proxy-external-image` (mention needs checking) — all inventoried for Step 3f

## Final sweep
After deletion the same `rg` shows only `unified-search-v2/index.ts` (Step 3f scope). No client stock-photo list remains.

## Checks
- `bunx vitest run`: 862 passed (59 files)
- `bunx tsgo --noEmit`: clean
- Focused lint: 2 pre-existing `no-explicit-any` in `entityImageUtils.ts` metadata type (lines 39–40), untouched by this step
- No new test file and no `vitest.config.ts` change (per review: absence is proven by search + typecheck + build, not a runtime test)
