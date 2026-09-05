# Phase 3D audit result + two small gap closures

## Audit result

Phase 3D is implemented and correct. Verified now, not assumed:

- Full suite: **627/627 pass** (38 files). Build log clean.
- No `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`, `isLegacyReviewCategory`,
  `deriveSubjectPrefill`, `SubjectPrefill`, `SubjectLike`, `foodName`, `contentName`,
  `LegacyReviewCategory` anywhere in `src` or `supabase`. `subjectSelection.ts` is gone;
  only two doc comments mention it historically.
- The bucket mapping lives in `src/services/reviewCategoryBuckets.ts`, documented as a
  search/filter projection. No review-authoring or questionnaire module imports it.
- `ReviewForm.tsx` has a single category idea (`canonicalCategory`) and writes
  `reviews.category` exclusively via `resolvePersistedCategory`, blocking the save when it
  resolves to `null`.
- Client `is_converted` is removed; only generated types retain it, with the deprecation
  note recorded in `reviewService.ts` and the close-out.
- Roadmap 3D.0–3D.8 all ticked; `docs/verification/phase-3d-cleanup.md` present with the
  classification, alias-audit and `is_converted` tables.

## Two gaps found (documentation/test only, no behaviour defect)

1. **Acceptance case 7 has no dedicated test.** "Replacing the subject with a different
   subject of the same type still resets subject-specific answers" is implemented in
   `handleSubjectChange` (`if (subject.id !== entityId) resetQuestionnaireAnswers()` — keyed
   on id, so a same-type swap does reset), but no named test asserts it, and the close-out's
   3D.7 list silently drops it.
2. **The 3D.2 invariant grep is stated more absolutely than the repo supports.**
   `src/components/profile/reviews/__tests__/reviewCategoryBucketParity.test.ts` does import
   the bucket module. That is the intentional Deno-mirror parity test, not authoring code, but
   the close-out claims no `src/components/profile/reviews/**` importer.

## Plan

### 1. Extract the subject-reset rule and test it

- Add a tiny pure helper `shouldResetSubjectAnswers(previousEntityId, nextEntityId)` next to
  `categoryPersistence.ts` (same folder, same style: pure, no React), and call it from
  `handleSubjectChange` in place of the inline id comparison. Behaviour identical.
- Add named cases to `phase3dCompatibility.test.ts`: different subject of the **same** type
  resets, a different type resets, and re-selecting the identical id does not reset.

### 2. Correct the close-out wording

- In `docs/verification/phase-3d-cleanup.md`, restate the 3D.2 invariant precisely: no
  review-authoring or questionnaire **source** module imports the bucket module; the single
  importer under `reviews/**` is the Deno-mirror parity test, named explicitly.
- Add acceptance case 7 to the 3D.7 list and update the test count.

### Verification

- `bunx vitest run` — full suite green (627 baseline plus the new cases).
- `tsgo --noEmit`; production build green.
- Grep proof that the only `reviewCategoryBuckets` importers are the two test files and the
  Deno mirror.

### Out of scope

- No database migration, no behaviour change, no Phase 2.5B work.
- The two Phase 3C runtime checks stay UNVERIFIED.
