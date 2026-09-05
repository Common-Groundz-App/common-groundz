# Original plan audit: what's left, and is it worth doing

## Verdict

Phases 0 through 3 are done. The only real leftover is **Phase 4 — recommendations taxonomy alignment**, and it is worth doing, because the gap is not cosmetic: recommendations are still limited to five subject kinds while reviews accept all fifteen.

## What I verified on disk / in the database

Phase 1 (done)
- `entityTypeMapping.ts` no longer exists.
- Registry-driven labelling is live: `getChildPresentation` is used in `EntityDetailV2`, `EntityTabsContent`, `EntityChildrenCard`, `RelatedEntitiesSection`; the "Featured Products" hardcode is gone, replaced by a registry label with a generic fallback.
- Offering context line is live via `getOfferingContextLine` in `EntityHeader` and `ReviewForm`.

Phase 2 and 3 (done)
- Review subject is entity-first, subject creation goes through the provider/offering registry (`SubjectQuickCreate` uses `getProviderTypesFor`), config-driven questionnaires with a generic fallback and a JSON answers envelope are in place, plus the Phase 3C/3D close-out documents and tests.

Phase 4 (not done)
- `RecommendationCategory` in `src/services/recommendation/types.ts` still exists with its own vocabulary (`Food, Drink, Movie, Book, Place, Product, Activity, Music, Art, TV, Travel, Brand`), and is still consumed by `entityService.ts`, `hooks/feed/api/recommendations.ts`, `types/entities.ts`.
- The database column `recommendations.category` is a Postgres enum `recommendation_category` with only five values: `food, movie, book, place, product`.
- All nine existing rows already store canonical lowercase values (`product` 4, `movie` 2, `food` 2, `place` 1) — so no data migration is needed.
- The TS enum's capitalised values (`Drink`, `TV`, ...) can never be written to that column, so seven of its twelve members are unreachable dead vocabulary that would fail at insert time.
- `RecommendationForm` hardcodes the picker to the same five strings; `RecommendationCard` already renders canonical labels through `getCanonicalType` / `getEntityTypeLabel`.

## Is it worth implementing?

Yes, and for a product reason rather than tidiness: a user can write a review about a TV show, course, app, game, event, service, professional or experience, but cannot recommend one. Closing Phase 4 makes the recommend flow accept the same fifteen kinds as everything else and removes the last competing vocabulary.

## Proposed Phase 4 work

1. Widen the database enum
   - Add the ten missing canonical values to `recommendation_category` so it mirrors the canonical entity types (`brand, event, service, professional, others, tv_show, course, app, game, experience`).
   - No row rewrite, no grant change; existing values keep working. Additive only, so it is reversible in practice.

2. Retire `RecommendationCategory` in TypeScript
   - Replace it with the canonical `EntityType` string union already used everywhere else.
   - Delete the two hand-written maps in `entityService.ts` and `hooks/feed/api/recommendations.ts`, parsing through `parseEntityTypeAtBoundary` instead, keeping the existing behaviour that an unparseable legacy value is not silently coerced into `product`.
   - Update `types/entities.ts` and any type-only references.

3. Recommendation form and filters
   - Drive the category picker from the canonical type list (and from the picked entity's type when one is selected) instead of the five hardcoded strings, reusing the shared type labels and icons so no component re-declares vocabulary.
   - Drive `RecommendationFilters` labels from the shared label helper, dropping its local `labels` map.

4. Tests and checks
   - Cover: canonical parse at the recommendations boundary, unknown legacy value handling, form default derived from entity type, and a filters label snapshot.
   - Finish with the full vitest run, `tsgo --noEmit`, and a production build, plus a grep audit confirming no `RecommendationCategory` references remain.

Out of scope, as in the original plan: the `reviews.category = subject.type` database constraint stays deferred until Phase 2 behaviour has been live for a while.

## Technical notes

- The enum widening is one migration; because it only adds labels to an existing enum type, it needs no policy or grant changes and touches no rows.
- Adding values to a Postgres enum cannot run inside the same transaction that then uses them, so the migration only adds values; all reads/writes of the new values ship in the application code afterwards.
- The canonical list and the provider/offering registry stay the single source of vocabulary; the recommendation components consume it rather than restating it.
