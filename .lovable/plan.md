# Review System Rebuild — Entity as the Source of Truth

## My verdict on the ChatGPT proposal

I agree with the architecture and the sequencing. Three separate concepts — **entity type** (15 canonical), **taxonomy category** (155 rows in `categories`), **review questionnaire** — is the right model, and the review must not own a taxonomy of its own. Removing the category step, entity-first global create, declarative + versioned questionnaires, JSONB answers instead of per-attribute columns, no silent "unknown → product" fallback: all correct.

Three places where the audit changes the plan, and one place where I disagree.

### What the audit actually shows (verified now, not assumed)

- **Entities: 344 rows, zero legacy types.** Only `place` (104), `product` (88), `brand` (54), `book` (49), `movie` (48), `food` (1). No `tv`, `activity`, `music`, `art`, `drink`, `travel` rows exist. So the legacy problem is **code-only** — no data migration, no row inspection, no "what did Music mean" debate. That deletes most of the proposed Phase 0/1 work.
- **Reviews: 72 total, 27 with no `entity_id`** (37%). Orphan reviews are a real, current path, not an edge case.
- **17 reviews disagree with their entity's type**, and the shape is revealing: **12 `food` reviews are attached to `place` entities**, and **5 `product` reviews are attached to `brand` entities**. This is exactly the "what is the review subject?" ambiguity, and it is the single most important thing to settle.
- **Taxonomy is 155 categories**, and only 6 of 15 canonical types have any entities at all.

### Where I disagree

**Do not delete `reviews.category` from the write path in an early phase.** The 12 food-on-place rows mean `category` currently carries information that `entity.type` does not — it records that the review was about a dish, not the restaurant. If we start writing `category = entity.type`, we silently destroy that distinction. Decide the food/place semantics *first*, then converge the column.

Also: with only 6 populated entity types and 344 entities, building an inheritance engine across 155 categories now is premature. Ship questionnaires keyed on entity type; add category overrides only when a leaf category has enough entities to justify one.

## The decision that has to be made first

Every review needs exactly one entity as its subject. For the 12 food-on-place reviews, pick one:

- **Model A (restaurant review):** subject = the place, dish names become experience context (`items_tried`). Fewer entities, simpler, matches how the data already sits.
- **Model B (dish review):** subject = a `food` entity, venue is context. Richer, but needs 12 new food entities and dish-level entity creation.

I recommend **Model A now, Model B later as a distinct flow** — the entity graph isn't ready for dish-level entities, and Model A converts existing rows losslessly. Same logic for the 5 product-on-brand rows: subject = the brand, product name becomes context, until real product entities exist.

## Phases

**Phase 0 — Lock invariants + code-only legacy cleanup** (no UI change)
- Write down the two invariants: one canonical entity as review subject; canonical entity type is the source of truth.
- Single canonical module: `CANONICAL_ENTITY_TYPES` and `LEGACY_ENTITY_TYPE_ALIASES` kept strictly separate. `normalizeEntityType()` returns `unsupported` — never `product`.
- Remove the six deprecated `EntityType` enum members and the lossy fallbacks in `getReviewCategory()`. Safe: zero rows use them.
- Backfill decision for the 17 mismatched reviews per Model A, moving dish/product names into `metadata`.

**Phase 1 — Named-step wizard** (behaviour unchanged)
- Replace `currentStep === n` and `StepOne..Four` with a step registry keyed by id (`subject`, `rating`, `experience`, `review`). Steps computed, not fixed at four.

**Phase 2 — Kill the category step**
- Entity known → steps are `rating`, `experience`, `review`. The category screen disappears.
- Global create → `subject` first: one cross-type entity search, with "Can't find it? Add it" routing into the existing entity-creation dialog (the only place the 15 types are ever shown).
- `reviews.category` keeps being written as the normalized entity type for compatibility, now that Phase 0 has resolved the food case.

**Phase 3 — Questionnaire registry** (architecture only, no new user-visible fields)
- Declarative config per canonical type — field key, input type, label, required. No JSX in config. Every one of the 15 types gets an intentional entry (most share a generic profile). No fallthrough.
- Answers stored as versioned JSONB (`schema_version` + `answers`). No per-attribute columns.

**Phase 4 — Review content redesign**
- Drop the review headline and the emotional rating copy; neutral semantic labels instead.
- Add recommendation (`Yes / Maybe / No`) and repeat intent as first-class signals, worded per type.
- Move visibility out of "Additional details" into a compact control by the submit button; collapse experience date into a light dropdown.
- Rewrite the free-text prompt per type.

**Phase 5 — Structured signals**
- "What stood out" liked / could-be-better chips, "Best for", optional attribute sub-ratings — progressively disclosed, not all at once.

**Phase 6 — Category overrides, then aggregation**
- Leaf overrides only for categories with real usage. Then entity-page rollups: "% recommend", "people love", "best for", circle attribution.

**Phase 7 — Tighten the entity requirement**
- New reviews always resolve to an entity; existing 27 orphans stay readable. Only then consider a not-null constraint.

## Technical notes

- Legacy cleanup is a pure TypeScript refactor — no SQL migration needed for entity types.
- The only data migration in this whole plan is the 17-row subject backfill in Phase 0, plus adding a JSONB answers column in Phase 3.
- `entityTypeHelpers.ts`, `entityTypeConfig.ts`, the recommendation enum, and the review mapping must all end up reading from the one canonical module.
- Reviews and recommendations stay separate systems; the recommendation *signal* lives inside a review.

## Suggested first step

Phase 0 only. It is small, entirely non-visual, and unblocks everything else — but it needs your call on Model A vs Model B for the food reviews before I touch the 17 rows.
