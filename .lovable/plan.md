# Phase 2.3 verification + Phase 2.4 — Every review has a real subject

## Phase 2.3 verification: complete

Verified against code and the live database, not assumed:

- `create_entity_subject` exists in the database (confirmed by query), with the advisory-locked exact-identity recheck, the provider→offering allow-list, and the empty-normalized-name rule.
- `createEntitySubject` in `src/services/enhancedEntityService.ts` calls the RPC and retries only on recognized duplicate constraints; everything else fails loudly.
- `SubjectQuickCreate.tsx` is wired into `SubjectSelectStep.tsx` ("Can't find it? Add something new"), preserves the review draft on cancel, blocks on exact duplicates with a "Review this" escape hatch, warns on possible ones, and auto-selects the created subject.
- Shared server classifier (`_shared/exactIdentity.ts`), the Deno mirror (`_shared/offeringPairs.ts`), and `check-entity-duplicates` all agree; the parity test asserts SQL ↔ registry ↔ mirror.
- Full suite green: 362 tests, 28 files.

### Two leftovers (from Phase 2.0, not 2.3)

`src/components/profile/reviews/CategorySelector.tsx` and `src/components/profile/reviews/steps/StepTwo.tsx` are the old category-picker components. Nothing imports either one — the admin `CategorySelector` is a different file and stays. Phase 2.4 deletes both.

---

## Phase 2.4 — Requiring a subject

Today Step 2 still offers "Skip for now", which produces reviews with no linked entity: **27 of 77 reviews have `entity_id = NULL`** (confirmed by query). Those reviews cannot appear on an entity page, cannot contribute to a rating, and cannot participate in the provider/offering hierarchy the last four phases built. Phase 2.4 closes that hole for new reviews without breaking the existing 27.

### What changes for the user

- Step 2 no longer has a "Skip for now" link. Continuing requires a chosen subject — and since 2.3 there is always a way to get one: search it, or add it.
- If the search comes up empty, the copy points at the create path instead of at a skip.
- Editing one of the 27 older reviews still works. Those show a gentle "Link this to what you reviewed" prompt, and can still be saved unlinked, so nobody's history becomes uneditable.
- Reviews opened from an entity page are unchanged (the subject is already locked).

### Explicitly not in scope

No `NOT NULL` on `reviews.entity_id` and no backfill migration. 27 legacy rows exist and the edit path must keep accepting them; the requirement is enforced at the composer, which is where new data enters. There are **no database changes in this phase**.

### Technical plan

1. **New pure module `src/components/profile/reviews/reviewSubjectPolicy.ts`**
   `subjectRequirement({ isEditMode, existingEntityId, isFromEntityPage })` → `'required' | 'legacy-optional' | 'locked'`.
   - New review → `required`
   - Edit of a review that was saved with `entity_id = null` → `legacy-optional`
   - Opened from an entity page → `locked`
   Pure, no React, no network — unit-tested alongside the existing `subjectSelection.test.ts`.

2. **`SubjectSelectStep.tsx`**
   Replace the `onSkip: () => void` prop with `requirement` from the policy. Render the skip affordance only for `legacy-optional`, relabelled as an explicit "Save without linking" with a one-line explanation. For `required`, drop the skip block entirely and keep the create button as the single fallback, with copy that reads as a next step rather than a dead end.

3. **`ReviewForm.tsx`**
   - Compute the requirement once and pass it down.
   - `isNextDisabled()` case 2 stays `!selectedSubject` for `required`; allows continuing without one for `legacy-optional`.
   - Delete `handleSubjectSkip`; replace the `review_subject_skipped` event with `review_subject_legacy_unlinked` emitted only when a legacy edit is saved still unlinked, so the metric measures the remaining tail instead of a removed button.
   - Guard submit: for `required`, a missing `entityId` blocks with a toast and returns to Step 2 — the disabled Next button is not the only line of defence.

4. **Step 3 consistency**
   With a subject always present for new reviews, `StepThree`'s name/venue fields are already disabled via `disableEntityFields`. Verify nothing in the `required` path can reach Step 3 with empty `contentName` / `foodName`, since those still gate `handleNext`; if the derivation leaves them blank for any canonical type, fill them from the subject at selection time rather than asking the user again.

5. **Delete the orphans**
   `src/components/profile/reviews/CategorySelector.tsx` and `src/components/profile/reviews/steps/StepTwo.tsx`, after a final import check.

6. **Tests**
   Policy matrix (new / legacy-unlinked / legacy-linked / entity-page), Next-gating per requirement, and the submit guard. Full suite must stay green.

### Manual verification

1. New review from the profile page: Step 2 shows no skip; Next is disabled until a subject is picked.
2. Search something that doesn't exist → create it via the 2.3 drawer → it auto-selects and Next enables.
3. Edit an older review that has no subject → the unlink prompt appears, saving unlinked still works.
4. Edit an older review that *has* a subject → behaves like a normal linked review, no prompt.
5. Review from an entity page → subject locked, unchanged.
6. Submit a new review and confirm the saved row has a non-null `entity_id` and shows on the entity page.
