# Review form: scalable redesign — my view on the Codex analysis, and where to start

## Part 1 — Where I agree, disagree, and what Codex got wrong

Codex's diagnosis is largely correct. The four real problems it names are real and I verified each: a second incomplete taxonomy (5 review categories vs 15 entity types), category branching spread through switches and ternaries, a wizard hard-coded to 4 positional steps, and a locked category screen that adds friction without improving data.

Three corrections, all verified against the live database:

**1. The legacy enum cleanup is code-only. There is nothing to migrate.**
Codex says the six deprecated types "require migration or normalization." I queried `entities` grouped by type: the only values present are place (104), product (88), brand (54), book (49), movie (48), food (1). **Zero rows** use `tv`, `activity`, `music`, `art`, `drink`, or `travel`. `reviews.category` holds only the five expected strings, and `recommendations.category` only four of its five enum values. So this is a pure code deletion — no backfill, no data risk. Codex overstated it.

**2. The hierarchical category count is knowable, and it's 145.**
Codex said the `categories` table count "cannot be reliably determined solely from the checked-in TypeScript." It can be read directly: 145 rows across all 15 entity types (product 36, service 13, brand 13, professional 12, app 12, movie 11, experience 10, book 9, tv_show 8, course 7, game 7, event 6, place 6, food 4, others 1), most with parent/child nesting. This matters because it confirms Codex's strongest recommendation: never build a wizard per leaf category.

**3. The feature is barely used, which changes the whole risk calculus.**
72 reviews total, 45 with an entity, 27 without — and **only 1 created in the last 90 days**. Codex proposed a careful 7-step incremental sequence appropriate for a high-traffic feature. At this volume there is almost nothing to protect. That argues for doing the structural fix in one decisive pass rather than a long migration, and against building 15 questionnaires up front — you have no completion analytics to justify any of those fields yet.

Where I'd push back on emphasis: Codex lists 10 suggested tasks, which reads as 10 work items. Really there is **one** root cause — the form asks for the subject's *type* before it asks for the *subject* — and eight of the ten items dissolve once you invert that order. Don't start ten tasks.

## Part 2 — Direct answers to your questions

**Where do we start? Not with categories.**
Categories are the symptom. If you "fix categories" first you'll end up designing a 15-tile picker, then delete it two weeks later when the entity becomes the source of truth. Start with subject selection; the category question answers itself.

**What should we do with categories? How many should we have?**
Zero user-facing review categories. Keep a *persisted, derived* `reviews.category` that mirrors the entity's canonical type — 15 possible values instead of 5 — because filtering, discovery, and analytics genuinely need it (Codex is right that removing type from the data model would be a mistake). The user never picks it; the entity supplies it.

**Should we remove step 2? Yes.**
It is a screen whose only control is disabled on the dominant entry path. Nothing is lost by deleting it, because the entity already carries `type` and `category_id`.

**What happens to step 3?**
It becomes the new step 2 and is *narrowed*, not just renumbered. Today it does five unrelated jobs: entity search, subject name, a category-specific secondary field, location permission, and media upload. The secondary field ("Who wrote this book?", "Who makes this product?", "Restaurant name") is asking reviewers to re-type facts the entity record already holds — that's Codex's point 7 and it's the best one in the list. Those fields go away entirely. The entity's facts render as a read-only preview card. What remains is: pick the entity, add your media.

**Should we reuse the composer's "Tag what this is about"? Yes — this is the highest-leverage decision in the plan.**
`src/components/feed/UnifiedEntitySelector.tsx` already does exactly what the review form needs and does it better: cross-type search with no type pre-filter, ranked and deduped results, recent searches, location awareness, and a built-in "create new" path via `CreateEntityDialog` for the not-found case. It takes a `maxEntities` prop, so reviews pass `maxEntities={1}`. Reusing it deletes ~389 lines of bespoke `StepThree` search code, gives reviews the entity-first flow for free, and means future search improvements land in both surfaces at once.

## Part 3 — The plan

### Phase 1 — Entity-first subject selection (do this first, alone)

Invert the order and delete the category step.

