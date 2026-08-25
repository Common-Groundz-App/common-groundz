# Phase 2.0 — Entity selection replaces category selection (4 steps kept)

Revised after the ChatGPT/Codex review. All four corrections are accepted; three of them I confirmed directly in the code before adopting them. Scope is still additive and reversible — nothing working is deleted.

## What changes for the user

```text
Step 1  Rate your experience                (unchanged)
Step 2  "What are you reviewing?"           was: 5 category tiles
                                            now: search across all 15 entity types, pick one
Step 3  Tell us about your {…} + media      unchanged, except: subject chosen in Step 2 is authoritative
Step 4  Add final details                   unchanged
```

Persistence does not change in this phase: the existing `getReviewCategory` squash (course/app/game → product, experience → place) is kept deliberately, so this phase answers only "did replacing Step 2 break anything?". Honest per-type persistence is Phase 2.1.

## Verified current state

- `ReviewForm.tsx`: `category` state (defaults `'food'`), `getReviewCategory`, `entityId`, `selectedEntity`, `isFromEntityPage`, `totalSteps={4}` in `StepIndicator` + `StepNavigation`.
- **Confirmed the Codex bug**: `handleEntitySelect` (line ~398) sets `selectedEntity`/`entityId` and then branches on the **current** `category` (`if (category === 'food') … else if (category === 'place') …`) and **never sets `category` at all**. With the `'food'` default, picking a course today writes the course name into `venue` and leaves `category='food'`. This must be fixed for Step 2 to be usable.
- **Confirmed**: `UnifiedEntitySelector` uses `useRecentSearches('composer')` (line 171) — a hardcoded namespace.
- **Confirmed**: `UnifiedEntitySelector` mounts `CreateEntityDialog` unconditionally (line ~981) and calls `createEntityQuick`, i.e. subject mode would expose parentless `food` creation.
- `StepThree` already owns a category-scoped `EntitySearch` + `disableEntityChange` / `disableEntityFields` props (already used for the entity-page case) — so the "Step 3 must not replace the subject" rule needs no new prop.
- `reviews.category` is plain `text`; DB slug functions remain `brand→product`-only (untouched here).

## Implementation

