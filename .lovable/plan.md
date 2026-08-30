# Phase 2.4 — Every new review has a real subject (revised, final)

Phase 2.3 is verified complete. Both review rounds are now folded in. I checked each new claim against the live database and the form code rather than accepting it — two of them changed the plan materially, and one recommendation I'm declining with evidence.

## Corrections accepted

**1. The Service mismatch is real — I was wrong.** I read the live `create_entity_subject` definition. It contains:

```sql
IF v_type = 'service' THEN
  RAISE EXCEPTION 'service subjects cannot be created here' USING ERRCODE = '22023';
END IF;
```

and its standalone allow-list is `place, book, movie, tv_show, course, app, game, event, brand, professional, experience, product, others` — no `service`. Meanwhile `SubjectQuickCreate` renders a button for all 15 canonical types. Today that path fails at the RPC; once Skip is removed it becomes a dead end.

**Decision: option A — support standalone Service.** A service (a salon, a plumber, a repair shop) is a legitimate review subject, and the fix is one line in the same migration this phase already needs. It adds **no** provider relationship: `service` becomes creatable only with `parent_id = NULL`. Frontend and RPC then agree.

**2. One invariant, not two.** Subject absence is permitted **only** for `legacy-optional`. `required` and `locked` both demand an entity id. Expressed once in the policy module as `allowsMissingSubject(requirement)` (true only for `legacy-optional`), consumed by both the Next gate and the submit guard, so a malformed entity-page context is caught in the form rather than falling through to a database error.

**3. `originalEntityId` is scoped to the loaded review.** `ReviewForm` stays mounted across close/reopen and across switching reviews, so a plain `useState` initialiser would leak the previous review's legacy status. It is keyed on the loaded review id and recomputed whenever that id (or create/edit mode) changes — a stale `null` must never make a linked review editable-unlinked.

**4. Copy: "Continue without linking."** With explanatory text: "You can keep this older review unlinked and continue editing it." The actual save is still on the final step, so "Save without linking" would have been misleading.

**5. `isFromEntityPage` semantics — verified, and the matrix changes because of it.** Line 145 of `ReviewForm.tsx` is `const isFromEntityPage = !!entity && !isEditMode;`. So "edit from an entity page" is genuinely **not detectable** with today's props, and today's edit flow already lets the user change the subject. Rather than invent a new lock, the matrix drops that row: `hasEntityContext = !!entity` is introduced for clarity, `locked` means `isFromEntityPage` (new + entity context), and edits are governed purely by `originalEntityId`. This is the honest description of existing behaviour and avoids a silent UX change in a phase that is meant to be about one invariant.

**6. Trigger also rejects soft-deleted subjects.** A non-null `entity_id` pointing at `is_deleted = true` is not a valid subject.

## Declined, with data

**Type-consistency (`reviews.category = entity.type`) at the creation boundary.** I queried the live rows: of 50 linked reviews, **17 already disagree** — 12 are `category = 'food'` on a `place` entity and 5 are `category = 'product'` on a `brand` entity. Those are exactly the legacy provider-review shapes that Phase 2.2/2.3 introduced the hierarchy to replace, and the legacy Step 3/4 questionnaire still derives `category` through the bucket mapping rather than copying the type. A hard check in the trigger or service would therefore reject writes the current questionnaire legitimately produces, and it would fail with a confusing error rather than teaching the user anything.

Instead: log `review_subject_type_divergence` (enumerated types only, no text) when a new review's category doesn't equal its subject's canonical type. That gives real numbers on whether divergence still happens on *new* rows, and Phase 2.5 — which owns the questionnaire cleanup — can enforce it with evidence instead of a guess.

---

## Policy matrix

| Context | Requirement | May save unlinked |
| --- | --- | --- |
| New review (profile / global) | `required` | no |
| New review with entity context (`isFromEntityPage`) | `locked` | no |
| Edit — originally persisted `entity_id` is null | `legacy-optional` | yes |
| Edit — originally persisted `entity_id` exists | `required` | no |

Inputs: `isEditMode`, `originalEntityId` (scoped to the loaded review id), `isFromEntityPage`. Clearing the subject never converts a linked review into `legacy-optional`; selecting one never converts a legacy review into `required`.

