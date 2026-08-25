# Phase 2.0 — Entity selection replaces category selection (4 steps kept)

I agree with your migration strategy, and with ChatGPT/Codex: the destination in the old Phase 2 plan is right, the batch size was wrong. This plan is **Phase 2.0 only** — additive, reversible, nothing working is deleted.

## What changes for the user

The wizard stays at 4 steps. Only Step 2's content changes.

```text
Step 1  Rate your experience                (unchanged)
Step 2  "What are you reviewing?"           was: 5 category tiles
                                            now: search across all 15 entity types, pick one
Step 3  Tell us about your {…} + media      unchanged
Step 4  Add final details                   unchanged
```

Selecting an entity in Step 2 sets the form's subject (`entityId`, `selectedEntity`) and **derives the category internally** from the entity's canonical type. Reviewing a course still saves `category='product'` in this phase (the existing `getReviewCategory` map is kept as-is) — removing that lossy squash is Phase 2.1, so persistence behaviour does not change today.

Opened from an entity page (`?entity` prop), the entity is pre-selected and locked, exactly like today's locked category.

## Verified current state (checked before writing this)

- `ReviewForm.tsx` holds `category` state, `getReviewCategory` (squashes course/app/game → product, experience → place), `entityId`, `selectedEntity`, `isFromEntityPage`, `totalSteps={4}` in both `StepIndicator` and `StepNavigation`.
- Step 2 renders `StepTwo` → `CategorySelector` (5 tiles, lockable).
- Step 3 (`StepThree`) already owns entity selection via a **category-scoped** `EntitySearch` plus `handleEntitySelect`, media, and `venue`/name fields.
- `UnifiedEntitySelector` (the `/create` engine) is multi-select (`maxEntities=3`), includes a `people` category that fires `onMentionInsert`, and mounts `CreateEntityDialog`. `maxEntities` and `onMentionInsert` are already props.
- `reviews.category` is a plain `text` column; DB slug functions are still `brand→product`-only (untouched here).

## Implementation

### 1. Single-subject mode in the shared selector (no fork)
Add to `UnifiedEntitySelector`:
- `mode?: 'tag' | 'subject'` (default `'tag'` — existing behaviour byte-identical).
- In `'subject'` mode: `maxEntities` forced to 1, the `people` category is excluded from results/keyboard nav, and picking a result calls `onEntitiesChange([entity])` immediately (selection replaces rather than appends). No mention affordance is rendered when `onMentionInsert` is absent.
- Everything shared stays shared: `useEnhancedRealtimeSearch`, `searchRanking` utils, `RecentSearchesPanel`, entity cards, `CreateEntityDialog`. No copied search logic.

### 2. New `StepTwo` content: `SubjectSelectStep`
New file `src/components/profile/reviews/steps/SubjectSelectStep.tsx` — a thin wrapper: heading "What are you reviewing?", helper copy, `UnifiedEntitySelector mode="subject" variant="modal"`, plus a selected-subject preview row (image, name, type chip, "Change" button).
`StepTwo.tsx` and `CategorySelector.tsx` are **left on disk, imports removed** — deleted only in Phase 2.G after acceptance.

### 3. `ReviewForm` wiring (minimal)
- Step 2 renders `SubjectSelectStep`; `handleEntitySelect` (already exists for Step 3) is reused as the single selection handler, so category derivation, `entityId`, `contentName`/`venue` prefill all follow the paths that work today.
- Locked case: when `isFromEntityPage`, show the preview with no "Change" button (mirrors `disableCategoryChange`).
- `isNextDisabled` for step 2: unchanged in spirit — Next stays enabled without a subject in this phase (requiring one is Phase 2.2), so no user can get stuck.
- Step title map: case 2 becomes "What are you reviewing?".
- `totalSteps` stays 4. `getReviewCategory` stays. Step 3 and 4 untouched, including Step 3's own `EntitySearch` (harmless redundancy for one phase; removed in 2.G).

### Explicitly NOT in this phase
No wizard collapse, no required subject, no dish creation, no DB/slug migration, no Step 3 field removal, no edit-mode changes, no component deletions, no `?tab=children` work.

## Tests
- `getReviewCategory` derivation unchanged for all 15 types (regression lock before 2.1 changes it).
- Selector in `subject` mode: single selection replaces previous, `people` absent, `tag` mode unchanged (existing composer tests stay green).
- `bunx vitest run` + typecheck green.

## Manual acceptance (you)
1. New review from profile → Step 2 searches a product, a book, a place, a course; each selects and advances.
2. Review from an entity page → subject pre-selected and locked; submit works as before.
3. Edit an existing review → opens and saves unchanged.
4. `/create` composer tagging unchanged (still up to 3 entities, @mentions work).

## Roadmap after this

- **2.1** Selected entity becomes canonical: `category = parseEntityType(entity.type)` for new entity-linked reviews; retire `getReviewCategory`; legacy rows keep stored categories.
- **2.2** Subject required for new reviews (legacy entity-less reviews stay readable/editable); free-text-only path removed only once creation covers every type.
- **2.3** Parent-aware slug DB migration, isolated, with its own review — including the decision whether hierarchical slugs apply to any valid `parent_id` or only registered offering pairs.
- **2.4** Lightweight dish-under-place creation (place picker → food entity → hierarchical slug → auto-select).
- **2.5** Collapse the wizard, remove now-redundant Step 3 fields, delete `StepTwo`, `CategorySelector`, `getReviewCategory`, unused type-scoped search.
- **Separate patch** V4 `?tab=children` deep-link (Phase 1 polish, not part of Phase 2).
