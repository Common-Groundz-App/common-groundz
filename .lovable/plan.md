# Review form: current state, and how to make it scale across all categories

## Part 1 — What exists today

### The flow is a fixed 4-step wizard

`ReviewForm.tsx` (764 lines) renders a dialog with `StepIndicator` + `StepNavigation` and four hard-coded steps:

| Step | Component | Collects | Validation |
| --- | --- | --- | --- |
| 1 | `StepOne` | Star rating | Required — blocks Next, shakes, toasts "Rating required" |
| 2 | `StepTwo` → `CategorySelector` | One of 5 categories | None (a default is always pre-set) |
| 3 | `StepThree` (389 lines) | Entity search, name, creator/venue field, location prompt, media upload | Name required (`foodName` for food, else `contentName`) |
| 4 | `StepFour` | Review headline, description, experience date, food tags (food only), visibility | None — all optional |

Submit happens on Next from step 4. Steps can only be revisited if already completed.

### There are exactly 5 review categories — but 15 entity types

`CategorySelector.tsx:14-20` hard-codes: `food`, `movie`, `book`, `place`, `product`.

The app's real taxonomy is much larger:

- `getActiveEntityTypes()` returns **15 canonical entity types**: movie, book, tv_show, course, app, game, experience, food, product, place, brand, event, service, professional, others.
- The `categories` table holds **145 hierarchical rows across all 15 entity types** (product 36, service 13, brand 13, professional 12, app 12, movie 11, experience 10, book 9, tv_show 8, course 7, game 7, event 6, place 6, food 4, others 1), most with parent/child nesting.
- `reviews.category` is plain `text NOT NULL` — no enum, no check constraint. Nothing in the database enforces the 5 values.

So the review form exposes 5 buckets on top of a 15-type, 145-category system.

### Consequence: entity types get squashed, and one falls through a hole

`ReviewForm.tsx:73-91` maps entity type → review category:

- food, movie, book, place, product → themselves
- course, app, game → `product`
- experience → `place`
- brand, event, service, professional, others → `product` (default branch)
- **tv_show → `'tv_show'`**, because that branch returns `canonicalType.toLowerCase()` and the enum value is already `tv_show`. That string matches none of the 5 selector buttons, so reviewing a TV show opens step 2 with nothing selected, and step 3/4 fall into the generic "product" copy paths.

Current live data reflects the squashing: reviews exist only as place (20), food (20), product (16), movie (9), book (7) — while entities already include 49 brands with no honest review category.

### Step 3 and 4 branch on category via inline ternaries

Everything category-aware is string comparison scattered inside the step components:

- `StepThree.tsx` — 4 separate `switch(category)` blocks for icons/labels/placeholders, plus inline ternaries at lines 308, 315, 331, 339-342 ("Who wrote this book?", "Restaurant name", "Who makes this product?"), plus `isLocationRelevantCategory = category === 'place' || category === 'food'` gating the geolocation prompt.
- `StepFour.tsx:86` — food tags render only when `category === 'food'`.
- `ReviewForm.tsx` — food vs non-food drives which of two parallel name states (`foodName` / `contentName`) is authoritative, and food-only metadata (`{ food_tags }`).

Adding a 6th category today means touching `CategorySelector`, 4 switch blocks, 4 ternaries, the mapping function, the validation branch, and the metadata builder. That's the scalability problem, not the category count itself.

### Step 2 is already dead weight on the main path

`ReviewForm` is opened from `EntityDetail.tsx`, `EntityDetailV2.tsx`, `ReviewCard.tsx` (edit) and profile reviews. In the entity flows an `entity` prop is always passed, which:

- sets the category automatically,
- marks step 2 complete (`ReviewForm.tsx` entity effect),
- passes `disableCategoryChange`, so `CategorySelector` renders every other tile at 50% opacity with a locked tooltip and the copy reads "Category is set to … and cannot be changed."

So for the dominant entry point, step 2 is a full screen the user must click through that does nothing.

## Part 2 — Recommendation

**Remove the category step from the user's path; keep category as a derived value.** Then replace the hard-coded per-category branching with one config-driven schema so any of the 15 types (and their nested categories) get correct copy and correct extra fields without new code paths.

Why this and not "add more category tiles":

1. Category is already knowable. Every review worth having is attached to an entity, and the entity carries `type` plus a `category_id` in the 145-row hierarchy. Asking the user to re-declare it is redundant data entry that can only introduce conflict with the entity.
2. Five tiles can't grow to 15 gracefully. A 15-tile emoji grid is a worse decision surface, and hierarchical categories can't be represented as tiles at all.
3. The cost of every new category is currently linear in scattered edits. A schema map makes it one entry.
4. Fewer steps = higher completion. Rating and a first-person opinion are the value; taxonomy is bookkeeping.

### Proposed shape

**Steps become 3, entity-first:**

```text
Step 1  Rating              (unchanged, required)
Step 2  What + evidence     (was step 3: entity, name, contextual field, media)
Step 3  Your take + details (was step 4: headline, thoughts, date, type-specific fields, visibility)
```

Category is derived from the entity and shown as a small read-only chip in step 2 — visible, not editable, with a tiny "not right?" affordance only in the no-entity fallback case.

**A single category schema replaces all branching.** One module keyed by canonical entity type, each entry declaring: label, icon, the contextual secondary-field label ("Who wrote this book?", "Restaurant name"), whether location is relevant, the review-category value to persist, and a list of optional structured fields for step 3. `StepTwo`/`StepThree` then read from the schema instead of switching on strings. The codebase already has precedent for this pattern in `src/config/entityTypeConfig.ts`, `src/config/metadataSchema.ts` and `src/types/structuredFields.ts`, and posts already store structured experience data in JSONB — reviews can use the existing `reviews.metadata` JSONB the same way `food_tags` does today.

**Fix the mapping while doing it:** give tv_show, brand, event, service, professional, course, app, game, experience honest persisted categories instead of collapsing them to `product`, and drop the `toLowerCase()` fallthrough that produces the orphan `tv_show` value.

### Technical notes

- New `src/config/reviewCategorySchema.ts`: `Record<EntityType, ReviewCategoryConfig>` with `{ reviewCategory, label, icon, nameLabel, contextualFieldLabel, locationRelevant, extraFields[] }`.
- `ReviewForm.tsx`: collapse `foodName`/`contentName` into a single `name` state; derive category from `selectedEntity?.type` via the schema; delete `getReviewCategory`'s ad-hoc switch; renumber steps 1-3 and update `completedSteps`/`handleNext` validation accordingly.
- `StepThree.tsx`: delete the 4 `switch(category)` blocks and the 5-way ternaries; read labels/icons/location relevance from the schema.
- `StepFour.tsx`: render `extraFields` generically from the schema (food tags become one schema entry rather than a special case).
- `StepTwo.tsx` + `CategorySelector.tsx` are removed from the wizard. `CategorySelector` is also referenced elsewhere, so it should be deleted only after confirming remaining usages.
- Persistence: no migration required — `reviews.category` is free `text`. Widening the written values is backward compatible, but `ReviewFilters.tsx` derives its filter chips from the categories present in the data, so it should be checked against the new value set.
- Existing rows keep their current values; no backfill needed unless you want the squashed course/app/game rows re-derived from their entity type.

### Open question before implementing

Reviews can currently be created with no entity at all (7 of 16 product reviews have no `entity_id`). Two options:
- **Entity-required** — cleanest derivation, best data, but blocks free-form reviews.
- **Entity-optional with fallback** — keep a lightweight type picker that only appears when no entity is chosen.

I lean entity-optional with fallback, so no existing flow breaks.
