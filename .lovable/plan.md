# Phase 2.2 — Subject required for new reviews (+ 2.1 dead-code cleanup)

You're right: Phase 3 (config-driven questionnaires) is a later item. The roadmap order is 2.2 next, and the config work only makes sense after subjects are reliable. This plan follows the roadmap.

## Phase 2.1 verification: complete

Verified in code, not assumed:

- `subjectSelection.ts` exports `resolveQuestionnaireKind`, `mapCanonicalToLegacyCategory`, `deriveSubjectPrefill`.
- `ReviewForm.tsx` separates questionnaire kind from the persisted canonical category, and `subjectOrigin` decides which is written — reopening and re-saving an old review cannot rewrite its stored category.
- `_shared/reviewCategoryBuckets.ts` exists with idempotent normalization, reverse expansion, null-on-unknown; parity enforced by `reviewCategoryBucketParity.test.ts`.
- Telemetry allowlists extracted to `log-search-funnel/allowlists.ts`; only `hadResults` and clamped `queryLength` accepted.
- Step 2 Next is already disabled without a subject; `review_subject_step_shown/selected/skipped/attached_late` all fire.
- `getReviewCategory` no longer exists anywhere — already retired.
- Suite green: 27 files / 358 tests. Build log: `build OK`.

Deferred leftover, cleaned up in this phase: `steps/StepTwo.tsx` and `reviews/CategorySelector.tsx` are unreferenced by the review flow (StepTwo is the only consumer of that CategorySelector; the admin CategorySelector is a different component and stays).

## The one real decision in 2.2

Your roadmap says the free-text-only path is removed *only once creation covers every type* — and creation coverage is Phase 2.4 (dish-under-place). So a hard block today would trap anyone whose subject isn't in the database yet.

So 2.2 makes the subject **required by default with one deliberate, tracked escape hatch**, not an equal-weight "Skip for now" button:

- The neutral ghost "Skip for now" button is gone.
- In its place, an underlined text link "I can't find what I'm reviewing" that only appears **after a search has run and returned no results** — never as a default first-screen option.
- Choosing it opens a short confirm: "Without a subject this review won't appear on any entity page or count toward its rating. Continue anyway?" → Continue / Keep searching.
- Continuing logs `review_subject_skipped` exactly as today (no telemetry change) and proceeds to Step 3 unchanged.
- A single constant `REQUIRE_REVIEW_SUBJECT` controls whether the escape hatch exists at all. Phase 2.4 flips it to hard-required once creation covers every type — a one-line change, no rewrite.

Legacy and edit paths are untouched: an existing entity-less review stays fully readable and editable, and editing it never forces a subject.

## What changes for the user

- Creating a review: the subject step is now effectively mandatory; you must search and pick something.
- If nothing matches, you get an honest explanation of what you lose before you continue without one.
- Editing an old review with no subject: unchanged, no new blocking, and the "attach a subject" path still works and still logs `review_subject_attached_late`.
- Entity-page reviews: unchanged — the subject is pre-filled and locked as it is today.

## Technical plan

**2.2.1 Subject requirement in `ReviewForm.tsx`**
- Add `REQUIRE_REVIEW_SUBJECT` (module constant, documented as the 2.4 flip point).
- Replace `handleSubjectSkip` with `handleSubjectSkipConfirmed`, called only from the confirm dialog; it keeps the existing `logFunnel({ event: 'review_subject_skipped' })` call and `handleNext()`.
- `isNextDisabled()` case 2 stays `!selectedSubject`.
- Guard submit: for a **new, non-edit** review, if `REQUIRE_REVIEW_SUBJECT` is on and there is neither a `selectedSubject` nor an acknowledged skip, block submit with a toast pointing back to Step 2. This closes the step-indicator route around Step 2 (`handleStepClick` allows jumping to completed steps).
- `handleStepClick` may not mark Step 2 complete unless a subject is selected or the skip was acknowledged.

**2.2.2 `SubjectSelectStep.tsx`**
- Drop the always-visible ghost "Skip for now"; add the conditional "I can't find what I'm reviewing" link, shown only when a search has completed with zero results (needs the step to expose a `hasSearchedWithNoResults` signal from the selector's result state, which it already renders an empty state for).
- Add the confirm dialog (existing `AlertDialog` primitive) with the consequence copy above.
- Copy stays consistent with project terminology — "experience"/"recommending", no "post".

**2.2.3 Dead-code removal**
- Delete `src/components/profile/reviews/steps/StepTwo.tsx` and `src/components/profile/reviews/CategorySelector.tsx`.
- Confirm zero remaining references before deleting; the admin `CategorySelector` is untouched.

**2.2.4 Tests** (new `src/components/profile/reviews/__tests__/subjectRequirement.test.ts`, registered in `vitest.config.ts`)
- Pure helper extracted for the rule (`canSubmitReview({ isEditMode, selectedSubject, skipAcknowledged, requireSubject })`) so it's testable without rendering:
  - new review + no subject + no acknowledgement → blocked.
  - new review + subject → allowed.
  - new review + acknowledged skip → allowed while the flag permits it; blocked when the flag is flipped to hard-required.
  - edit mode + entity-less legacy review → always allowed.
  - entity-page origin → allowed.
- Existing `subjectSelection` and parity suites must stay green.

Verification: full Vitest run, `tsgo --noEmit`, and a clean build log before reporting.

## Out of scope (stays on the roadmap)

- 2.3 parent-aware slug DB migration, incl. whether hierarchical slugs apply to any `parent_id` or only registered offering pairs.
- 2.4 lightweight dish-under-place creation, and the flip to hard-required.
- 2.5 wizard collapse and removal of now-redundant Step 3 fields.
- Config-driven questionnaires / `generic` questionnaire kind (Phase 3).
- V4 `?tab=children` deep-link (separate Phase 1 polish patch).
- Any Supabase migration, backfill, or `entity_id NOT NULL`.
