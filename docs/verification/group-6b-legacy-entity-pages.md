# Group 6B — legacy entity pages v1/v2/v3 retired

## Deleted
- `EntityDetailOriginal` (v1): the large block inside `src/pages/EntityDetail.tsx`, along with its imports
- `src/pages/EntityDetailV2.tsx` (v2)
- `src/components/entity-v3/EntityV3.tsx` and `EntityV3Header.tsx` (v3)
- `src/utils/entityVersionUtils.ts` (the version switch)

## Kept on purpose
- `src/pages/EntityDetail.tsx`: now a small doorway that always lazy-loads V4. The lazy import moved to module scope. It keeps the same `Suspense` and `EntityV4LoadingWrapper` loading screen, and builds the loading name from the slug. It does no redirect and no query rewrite.
- `src/components/entity-v4/**`: untouched.
- The `src/App.tsx` routes `/entity/:slug` and `/entity/:parentSlug/:childSlug`: unchanged.
- `use-entity-detail`, `use-entity-detail-cached`, `entityRedirectService`, `EntityRelatedCard`, `EntityMetadataCard`, `EntitySpecsCard`, `EntityCategoryBadge`, `CircleContributorsPreview`, `ReviewTimelineViewer`, `use-circle-rating`: all still used by other screens.

## Orphans recorded, not deleted
These now have no live caller and are left for the later cleanup plan:
- `src/components/entity/EntityDetailSkeleton.tsx`
- `src/components/profile/reviews/DynamicReviewsSummary.tsx`

## Pre-deletion proof
Outside the retired files, no file referenced `EntityDetailV2`, `entity-v3`, `EntityV3`, `entityVersionUtils`, `getEntityPageVersion` or `EntityDetailOriginal`. No tests or lazy imports pointed at them either.

## Verification
`src/pages/group6bEntityDoorway.test.tsx`, 24 tests:
- (a) Route selection, with V4 mocked. For `/entity/<slug>` and `/entity/<parent>/<child>`, each of these renders V4 and leaves the query string unchanged: no query, `?v=1`, `?v=2`, `?v=3`, `?v=4`, `?preview=true`, `?v=junk` and `?compose=review`. The deleted modules no longer exist, and the doorway has no redirect.
- (b) Metadata on the real V4, with its data hooks mocked. For every query variant, the canonical is `<origin>/entity/<slug>` with no query, and the title comes from the entity.

Full suite: 809/809 passing. Typecheck clean.

Signed-in runtime capture is not available for this project, because it uses an external Supabase. Redirects, ID addresses and not-found screens go through the V4 code, which was not changed.

Historical phase records (`phase-0-*`, `phase-4-*`) are deliberately left unchanged.