### 1. Single-subject mode in the shared selector (no fork)
Add to `UnifiedEntitySelector`:
- `mode?: 'tag' | 'subject'` — default `'tag'`, existing composer behaviour byte-identical.
- `'subject'`: `maxEntities` forced to 1, the `people` category excluded from results and keyboard nav, a pick **replaces** the selection and fires `onEntitiesChange([entity])`.
- `recentsSurface?: string` (default `'composer'`) → review passes `'review-subject'`, so review searches never pollute composer recents. **(Codex #3)**
- `allowInlineCreate?: boolean` (default `true`). Review subject mode passes `false`: `CreateEntityDialog` is not mounted, and the "can't find it" row instead shows non-dead-end copy — "Can't find it? Add it from the create flow for now" — because subject is optional in this phase, so no user is blocked. Safe dish/entity creation returns in 2.4. **(Codex #2)**
- Shared infrastructure stays shared: `useEnhancedRealtimeSearch`, `searchRanking`, `RecentSearchesPanel`, entity cards. No copied search logic.
- **Cross-type audit (ChatGPT #2):** verify the search path returns results for the uncommon types too — `tv_show`, `app`, `game`, `service`, `professional`, `brand`, `event`, `experience`, `others` — and that no leftover category filter narrows them. If the ranking/category map omits a canonical type, add it here; if a type genuinely has no rows yet, note that in the verification report rather than "fixing" it.

### 2. New Step 2 content: `SubjectSelectStep`
New `src/components/profile/reviews/steps/SubjectSelectStep.tsx`: heading "What are you reviewing?", helper copy, `UnifiedEntitySelector mode="subject" variant="modal" allowInlineCreate={false} recentsSurface="review-subject"`, plus a selected-subject preview row (image, name, canonical type chip, "Change").
`StepTwo.tsx` and `CategorySelector.tsx` stay on disk with imports removed — deleted in 2.5 after acceptance. The locked entity-page variant stays deliberately plain (it gets collapsed in 2.5).

### 3. New `handleSubjectSelect` in `ReviewForm` (Codex #1)
A dedicated handler replaces the use of the buggy `handleEntitySelect` for Step 2, ordered so nothing branches on stale state:
1. `const canonical = parseEntityType(entity.type)` (boundary parser for external results).
2. `setCategory(getReviewCategory(...))` — derive the compatibility category from the **new** entity, not current state.
3. Prefill from `canonical`, not from the old `category`: `food` → `venue` = parent/place name, `foodName` left empty; `place` → `contentName` = name, `venue` = `formatted_address` when `api_source === 'google_places'`; everything else → `contentName` = name, `venue` = `entity.venue`.
4. `setSelectedEntity` / `setEntityId`, mark step 2 complete.
Changing the subject clears the previous subject's derived fields (same clearing `handleCategoryChange` does today) so no stale name/venue survives a type switch.
The old `handleEntitySelect` stays only for Step 3's fallback path and is deleted in 2.5.

### 4. One authoritative subject (ChatGPT #1)
`ReviewForm` passes `disableEntityChange={isFromEntityPage || !!selectedEntity}` and `disableEntityFields={isFromEntityPage || !!selectedEntity}` to `StepThree`. Result:
- Step 2 subject chosen → Step 3 shows it read-only as context; media and remaining fields keep working.
- Step 2 skipped (still allowed this phase) → Step 3's old category-scoped `EntitySearch` remains the fallback, using `category` default as today.
This uses props Step 3 already supports, so it is a one-line change, not new plumbing.

### 5. Cosmetic
Step-2 dialog title becomes "What are you reviewing?". `totalSteps` stays 4. Step 4 untouched.

### Explicitly NOT in this phase
No wizard collapse, no required subject, no dish creation, no DB/slug migration, no Step 3 field removal, no edit-mode/legacy persistence changes, no component deletions, no `?tab=children` work.

## My additions beyond the two reviews

- **Edit mode is explicitly out of the change surface.** In edit mode `completedSteps` is `[1,2,3,4]` and `category` comes from the stored review; Step 2 renders the existing subject as a preview and re-selecting is allowed but does not touch a legacy review's stored category unless the user actually picks a new entity. Locked down by a test.
- **Keep a regression lock on `getReviewCategory`** for all 15 types before 2.1 rewrites it — this is what proves 2.1 changed persistence deliberately rather than by accident.
- **No new search hook.** If the audit shows a type is unreachable, the fix goes in the shared ranking/search layer so `/create` benefits too — never a review-only branch.

## Tests
- `handleSubjectSelect` prefill + derived category across `food`, `place`, `product`, `course`, `tv_show`, `brand`, `professional`; switching subject type clears prior fields; no branch reads stale `category`.
- `getReviewCategory` mapping for all 15 canonical types (regression lock).
- Selector `subject` mode: single-replace selection, `people` absent, `allowInlineCreate={false}` mounts no create dialog, `recentsSurface` isolation (review writes do not appear in the `composer` bucket); `tag` mode unchanged.
- `bunx vitest run` + typecheck green.

## Manual acceptance (you)
1. New review → Step 2 search and select a product, a book, a place, a course, a tv_show; each advances and Step 3 shows that exact subject read-only.
2. Skip Step 2 → Step 3's old search still works end-to-end and submits.
3. Review from an entity page → subject pre-selected/locked, submit unchanged.
4. Edit an existing review → opens and saves unchanged.
5. `/create` composer unchanged: up to 3 tags, @mentions, inline creation, its own recents.

## Roadmap after this
- **2.1** `category = parseEntityType(entity.type)` for new entity-linked reviews; retire `getReviewCategory`; legacy rows keep stored categories.
- **2.2** Subject required for new reviews; legacy entity-less reviews stay readable/editable.
- **2.3** Parent-aware slug DB migration, isolated, including the decision whether hierarchical slugs apply to any valid `parent_id` or only registered offering pairs.
- **2.4** Lightweight dish-under-place creation; inline creation re-enabled in subject mode once it is parent-safe.
- **2.5** Collapse the wizard, remove redundant Step 3 fields, delete `StepTwo`, `CategorySelector`, `getReviewCategory`, `handleEntitySelect`, unused type-scoped search.
- **Separate patch** V4 `?tab=children` deep-link (Phase 1 polish).
