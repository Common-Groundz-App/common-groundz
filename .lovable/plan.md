# Phase 3D close-out — two real gaps, closed the strict way (revision 2)

## Audit result

Phase 3D is **not** fully closed yet. Everything else checks out — verified now, not assumed:

- Full suite: **627/627 pass** (38 files). Build log clean.
- No `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`, `isLegacyReviewCategory`,
  `deriveSubjectPrefill`, `SubjectPrefill`, `SubjectLike`, `foodName`, `contentName`,
  `LegacyReviewCategory` anywhere in `src` or `supabase`. `subjectSelection.ts` is gone.
- The bucket mapping lives in `src/services/reviewCategoryBuckets.ts`, documented as a
  search/filter projection; no production authoring/questionnaire module imports it.
- `ReviewForm.tsx` has one category idea (`canonicalCategory`) and writes `reviews.category`
  only via `resolvePersistedCategory`, blocking the save when it resolves to `null`.
- Client `is_converted` removed; deprecation note recorded.

## The two gaps

1. **The bucket parity test still sits inside the review-authoring tree.**
   `src/components/profile/reviews/__tests__/reviewCategoryBucketParity.test.ts` imports the
   five-bucket module, so the 3D.2 invariant as written is false.
2. **Acceptance case 7 is untested.** "Replacing the subject with a different subject of the
   same type still resets subject-specific answers" is implemented (`handleSubjectChange` →
   `resetQuestionnaireAnswers`, keyed on entity id) but nothing asserts the reset *outcome*.

Both reviewers agree these are real. Where they differ, the stricter reading wins:

- Move the parity test rather than exempting it in the documentation. Weakening the invariant
  to match a misplaced file is the wrong direction.
- Test the whole reset outcome, not a boolean id comparison. A `shouldResetSubjectAnswers`
  helper would only prove that two ids differ — it would prove nothing about answers, curated
  tags, touched state, the envelope or food tags actually being cleared. So no such helper;
  the inline id check stays as it is.

## Plan

### 1. Move the parity test out of the review-authoring tree

- Merge `reviewCategoryBucketParity.test.ts` into `src/services/__tests__/reviewCategoryBuckets.test.ts`
  as a `frontend ↔ Deno bucket mapping parity` describe block, keeping all six cases verbatim.
- Delete the old file; fix the relative import of the Deno mirror for the new location; update
  the `vitest.config.ts` include list if it names the file.
- The 3D.2 invariant stays strong and unchanged: **nothing under
  `src/components/profile/reviews/**` imports the five-bucket module** — production or test.

### 2. Test the complete same-type subject replacement reset

Two layers, because the requirement spans form state and what gets persisted:

- **Persistence layer** (`phase3dCompatibility.test.ts`, pure): drive
  `buildReviewMetadataForSave` with a stored review that has a questionnaire envelope, food
  tags and unrelated root metadata (e.g. provenance), then save with `questionnaireReset: true`
  and empty answers. Assert the envelope key and `food_tags` are removed, and that unrelated
  root metadata survives byte-identical. Assert the mirror case `questionnaireReset: false`
  with untouched answers leaves the stored envelope intact.
- **Behaviour layer** (component test, `ReviewForm`, same-type swap): with a product subject
  selected and questionnaire answers/food tags present, select a *different* product entity and
  assert the visible questionnaire answers and food tags are cleared; then re-select the
  *identical* entity id and assert nothing is cleared. This is what proves the acceptance case,
  since the rule is per-subject, not per-type.

### 3. Reopen, then re-close the bookkeeping

- Reopen roadmap items 3D.2 and 3D.7 (and add these two tasks) before implementing, then tick
  them again once the evidence exists.
- Update `docs/verification/phase-3d-cleanup.md`: the corrected 3D.2 grep output with the test
  moved, acceptance case 7 added to the 3D.7 list with its two test layers, and refreshed test
  counts. Phase 3C's two runtime checks stay marked UNVERIFIED.

### Verification

- Focused runs first, then `bunx vitest run` full suite green.
- `tsgo --noEmit`; production build green.
- Re-run the alias/import grep and quote it: no `reviewCategoryBuckets` reference anywhere
  under `src/components/profile/reviews/**`; production consumers confined to the documented
  search/filter compatibility layer.

### Out of scope

- No database migration, no product behaviour change, no new abstraction.
- Work stops at the Phase 3D close-out. Phase 2.5B is not started.
