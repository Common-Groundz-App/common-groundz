# Phase 2.0 verification + Phase 2.1: honest per-type review categories

## Phase 2.0 status: implemented, with two small gaps

Verified in code:
- `SubjectSelectStep` is Step 2 in `ReviewForm.tsx`; `StepTwo`/`CategorySelector` (review versions) are no longer imported anywhere — they only sit on disk as planned for deletion in 2.5. The admin `CategorySelector` is a different, unrelated component.
- `UnifiedEntitySelector` has `mode`, `recentsSurface`, `allowInlineCreate`, `externalResultPolicy`; subject mode is single-select, excludes people, mounts no create dialog, and `existingOnly` never calls `createEntityQuick`; unparseable external types are not coerced.
- `subjectSelection.ts` derives category + Step 3 prefill purely; food subject fills `foodName`, venue is left to the async `getParentEntity` lookup with stale-request protection.
- Step 3 receives `disableEntityChange`/`disableEntityFields` from the chosen subject; venue and media stay editable.
- Tests green (49 in the review/taxonomy suites, full suite previously 352), build log says `build OK`.

Gaps against the approved 2.0 plan (fixed as the first item of 2.1):
1. Step 2's primary **Next is not disabled** when no subject is chosen — Next and "Skip for now" currently behave identically, so skipping is still implicit. `isNextDisabled()` has no `case 2`.
2. The skip is **not logged** to funnel telemetry, so 2.2 ("subject required") would have no evidence behind it.

## Phase 2.1 — persist the real entity type as the review category

Today every review is squashed into one of five legacy buckets (`food`, `movie`, `book`, `place`, `product`), so a course, a game, a brand and a service all persist as `product`. Phase 2.1 stores the **canonical type** for reviews that have a subject, while keeping the questionnaire itself unchanged.

### What the user sees
- A review of a course shows "Course", a TV show shows "TV Show", an event shows "Event" — instead of everything collapsing to Product/Place.
- The questions asked in Steps 3 and 4 do not change at all in this phase (that is Phase 3).
- Old reviews keep exactly the category they were saved with.

### How it works
Split the single overloaded `category` state into two ideas:

```text
subject.type ──parse──► canonicalType     → persisted as reviews.category   (new)
                          │
                          └─map──────────► questionnaireKind (5 buckets)    → drives Steps 3/4 UI only
```

- `questionnaireKind` reuses the existing `mapCanonicalToLegacyCategory` from `subjectSelection.ts`; Steps 3/4, emoji/title copy, food-tag metadata and the `foodName` vs `contentName` branch all read `questionnaireKind`, so their behaviour is byte-identical to today.
- Persistence writes `category = canonicalType` when a subject exists, and falls back to `questionnaireKind` when the user skipped Step 2 (no subject → no honest type to store).
- Edit mode: the stored category is loaded, parsed with `getCanonicalType` to derive `questionnaireKind`, and re-saved unchanged unless the user picks a new subject. Legacy rows are never rewritten.
- No database migration: `reviews.category` is already plain `text`, and no query anywhere filters reviews by category (confirmed across `src/services/review/*`, the review hooks, and explore/recommendation services — the `category` filters there belong to `user_interests`/recommendations, not reviews).
- Display is already safe: `ReviewCard` renders the category through `getCanonicalType` + `getEntityTypeLabel` and `getEntityTypeFallbackImage`, so canonical values like `course` or `tv_show` label and illustrate correctly with no card changes.

### Also in this phase (closing the 2.0 gaps)
- `isNextDisabled()` gets `case 2: return !selectedSubject && !isEditMode && !isFromEntityPage` so Next is disabled without a subject and "Skip for now" becomes the only explicit way past it.
- The skip fires the existing funnel telemetry with the step and the search query state, so 2.2 can be turned on with evidence.

### Explicitly NOT in this phase
No questionnaire changes, no required subject, no dish creation, no slug/DB migration, no wizard collapse, no component deletions, no backfill of existing rows.

## Technical notes
- Files touched: `src/components/profile/reviews/ReviewForm.tsx` (state split + persistence), `src/components/profile/reviews/subjectSelection.ts` (add a `resolveQuestionnaireKind` helper for the edit-mode/legacy path), plus tests.
- `getReviewCategory` inside `ReviewForm` is replaced by the shared mapping so there is one mapping table, not two. `handleEntitySelect` (Step 3 fallback) is updated to set both values consistently; it is still deleted in 2.5.
- Guard: any stored category that does not parse keeps its raw stored value on save (no coercion to `product`, no coercion to `others`).

## Tests
- New review with a `course`, `tv_show`, `brand`, `service`, `event`, `game`, `app`, `professional`, `others` subject persists that canonical type while `questionnaireKind` stays in the five buckets.
- Skipped Step 2 persists the legacy bucket exactly as today.
- Edit of a legacy review (`category: 'product'`) derives the product questionnaire and re-saves `product` untouched; picking a new subject updates it.
- Step 2 gating: Next disabled with no subject, enabled once selected, unaffected in edit/entity-page mode.
- Regression lock on the canonical → questionnaire mapping for all 15 types stays green.
- `bunx vitest run` + `tsgo --noEmit`.

## Manual acceptance
1. Review a course → saved review badge reads "Course", questions are the product ones.
2. Review a TV show → badge "TV Show"; a movie still reads "Movie".
3. Review a food entity → dish name + food tags behave exactly as before.
4. Step 2 with nothing selected → Next greyed out, "Skip for now" works and the review still submits.
5. Open an old review in edit mode → same questions, same badge after saving.
6. `/create` composer unchanged.
