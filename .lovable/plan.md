# Phase 2.0 — Entity selection replaces category selection (4 steps kept)

Revised after two rounds of ChatGPT/Codex review. Every correction is accepted, and each one was confirmed in code before adopting it. Scope is still additive and reversible — nothing working is deleted.

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
- **Confirmed the stale-category bug**: `handleEntitySelect` (line ~398) sets `selectedEntity`/`entityId` then branches on the **current** `category` and **never sets `category`**. With the `'food'` default, picking a course today writes the course name into `venue` and leaves `category='food'`.
- **Confirmed the food dead-end**: `isNextDisabled` for step 3 returns `!foodName` when `category === 'food'`, and Step 3's title input is `readOnly` when `disableEntityFields && selectedEntity`. Leaving `foodName` empty while locking Step 3 would make a food subject unsubmittable.
- **Confirmed the second creation path**: `handleExternalSelect` (line ~227) calls `findEntityByApiRef` then `createEntityQuick(...)` on its own — it does **not** go through `CreateEntityDialog`. Hiding the dialog alone does not stop entity creation.
- **Confirmed**: `EntityAdapter` (the selector's result shape) carries no `parent_id` / parent-name field, so a dish's parent cannot be read off a selection result.
- **Confirmed**: `UnifiedEntitySelector` uses `useRecentSearches('composer')` — a hardcoded namespace.
- `StepThree` already has `disableEntityChange` / `disableEntityFields` props (used today for the entity-page case).
- `reviews.category` is plain `text`; DB slug functions remain `brand→product`-only (untouched here).

## Implementation

### 1. Single-subject mode in the shared selector (no fork)
Add to `UnifiedEntitySelector`:
- `mode?: 'tag' | 'subject'` — default `'tag'`, composer behaviour byte-identical.
- `'subject'`: `maxEntities` forced to 1, `people` excluded from results and keyboard nav, a pick **replaces** the selection and fires `onEntitiesChange([entity])`.
- `recentsSurface?: string` (default `'composer'`) → review passes `'review-subject'`, so review searches never pollute composer recents.
- **Two separate creation switches, because there are two creation paths:**
  - `allowInlineCreate?: boolean` (default `true`) — gates mounting `CreateEntityDialog`. Subject mode passes `false`.
  - `externalCreatePolicy?: 'allow' | 'safeTypesOnly'` (default `'allow'`, composer unchanged) — gates `handleExternalSelect`'s `createEntityQuick`. Subject mode passes `'safeTypesOnly'`, blocking creation when the normalized type is `food` (parentless offering) or when the type failed to parse and fell back to `others`. Blocked picks show "We can't add this one yet — try searching for it by name", never a silent create. Results that already resolve via `findEntityByApiRef` stay selectable — dedupe is a read, not a create.
  - The "can't find it" row shows non-dead-end copy: "Can't find it? Add it from the create flow for now." Safe creation returns in 2.4.
- Shared infrastructure stays shared: `useEnhancedRealtimeSearch`, `searchRanking`, `RecentSearchesPanel`, entity cards. No copied search logic.
- **Cross-type audit:** verify the search path returns results for the uncommon types too — `tv_show`, `app`, `game`, `service`, `professional`, `brand`, `event`, `experience`, `others` — and that no leftover category filter narrows them. If the ranking/category map omits a canonical type, add it here; if a type simply has no rows yet, say so in the verification report rather than "fixing" it.

### 2. New Step 2 content: `SubjectSelectStep`
New `src/components/profile/reviews/steps/SubjectSelectStep.tsx`: heading "What are you reviewing?", helper copy, `UnifiedEntitySelector mode="subject" variant="modal" allowInlineCreate={false} externalCreatePolicy="safeTypesOnly" recentsSurface="review-subject"`, plus a selected-subject preview row (image, name, canonical type chip, "Change").
`StepTwo.tsx` and `CategorySelector.tsx` stay on disk with imports removed — deleted in 2.5. The locked entity-page variant stays deliberately plain (2.5 collapses it).

### 3. New `handleSubjectSelect` in `ReviewForm`
A dedicated handler replaces `handleEntitySelect` for Step 2, ordered so nothing branches on stale state:
1. `const canonical = parseEntityTypeAtBoundary(entity.type)`.
2. `setCategory(getReviewCategory(...))` — derived from the **new** entity, not current state.
3. Prefill from `canonical`, not from the old `category`:
   - `food` → **`foodName` = `entity.name`** (the selected food entity *is* the dish; empty would trip Step 3's `!foodName` gate on a read-only field). `venue` = the dish's parent place name **when resolvable**: from the selected entity if present, else one targeted `parent_id` → parent `name` lookup by id; with no parent, `venue` falls back to `entity.venue` and stays user-editable. Never invent a venue.
   - `place` → `contentName` = name, `venue` = `formatted_address` when `api_source === 'google_places'`, else `entity.venue`.
   - everything else → `contentName` = name, `venue` = `entity.venue`.
4. `setSelectedEntity` / `setEntityId`, mark step 2 complete.
Changing the subject clears the previous subject's derived fields (the same clearing `handleCategoryChange` does today) so no stale name/venue survives a type switch. The old `handleEntitySelect` remains only for Step 3's fallback and is deleted in 2.5.

### 4. One authoritative subject
`ReviewForm` passes `disableEntityChange={isFromEntityPage || !!selectedEntity}` and `disableEntityFields={isFromEntityPage || !!selectedEntity}` to `StepThree`:
- Step 2 subject chosen → Step 3 shows it read-only as context; media and remaining fields keep working.
- Step 2 skipped → Step 3's old category-scoped `EntitySearch` remains the fallback, using the `category` default as today.
Props Step 3 already supports, so this is a one-line change.

### 5. Skipping is explicit, not the default
With no subject, Step 2's primary Next is **disabled** and a visible secondary action — **"Skip for now"** with a one-line note that subject-less reviews will stop being supported — advances the step. Edit mode and entity-page entries are unaffected. The entity-first path becomes the obvious one while keeping a deliberate escape hatch until 2.2 removes it.

### 6. Cosmetic
Step-2 dialog title becomes "What are you reviewing?". `totalSteps` stays 4. Step 4 untouched.

### Explicitly NOT in this phase
No wizard collapse, no required subject, no dish creation, no DB/slug migration, no Step 3 field removal, no edit-mode/legacy persistence changes, no component deletions, no `?tab=children` work.

## My additions beyond the two reviews

- **Edit mode is out of the change surface.** In edit mode `completedSteps` is `[1,2,3,4]` and `category` comes from the stored review; Step 2 shows the existing subject as a preview, and a legacy review's stored category changes only if the user actually picks a new entity. Locked by a test.
- **Regression lock on `getReviewCategory`** for all 15 types before 2.1 rewrites it — this is what proves 2.1 changed persistence deliberately.
- **No new search hook.** If the audit finds an unreachable type, the fix goes in the shared ranking/search layer so `/create` benefits too — never a review-only branch.
- **Parent lookup is best-effort and non-blocking.** A failed or slow parent fetch still completes the selection with an editable `venue`; it must never block choosing a subject.
- **"Skip for now" is counted** via the existing funnel telemetry, so 2.2 can be enabled on evidence about how often the hatch is used.

## Tests
- `handleSubjectSelect` prefill + derived category across `food`, `place`, `product`, `course`, `tv_show`, `brand`, `professional`; switching subject type clears prior fields; no branch reads stale `category`.
- `getReviewCategory` mapping for all 15 canonical types (regression lock).
- Selector `subject` mode: single-replace selection, `people` absent, `allowInlineCreate={false}` mounts no dialog, `externalCreatePolicy='safeTypesOnly'` blocks external `food` and `others`-fallback creation while still allowing dedupe hits, `recentsSurface` isolation; `tag` mode and composer external creation unchanged.
- Food subject: `foodName` set from the entity name, Step 3 Next enabled with the field read-only, `venue` resolves to the parent place when one exists and stays editable when it doesn't.
- Step 2 with no subject: Next disabled, "Skip for now" advances.
- `bunx vitest run` + typecheck green.

## Manual acceptance (you)
1. New review → Step 2 select a product, a book, a place, a course, a tv_show; each advances and Step 3 shows that exact subject read-only.
2. Step 2 with nothing selected → Next disabled, "Skip for now" visible; using it lands on Step 3's old search, which still submits end-to-end.
3. Select an existing `food` entity → dish name filled and read-only, Next enabled, venue shows the parent restaurant when there is one.
4. External result whose type resolves to `others` → clear "can't add this yet" message, no row created.
5. Review from an entity page → subject pre-selected/locked, submit unchanged.
6. Edit an existing review → opens and saves unchanged.
7. `/create` composer unchanged: up to 3 tags, @mentions, inline creation, its own recents.

## Roadmap after this
- **2.1** `category = parseEntityType(entity.type)` for new entity-linked reviews; retire `getReviewCategory`; legacy rows keep stored categories.
- **2.2** Subject required for new reviews ("Skip for now" removed); legacy entity-less reviews stay readable/editable.
- **2.3** Parent-aware slug DB migration, isolated, including whether hierarchical slugs apply to any valid `parent_id` or only registered offering pairs.
- **2.4** Lightweight dish-under-place creation; inline creation and `externalCreatePolicy='allow'` re-enabled in subject mode once creation is parent-safe.
- **2.5** Collapse the wizard, remove redundant Step 3 fields, delete `StepTwo`, `CategorySelector`, `getReviewCategory`, `handleEntitySelect`, unused type-scoped search.
- **Separate patch** V4 `?tab=children` deep-link (Phase 1 polish).
