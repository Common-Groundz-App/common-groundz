# Phase 2.0 — Entity selection replaces category selection (4 steps kept)

Revised after three rounds of ChatGPT/Codex review. Every correction is accepted, and each claim was confirmed in code before adopting it. Scope stays additive and reversible — nothing working is deleted.

## What changes for the user

```text
Step 1  Rate your experience                (unchanged)
Step 2  "What are you reviewing?"           was: 5 category tiles
                                            now: search across all 15 entity types, pick one
Step 3  Tell us about your {…} + media      unchanged, except: subject chosen in Step 2 is authoritative
Step 4  Add final details                   unchanged
```

Persistence does not change: the existing `getReviewCategory` squash (course/app/game → product, experience → place) is kept deliberately, so this phase answers only "did replacing Step 2 break anything?". Honest per-type persistence is Phase 2.1.

## Verified current state

- `ReviewForm.tsx`: `category` state (defaults `'food'`), `getReviewCategory`, `entityId`, `selectedEntity`, `isFromEntityPage`, `totalSteps={4}`.
- **Stale-category bug (confirmed)**: `handleEntitySelect` (~line 398) sets `selectedEntity`/`entityId` then branches on the **current** `category` and **never sets `category`**. With the `'food'` default, picking a course writes the course name into `venue` and leaves `category='food'`.
- **Food dead-end (confirmed)**: `isNextDisabled` for step 3 returns `!foodName` when `category === 'food'`, and Step 3's title input is `readOnly` when `disableEntityFields && selectedEntity`. Empty `foodName` + locked field = unsubmittable.
- **`disableEntityFields` scope (confirmed — no conflict)**: in `StepThree` it applies **only** to the title/name input (`readOnly` + muted styling). The `venue` input has no such guard and stays editable. So locking identity while leaving an unresolved venue editable already works with the existing prop; no split into `lockSubjectIdentity` is needed in this phase. Called out in tests so it can't silently widen.
- **Second creation path (confirmed)**: `handleExternalSelect` (~line 227) calls `findEntityByApiRef`, then `createEntityQuick(...)` itself — it does **not** go through `CreateEntityDialog`.
- **`?? 'others'` fallback (confirmed)**: `normalizeEntityType` in `UnifiedEntitySelector` ends with `parseEntityTypeAtBoundary(rawType) ?? 'others'` — an unparseable external type currently becomes the canonical `others`. That is exactly the conflation both reviewers flagged.
- **`EntityAdapter` (confirmed)** carries no `parent_id` / parent name.
- `UnifiedEntitySelector` uses `useRecentSearches('composer')` — hardcoded namespace.
- `reviews.category` is plain `text`; DB slug functions remain `brand→product`-only (untouched).

## Implementation

### 1. Single-subject mode in the shared selector (no fork)
Add to `UnifiedEntitySelector`:
- `mode?: 'tag' | 'subject'` — default `'tag'`, composer behaviour byte-identical.
- `'subject'`: `maxEntities` forced to 1, `people` excluded from results and keyboard nav, a pick **replaces** the selection and fires `onEntitiesChange([entity])`.
- `recentsSurface?: string` (default `'composer'`) → review passes `'review-subject'`; review searches never pollute composer recents.
- `allowInlineCreate?: boolean` (default `true`) — gates mounting `CreateEntityDialog`. Subject mode passes `false`.
- **`externalResultPolicy?: 'createIfMissing' | 'existingOnly'`** (default `'createIfMissing'`, composer unchanged). Subject mode passes **`'existingOnly'`** (Codex, round 3): local entities are selectable, external results that resolve via `findEntityByApiRef` are selectable, and an external result with no local match **is not created** — it shows "We can't add this one yet — you can add it from the create flow." No `createEntityQuick` call from review subject mode at all. This replaces the earlier per-type "safe types" idea, which would have been a second temporary system to unwind in 2.4.
- **No unknown → `others`** (ChatGPT, round 3): `normalizeEntityType`'s `?? 'others'` becomes `?? null` on the *review subject* path, and a null parse is treated as "not selectable" rather than coerced. A genuinely canonical `others` entity is fully selectable — `others` means "other", never "we couldn't parse it". Since subject mode creates nothing, no unparseable type can be persisted. The composer's existing behaviour is left as-is in this phase (changing it is a separate, wider decision) and the divergence is documented in the code.
- Shared infrastructure stays shared: `useEnhancedRealtimeSearch`, `searchRanking`, `RecentSearchesPanel`, entity cards. No copied search logic.
- **Cross-type audit:** verify results appear for the uncommon types — `tv_show`, `app`, `game`, `service`, `professional`, `brand`, `event`, `experience`, `others` — and that no leftover category filter narrows them. Missing canonical types in the ranking map get fixed in the shared layer; a type that simply has no rows yet is reported, not "fixed".

