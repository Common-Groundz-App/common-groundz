# Phase 2.4 — Every new review has a real subject (revised)

Phase 2.3 is verified complete (RPC live in the database, quick-create wired in, 362 tests green). Both reviews of the draft plan are accepted with one exception, which I verified in code rather than accepting on trust.

## Response to the review notes

**Accepted — enforce below React.** UI guards alone don't establish the invariant. Both service-level validation and a narrow database `BEFORE INSERT` trigger are now in scope.

**Accepted — creation-path audit as an acceptance criterion.** Already run, and it found *two* insert paths, not one:
- `src/services/reviewService.ts` → `createReview` (the path `ReviewForm` uses)
- `src/services/review/core.ts` → `createReview` (a second, parallel service)

No RPC, edge function, or migration inserts into `public.reviews`. Both service functions get the guard; the trigger backstops anything missed.

**Accepted — cleanup moves to Phase 2.5.** `CategorySelector.tsx` and `steps/StepTwo.tsx` stay untouched; 2.4 is behavior-only.

**Accepted — policy keys off originally persisted state**, never mutable form state.

**Declined — "standalone Service creation" is already shipped.** The concern was that removing Skip creates a dead end for a missing service. It doesn't: `SubjectQuickCreate` renders a button for **all 15** `CANONICAL_ENTITY_TYPES`, including Service. `getProviderTypesFor('service')` returns `[]`, so picking Service goes straight to the name step and creates a parentless entity. `create_entity_subject` only applies the provider→offering allow-list when a parent is supplied, so parentless Service creation is permitted server-side too. Nothing to add — but manual check 9 below confirms it end to end before Skip is removed.

**Accepted — venue stays editable.** `StepThree` applies `readOnly` to the name field only (line 316); venue is untouched and stays that way.

---

## Behavior

- **New review:** Step 2 has no Skip. Next stays disabled until a subject exists; search it or create it.
- **Editing a review that was saved without a subject:** still editable, can still save unlinked, offered an optional "link it" path.
- **Editing a review that was saved with a subject:** subject required, as for a new review.
- **Opened from an entity page:** subject already locked, unchanged.

## Policy matrix

| Context | Requirement |
| --- | --- |
| New review (profile / global) | `required` |
| New review from an entity page | `locked` |
| Edit — originally persisted `entity_id` is null | `legacy-optional` |
| Edit — originally persisted `entity_id` exists | `required` |
| Edit from an entity page | `locked` |

Inputs are `isEditMode`, `originalEntityId` (captured once at load), and `isFromEntityPage`. Clearing the subject in the form never converts a linked review into `legacy-optional`, and selecting a subject on a legacy review never converts it into `required`.

## Not in scope

No `NOT NULL` on `reviews.entity_id`, no backfill. 27 of 77 existing reviews are unlinked (confirmed by query) and must stay editable. No component deletions, no Step 3 questionnaire rework — both are Phase 2.5.

## Technical plan

1. **`src/components/profile/reviews/reviewSubjectPolicy.ts`** (new, pure)
   `subjectRequirement({ isEditMode, originalEntityId, isFromEntityPage })` → `'required' | 'legacy-optional' | 'locked'`, exactly the matrix above. No React, no network.

2. **`SubjectSelectStep.tsx`**
   Replace `onSkip` with a `requirement` prop. The skip affordance renders only for `legacy-optional`, relabelled "Save without linking" with a one-line explanation. For `required`, the create button is the only fallback and the empty-state copy points at it.

3. **`ReviewForm.tsx`**
   - Capture `originalEntityId` once when the form loads and compute the requirement from it.
   - `isNextDisabled()` case 2: blocks on a missing subject for `required`, allows continuing for `legacy-optional`.
   - Remove `handleSubjectSkip`. Submit-time guard: for `required`, a missing entity id stops the submit, returns to Step 2, and toasts human copy — "Choose what you're reviewing before publishing."
   - Emit `review_subject_legacy_unlinked` only when a legacy edit is saved still unlinked. Stop emitting `review_subject_skipped`.

4. **Service-level validation**
   `createReview` in **both** `src/services/reviewService.ts` and `src/services/review/core.ts` throws when `entity_id` is missing or blank. `updateReview` is untouched, so legacy rows stay editable.

5. **Database enforcement (migration)**
   A `BEFORE INSERT` trigger on `public.reviews` raising a clear exception when `entity_id IS NULL`. `INSERT` only — no `UPDATE` guard, no constraint, no backfill, so the 27 legacy rows keep saving.

6. **Telemetry**
   Add `review_subject_legacy_unlinked` to `supabase/functions/log-search-funnel/allowlists.ts`. Keep `review_subject_skipped` in the allow-list for older clients even though the new UI stops sending it. No query text or review text, per the existing privacy contract.

7. **Step 3 derivation check**
   Confirm no `required` path reaches Step 3 with an empty `contentName` / `foodName` gate, across the questionnaire mappings covering all 15 canonical types — not just food and product. Where selection leaves the legacy field blank, derive it from the subject at selection time instead of asking again. Venue stays editable.

8. **Tests**
   Policy matrix (all five rows), Next-gating per requirement, the submit guard, the two service guards, and a mapping sweep so every canonical type yields a non-empty Step 3 title. Full suite must stay green.

## Acceptance criteria

- After 2.4, no application path creates a new review with `entity_id = NULL` — proven by the audit above (two service paths, both guarded) plus the database trigger.
- Legacy unlinked reviews remain editable and savable.
- No behavior change for entity-page reviews.

## Manual verification

1. New review from the profile: no Skip; Next disabled until a subject is picked.
2. Search something that doesn't exist → create it → auto-selects → Next enables.
3. Edit a legacy unlinked review → the link prompt appears; saving unlinked still works.
4. Edit a linked review → no prompt, subject required.
5. Review from an entity page → locked, unchanged.
6. Submit a new review → saved row has a non-null `entity_id` and appears on the entity page.
7. **Brand → product:** create "Sony", then "WH-1000XM6" → auto-selects → review attaches to the **product**, not Sony.
8. **Place → dish:** create "Truffles", then "Classic Burger" → venue context resolves → review attaches to the **food** entity, not Truffles.
9. **Standalone service:** pick Service, name it, create → no provider step, review attaches to the new service entity.

Stop for verification after 2.4; cleanup lands in 2.5.
