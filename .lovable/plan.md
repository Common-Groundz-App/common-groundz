# Phase 2 — Entity-first review subject (category step deleted, dish-under-place creation)

## Phase 1 verification result (done first)

Full audit passed. Confirmed: `getChildPresentation`/`getOfferingContextLine` contract, `RelatedEntitiesSection` rename, registry-driven tab/sidebar/header labels, tab hidden at zero children, `handleViewAllChildren` real tab switch, context line "Dish at {Place}" / "Product by {Brand}", `SiblingCarousel` "Related" fallback, `entityTypeMapping.ts` deleted with zero importers, full registry test coverage. The only `handleViewAllProducts` left is inside `EntityDetailV2.tsx`, which Phase 1 explicitly excluded.

One conditional item never applied: the plan said "if the tab key is synced to the URL, map legacy `?tab=products`". V4 tab state was never URL-driven (only `?compose=` is), so nothing broke — but deep-linking to the children tab is impossible. **Phase 2.0 below closes this out.**

---

## What Phase 2 changes (plain words)

Today the review form has 4 steps: Rating → **Category** → Subject+media → Details. The category step is redundant (the entity already has a type) and actively harmful: it squashes 15 canonical types into 5 buckets (`course/app/game` → "product", `experience` → "place"), and it makes dishes un-reviewable — a "food" review links to the *restaurant* entity while the dish name is throwaway free text.

Phase 2 makes the **entity the subject**:

1. **Delete the category step.** 3 steps: Rating → Subject → Details. `reviews.category` is *derived* from the selected entity's canonical type (`reviews.category` is a plain `text` column — verified — so all 15 types fit with no DB change).
2. **Cross-type subject search.** Step 2's type-scoped `EntitySearch` (searches only places when category=food, etc.) is replaced by one search across all 15 types, built on the same `useEnhancedRealtimeSearch` engine + `CreateEntityDialog` the `/create` composer already uses — single-select, since a review has exactly one subject.
3. **Dishes become first-class.** Searching a dish finds `food` entities; "can't find it" opens creation where a `food` entity **requires a parent `place`**, guarded by `assertValidOfferingPair('place','food')`, slug built hierarchically (`truffles-classic-burger`). The dish page then shows "Dish at Truffles" (Phase 1) and the dish appears under the restaurant's "Dishes" tab. Reviewing the restaurant itself still works — select the place, category becomes `place`.
4. **Subject is required for new reviews.** The old "just fill in the details below" free-text path is what produced entity-less reviews (8 of 20 food, 9 of 16 product reviews have no entity). The escape hatch is now *create the entity inline* instead of skipping it. Legacy reviews stay untouched: editing one keeps its stored category and lets you attach an entity.

## The changes in detail

### 2.0 — Phase 1 close-out: URL-synced V4 tab
`EntityV4.tsx`: read/write `?tab=` (write only `children`; map legacy `?tab=products` → children on read). Enables deep links to the children tab and fulfills Phase 1's test bullet.

### 2.1 — DB migration: hierarchical slugs for `place→food` (verified gap)
The DB slug functions are **not** pair-aware today:
- `generate_entity_slug(name, entity_id)` hardcodes `parent_type='brand' AND current_type='product'` — a food child gets a flat slug.
- `generate_entity_slug_on_insert` (INSERT trigger) calls the **one-arg** version — it ignores `parent_id` entirely, so even products inserted with a parent get a flat slug on insert (the comment in `createEnhancedEntity` claiming otherwise is wrong).

Migration:
- Extend the two-arg function's hierarchical condition to the registered pairs: `(brand→product) OR (place→food)`.
- Make the INSERT trigger parent-aware (look up `NEW.parent_id`'s slug/type; hierarchical base slug for registered pairs). History-collision logic unchanged.
- No data backfill (45 existing parented rows are all brand→product and already correctly slugged).

### 2.2 — ReviewForm: delete Step 2, derive category
Files: `ReviewForm.tsx`, `steps/StepTwo.tsx`, `CategorySelector.tsx`, `StepIndicator`/`StepNavigation` (3 steps), call sites (`EntityV4`, `EntityDetailV2`, `EntityDetail`, `ProfileReviews`, `SmartComposerButton` — prop signatures unchanged).
- Delete `StepTwo` + `CategorySelector` (verify zero other importers before deleting).
- Delete `getReviewCategory` squashing map. New rule: `category = parseEntityType(selectedEntity.type)`; submit blocked without a subject entity (new reviews). Edit mode: keep stored `review.category` until an entity is attached/changed.
- Steps become: 1 Rating → 2 Subject (+media, unchanged blocks) → 3 Details (`StepFour` unchanged). `totalSteps` 4→3.
- Title field semantics unchanged (defaults to subject name); venue auto-fills from the dish's parent place name for food subjects.

### 2.3 — Cross-type subject search component
New slim single-select `SubjectEntitySearch` (in `components/profile/reviews/`) reusing `useEnhancedRealtimeSearch` + ranking utils + `RecentSearchesPanel`, styled like the composer's "Tag what this is about" selector. Multi-select/mentions stay composer-only. `EntitySearch` (old, type-scoped) stays for its other consumers — only StepThree stops using it.

### 2.4 — Dish creation under a place
- `CreateEntityDialog`: when type is `food`, require picking a parent `place` — generalize the existing Phase 3.1 parent-brand pre-selection into a registry-driven provider picker (`getProviderTypesFor('food')` → `['place']`). Guard with `assertValidOfferingPair`.
- Creation passes slug explicitly via `buildHierarchicalSlug(parent, child)` (Phase 0 helper) so the client and the fixed DB trigger produce identical slugs.
- After creation, the review links to the dish (`entity_id`), `venue` = place name, `category='food'`.

### Verified consumers needing no change
- `ReviewCard.getBadgeColor` + `getEntityTypeLabel` already cover all 15 types.
- `ProfileReviews` filters are derived dynamically from present categories.
- Entity pages fetch reviews by `entity_id` regardless of category; `food_tags` (StepFour) still keyed on `category==='food'`, which dishes keep.

## Explicitly out of scope
- No per-type questionnaires (Phase 3). No `RecommendationCategory` legacy enum retirement (Phase 4). No changes to recommendation flows. No migration of existing reviews' categories. V2 page keeps working via the shared form.

## Tests
- Registry/slug: SQL-level check via migration tests not available — cover `buildHierarchicalSlug` place→food cases in vitest; manual verify trigger on insert of a dish.
- ReviewForm: category derivation (entity type → category; edit-mode preservation; no-entity legacy), 3-step navigation, subject-required validation, dish creation payload (parent_id + hierarchical slug + assertValidOfferingPair).
- `?tab=products` legacy URL opens children tab; `?tab=children` deep-links.
- `bunx vitest run` green + typecheck.

## Manual acceptance (you test)
1. New review from profile: 3 steps, no category step; searching "Classic Burger" → create dish under Truffles → dish page shows "Dish at Truffles" and appears in Truffles' "Dishes" tab; review badge shows "Food".
2. Review a place directly → badge "Place"; review a course → badge "Course" (previously squashed to Product).
3. `/entity/cosmix?tab=products` and `?tab=children` both open the children tab.
4. Edit an old entity-less review → keeps its category, can attach an entity.