### 2. New Step 2 content: `SubjectSelectStep`
New `src/components/profile/reviews/steps/SubjectSelectStep.tsx`: heading "What are you reviewing?", helper copy, `UnifiedEntitySelector mode="subject" variant="modal" allowInlineCreate={false} externalResultPolicy="existingOnly" recentsSurface="review-subject"`, plus a selected-subject preview row (image, name, canonical type chip, "Change").
`StepTwo.tsx` and `CategorySelector.tsx` stay on disk with imports removed — deleted in 2.5. The locked entity-page variant stays deliberately plain (2.5 collapses it).

### 3. New `handleSubjectSelect` in `ReviewForm`
Replaces `handleEntitySelect` for Step 2, ordered so nothing branches on stale state:
1. `const canonical = parseEntityTypeAtBoundary(entity.type)`; a `null` parse aborts selection with a message (never coerced).
2. `setCategory(getReviewCategory(...))` — derived from the **new** entity.
3. Prefill from `canonical`, never from the old `category`:
   - `food` → **`foodName` = `entity.name`** (the selected food entity *is* the dish). `venue` = parent place name via the explicit lookup below; unresolved → left empty and user-editable (Step 3's venue field is editable, verified above).
   - `place` → `contentName` = name, `venue` = `formatted_address` when `api_source === 'google_places'`, else `entity.venue`.
   - everything else → `contentName` = name, `venue` = `entity.venue`.
4. `setSelectedEntity` / `setEntityId`, mark step 2 complete.
Changing the subject clears the previous subject's derived fields (same clearing `handleCategoryChange` does today).
The old `handleEntitySelect` stays only for Step 3's fallback; deleted in 2.5.

### 3b. Explicit food-parent lookup path (both reviewers, round 3)
One defined data path, no speculative optional fields on result shapes:

```text
food subject selected  →  entity.id
      →  fetch the canonical entity row by id (existing entity fetch service)
      →  read parent_id
      →  fetch the parent place's name  (reuse getParentEntity from entityHierarchyService)
      →  setVenue(parentName)
```

- Runs **only** for `canonical === 'food'`, after the selection has already been committed — selection never waits on it.
- **Stale-request protection**: capture the selected entity id when the lookup starts and drop the result if the current subject changed (or the dialog closed) before it returns.
- Any failure/absence: subject stays selected, `venue` stays empty and editable. No invented venue, no blocking, no toast noise.
- `EntityAdapter` is **not** extended — the lookup is by id, so every result shape works the same way.

### 4. One authoritative subject
`ReviewForm` passes `disableEntityChange={isFromEntityPage || !!selectedEntity}` and `disableEntityFields={isFromEntityPage || !!selectedEntity}` to `StepThree`:
- Step 2 subject chosen → Step 3 shows it as read-only context; **identity/name locked, venue and media still editable** (verified scope of the existing prop).
- Step 2 skipped → Step 3's old category-scoped `EntitySearch` remains the fallback.
No new plumbing; props Step 3 already supports.

### 5. Skipping is explicit, not the default
With no subject, Step 2's primary Next is **disabled** and a visible secondary action — **"Skip for now"**, with the plain-language note *"You can add what you're reviewing in the next step."* — advances. Edit mode and entity-page entries are unaffected. The skip is logged through existing funnel telemetry so 2.2 can be enabled on evidence. 2.2 removes the hatch.

### 6. Cosmetic
Step-2 dialog title becomes "What are you reviewing?". `totalSteps` stays 4. Step 4 untouched.

### Explicitly NOT in this phase
No wizard collapse, no required subject, no entity creation from subject mode, no dish creation, no DB/slug migration, no Step 3 field removal, no edit-mode/legacy persistence changes, no component deletions, no `?tab=children` work.

## My additions beyond the reviews

- **Edit mode is out of the change surface.** `completedSteps` is `[1,2,3,4]` and `category` comes from the stored review; Step 2 shows the existing subject as a preview, and a legacy review's stored category changes only if the user picks a new entity. Locked by a test.
- **Regression lock on `getReviewCategory`** for all 15 types before 2.1 rewrites it.
- **A test asserts `disableEntityFields` stays narrow** (title locked, venue editable) so a later refactor can't quietly freeze contextual fields.
- **No new search hook.** Unreachable types get fixed in the shared ranking/search layer so `/create` benefits too — never a review-only branch.

## Tests
- `handleSubjectSelect`: derived category + prefill across `food`, `place`, `product`, `course`, `tv_show`, `brand`, `professional`, `others`; switching subject type clears prior fields; unparseable type aborts selection and is never coerced to `others`; no branch reads stale `category`.
- Food parent lookup: resolves venue from the parent place; missing parent leaves venue empty/editable; a stale response after the subject changed is discarded.
- `getReviewCategory` mapping for all 15 canonical types (regression lock).
- Selector `subject` mode: single-replace selection, `people` absent, no `CreateEntityDialog` mounted, **`existingOnly` never calls `createEntityQuick`** while dedupe hits stay selectable, `recentsSurface` isolation; `tag` mode and composer external creation unchanged.
- Step 3 lock scope: title read-only with a Step 2 subject, venue still editable; food subject has `foodName` filled so Next is enabled.
- Step 2 with no subject: Next disabled, "Skip for now" advances.
- `bunx vitest run` + typecheck green.

## Manual acceptance (you)
1. New review → Step 2 select a product, a book, a place, a course, a tv_show; each advances and Step 3 shows that exact subject read-only.
2. Step 2 with nothing selected → Next disabled, "Skip for now" visible; it lands on Step 3's old search, which still submits end-to-end.
3. Select an existing `food` entity → dish name filled and read-only, Next enabled, venue shows the parent restaurant when there is one and is editable when not.
4. External result with no local match → "can't add this yet" message, no row created (verify no new entity in the table).
5. Review from an entity page → subject pre-selected/locked, submit unchanged.
6. Edit an existing review → opens and saves unchanged.
7. `/create` composer unchanged: up to 3 tags, @mentions, inline + external creation, its own recents.

## Roadmap after this
- **2.1** `category = parseEntityType(entity.type)` for new entity-linked reviews; retire `getReviewCategory`; legacy rows keep stored categories.
- **2.2** Subject required for new reviews ("Skip for now" removed); legacy entity-less reviews stay readable/editable.
- **2.3** Parent-aware slug DB migration, isolated, including whether hierarchical slugs apply to any valid `parent_id` or only registered offering pairs.
- **2.4** Lightweight dish-under-place creation; inline creation and `externalResultPolicy='createIfMissing'` re-enabled in subject mode once creation is parent-safe.
- **2.5** Collapse the wizard, remove redundant Step 3 fields, delete `StepTwo`, `CategorySelector`, `getReviewCategory`, `handleEntitySelect`, unused type-scoped search.
- **Separate patch** V4 `?tab=children` deep-link (Phase 1 polish).