```text
Before:  1 Rating → 2 Category (5 tiles) → 3 Subject+search+media → 4 Details
After:   1 What are you reviewing?  (UnifiedEntitySelector, maxEntities=1, + media)
         2 Your rating + your take
         3 Publish (date, visibility)
```

- `StepTwo.tsx` and its use of `CategorySelector` are removed from the wizard.
- `StepThree` is rewritten to wrap `UnifiedEntitySelector` plus the existing `MediaUploader`; the contextual secondary field and the four `switch(category)` blocks are deleted. The entity's facts show via the existing `EntityPreviewCard`.
- Category becomes derived: one helper maps canonical entity type → persisted category value, replacing `getReviewCategory`'s ad-hoc switch. This also fixes the live bug where reviewing a TV show persists `tv_show`, matches none of the five tiles, and falls through to product copy.
- Entity stays **optional**: 27 of 72 existing reviews have no entity. When none is selected, the user types a free-text subject and picks a broad type once, inside the "add something new" fallback — not as an upfront gate.

Rating moves off its own screen and joins the written take, because a rating with no words is the low-value review and pairing them raises the odds of getting both.

### Phase 2 — Config-driven steps and fields

Replace positional numbers with a declared step list, so step count is derived rather than hard-coded in `totalSteps={4}`, `isLastStep`, the submit condition, and the validation branches.

A registry keyed by canonical entity type, with all 15 types present from day one — but **most pointing at one shared generic questionnaire**. Only add type-specific questions where you can name the decision they inform. I'd seed exactly three beyond generic, matching the categories that actually have reviews today: food (dish + dietary tags, replacing the current `food_tags` special case), place (visit purpose), product (variant + how long used). The other twelve inherit generic until usage justifies more. Optional taxonomy-level overrides that add a field or two on top of the type's base questionnaire come later, if ever.

Codex's `ReviewStepDefinition` / `ReviewFieldDefinition` shape is a good target. The codebase already has this pattern in `src/config/entityTypeConfig.ts`, `src/config/metadataSchema.ts`, and `src/types/structuredFields.ts`, and posts already persist structured experience data in JSONB — so reviews can use the existing `reviews.metadata` JSONB the same way `food_tags` does today, under a versioned `answers` key. **No schema migration is needed**: `reviews.category` is plain `text NOT NULL` with no enum or check constraint, so widening the written values is backward compatible.

Also in this phase: recompute completion and validation from the derived step list when the subject changes, which is Codex's point 10.

### Phase 3 — Legacy enum removal (code-only)

With zero rows using them, delete `TV`, `Activity`, `Music`, `Art`, `Drink`, `Travel` from the `EntityType` enum and drop the legacy branches in `getCanonicalType`'s `legacyToCanonical` map, `isValidEntityType`'s array, and the label/icon/fallback-image records in `entityTypeHelpers.ts`. Thirteen files reference these values (including `entityService.ts`, `hooks/feed/api/types.ts`, `AdminEntityEdit.tsx`, `ReviewCard.tsx`, `RecommendationCard.tsx`), so this is a mechanical sweep that must be done in one pass to keep TypeScript green. The Supabase `entity_type` enum already contains only the 15 canonical values — nothing to change there.

### Deferred — recommendations

`recommendation_category` is a real Postgres enum with the same five values, and only 9 recommendation rows exist. Same treatment, after reviews are settled and the registry has proven itself. Converting that enum to text (or extending it to 15) is a migration, unlike reviews.

### Suggested order

1. Phase 1 — entity-first, `UnifiedEntitySelector`, delete step 2, derive category.
2. Phase 3 — legacy enum sweep (independent, quick, unblocks clean typing for the registry).
3. Phase 2 — step registry + versioned structured answers.
4. Recommendations.

Phase 1 alone fixes the 5-vs-15 mismatch, the tv_show bug, the redundant locked screen, and the duplicated entity facts. That's most of the value.

### One decision I need from you

Rating currently sits alone on step 1 and is the only hard-required field. In the proposed flow it moves onto the same screen as the written take. Confirm you want that consolidation — if you'd rather keep rating as its own opening screen, the flow stays 4 steps and only the category step is removed.