## Not in scope

No `NOT NULL` on `reviews.entity_id`, no backfill (27 of 77 reviews are unlinked and must stay editable). No `UPDATE` guard. No component deletions and no questionnaire rework — Phase 2.5. No new provider relationships for `service`.

## Technical plan

1. **`src/components/profile/reviews/reviewSubjectPolicy.ts`** (new, pure)
   `subjectRequirement({ isEditMode, originalEntityId, isFromEntityPage })` → `'required' | 'legacy-optional' | 'locked'`, plus `allowsMissingSubject(requirement)`. No React, no network.

2. **Migration**
   - Add `service` to the standalone allow-list in `create_entity_subject` and remove the blanket `service` rejection, keeping every other guard (auth, bounds, API-pair rule, offering allow-list, advisory lock, empty-normalized-name rule) byte-for-byte intact. `service` remains parentless-only.
   - `BEFORE INSERT` trigger on `public.reviews`: reject when `entity_id IS NULL`, and reject when it references a missing or `is_deleted` entity. `INSERT` only.

3. **`SubjectSelectStep.tsx`**
   Replace `onSkip` with a `requirement` prop. The unlinked affordance renders only for `legacy-optional`, labelled "Continue without linking" with the explanatory line. For `required`, the create button is the only fallback and the empty-state copy points at it.

4. **`ReviewForm.tsx`**
   - Introduce `hasEntityContext = !!entity`; keep `isFromEntityPage` as-is.
   - Track `originalEntityId` keyed on the loaded review id.
   - Next gate and submit guard both call `allowsMissingSubject(requirement)`. Blocking submit returns to Step 2 with human copy: "Choose what you're reviewing before publishing."
   - Remove `handleSubjectSkip`; emit `review_subject_legacy_unlinked` only when a legacy edit saves still unlinked.

5. **Service-level guards**
   `createReview` in **both** `src/services/reviewService.ts` and `src/services/review/core.ts` throws on a missing/blank `entity_id`. `updateReview` untouched, so legacy rows stay editable.

6. **Telemetry**
   Add `review_subject_legacy_unlinked` and `review_subject_type_divergence` to `supabase/functions/log-search-funnel/allowlists.ts`. Keep `review_subject_skipped` accepted for older clients; the new UI stops emitting it. No query or review text.

7. **Step 3 derivation sweep**
   Confirm no `required` path reaches Step 3 with an empty `contentName` / `foodName`, across the questionnaire mappings covering all 15 canonical types. Where selection leaves the legacy field blank, derive it from the subject at selection time. **Venue stays editable** — `StepThree` applies `readOnly` to the name field only.

8. **Tests**
   Policy matrix (all four rows) and `allowsMissingSubject`, stale-`originalEntityId` regression (legacy review → linked review in one mounted instance), Next-gating, submit guard, both service guards, and a mapping sweep proving every canonical type yields a non-empty Step 3 title. Full suite green.

## Acceptance criteria

- No application path creates a new review with `entity_id = NULL`: audited — only `reviewService.ts` and `review/core.ts` insert into `reviews` (no RPC, edge function, or migration does) — both guarded, with the trigger as backstop.
- Every type offered by quick-create is accepted by the RPC (Service parity fixed).
- Legacy unlinked reviews remain editable and savable.

## Manual verification

1. New review from the profile: no Skip; Next disabled until a subject is picked.
2. Search something nonexistent → create it → auto-selects → Next enables.
3. Edit a legacy unlinked review → "Continue without linking" appears; saving unlinked works.
4. Edit a linked review → no unlinked option.
5. Open a legacy unlinked review, close, then open a linked review without reloading → the linked one is subject-required (stale-state check).
6. Review from an entity page → locked, unchanged.
7. **Brand → product:** create "Sony", then "WH-1000XM6" → review attaches to the **product**.
8. **Place → dish:** create "Truffles", then "Classic Burger" → venue context resolves → review attaches to the **food** entity.
9. **Standalone service:** pick Service, name it, create → no provider step, RPC accepts, review attaches to the new service entity.
10. Submitted rows all carry a non-null `entity_id`.

Stop for verification after 2.4; cleanup and questionnaire work land in 2.5.
