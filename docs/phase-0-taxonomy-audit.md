# Phase 0 — Taxonomy Audit Baseline

Captured: 2026-08-21 (UTC) against Supabase project `uyjtgybbktgapspodajy`.

This document is the reproducible baseline for the canonical-type / provider-offering work.
It is **documentation only** — no application code reads anything from this file, and no row ID
listed here is referenced by code or tests. Code handles *shapes*, never specific rows.

## Query used

```sql
select 'entities_by_type' k, type::text a, null::text b, count(*) c from public.entities group by 1,2,3
union all
select 'parent_child_pairs', p.type::text, c2.type::text, count(*) from public.entities c2 join public.entities p on p.id = c2.parent_id group by 1,2,3
union all
select 'reviews_by_category', category::text, null, count(*) from public.reviews group by 1,2,3
union all
select 'reviews_null_entity', 'null_entity_id', null, count(*) from public.reviews where entity_id is null
union all
select 'review_cat_vs_entity_type', r.category::text, e.type::text, count(*) from public.reviews r join public.entities e on e.id = r.entity_id group by 1,2,3
union all
select 'recommendations_by_category', category::text, null, count(*) from public.recommendations group by 1,2,3
order by 1, 4 desc;
```

Mismatch listing:

```sql
select r.id, r.category::text cat, e.type::text etype
from public.reviews r
join public.entities e on e.id = r.entity_id
where r.category::text <> e.type::text
order by 2, 3;
```

## Results

### Entities by type (344 total)

| type | count |
| --- | --- |
| place | 104 |
| product | 88 |
| brand | 54 |
| book | 49 |
| movie | 48 |
| food | 1 |

Nine canonical types have zero rows: `tv_show`, `course`, `app`, `game`, `experience`, `event`,
`service`, `professional`, `others`.

### Parent/child pairs by type

| provider type | offering type | count |
| --- | --- | --- |
| brand | product | 45 |

`place → food` has zero rows today. It is already legal at the database level (no type check
constraint on `parent_id`).

### Deprecated types in data

Zero rows for `tv`, `activity`, `music`, `art`, `drink`, `travel`. The Supabase `entity_type`
enum contains only the 15 canonical values, so removing the deprecated TypeScript enum members
requires **no migration**.

### Reviews by category (72 total)

| category | count |
| --- | --- |
| place | 20 |
| food | 20 |
| product | 16 |
| movie | 9 |
| book | 7 |

### Reviews with no entity

27 reviews have `entity_id IS NULL`. These are legitimate fixtures for the "free-text subject"
path and must keep rendering.

### Review category vs entity type

| review.category | entity.type | count | status |
| --- | --- | --- | --- |
| place | place | 18 | aligned |
| food | place | 12 | **mismatch** (dish reviewed on a restaurant) |
| movie | movie | 5 | aligned |
| product | brand | 5 | **mismatch** (product reviewed on a brand) |
| book | book | 3 | aligned |
| product | product | 2 | aligned |

17 mismatched rows total (12 food-on-place, 5 product-on-brand). They are retained deliberately:
they are the regression coverage for exactly the ambiguity the provider/offering model resolves.

Mismatched review IDs (documentation only):

- food on place: `efe29097-c66e-4ce7-b9a3-fa2ff31a82d6`, `bb34286f-e985-49b6-849c-a5b741a15a89`,
  `6d892dc4-8850-44b7-abb4-ae7b9ff6a94c`, `a130be08-29f9-4e94-abae-340c216c91bd`,
  `48a6649d-f9cf-40ff-9666-176b9cb7ec8b`, `7138298d-f828-4060-9f57-1b52d7ab9e68`,
  `c55e7509-7eec-45bc-b6e7-72ce8263053a`, `a662cd50-9e6a-440a-8362-42762960281b`,
  `b3db50f7-e150-4625-aa50-d9f692fc41db`, `3b6c733b-9fea-4f16-93b2-df6486058124`,
  `72c6fed2-d346-4360-b187-9dd29eb44397`, `1828050c-35fb-4cdc-8914-2e228435c699`
- product on brand: `5f8b37c1-979a-4fcf-bd57-fa949c51f493`, `9372bc39-ff4d-44c7-bb1e-309c90f814ad`,
  `0202c150-62a9-4ed5-bcec-501037a3d6ca`, `338698d9-fc29-4122-9224-7cea2a868d90`,
  `be981e3e-09fd-4849-93c0-a55487878e2e`

### Recommendations by category (9 total) — audit only

| category | count |
| --- | --- |
| product | 4 |
| food | 2 |
| movie | 2 |
| place | 1 |

Recommendations are explicitly **out of scope** for Phase 0. Recorded for reference only.

## Consumer inventory (0.2)

Readers/writers of `entities.type`:

- `src/services/entityTypeHelpers.ts` — canonical normalization, labels, icons, fallback images.
- `src/services/entityType.ts` (new in Phase 0) — canonical list + strict parser, React-free.
- `src/hooks/feed/api/types.ts` — `mapStringToEntityType` / `mapEntityTypeToString` boundary.
- `src/components/recommendations/RecommendationCard.tsx` — route + badge colour maps.
- `src/components/profile/reviews/ReviewCard.tsx` — badge colour map.
- `src/components/profile/reviews/ReviewForm.tsx` — `getReviewCategory` (entity type → review category).
- `src/components/profile/reviews/steps/StepThree.tsx` — category-driven copy.
- `src/components/feed/UnifiedEntitySelector.tsx`, `src/hooks/use-unified-search.ts`,
  `src/components/search/SearchResultHandler.tsx`, `src/pages/Search.tsx` — search result typing.
- `src/pages/EntityDetailV2.tsx`, `src/components/entity-v4/*`, `src/components/entity/FeaturedProductsSection.tsx` — rendering.
- Edge functions: entity creation/enrichment paths write `type` directly from validated payloads.

Readers/writers of `parent_id`:

- `src/services/entityHierarchyService.ts` (`setEntityParent`, hierarchical slug generation).
- `src/hooks/use-entity-siblings.ts`, `src/hooks/use-related-entities.ts` — type-agnostic reads.
- SQL: `get_child_entities`, `get_child_entities_with_ratings`.

`reviews.category` write behaviour is unchanged in Phase 0. Target future invariant:
`reviews.category === subject.type`. Not enforced yet.

## Known gaps inherited by Phase 1

- `FeaturedProductsSection.tsx` hardcodes "Featured Products" / "View All N Products".
- The hierarchical slug rule (`parentSlug-childSlug`) exists only inside `setEntityParent`.
- `entities.parent_id` FK is `ON DELETE SET NULL` — deleting a provider orphans its offerings.
- `entities.category_id` is single-valued, so multi-classifying a dish is unsolved.
- `place` is broader than "restaurant": food-serving is a taxonomy property, not a type guarantee,
  and must not be enforced in the database.
