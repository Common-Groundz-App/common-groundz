# Phase 2.4 — Every new review has a real subject (final)

Phase 2.3 is verified complete. This revision folds in all three review rounds.

## The type-consistency correction — accepted, my objection was wrong

I declined `reviews.category = entity.type` enforcement on the strength of 17 mismatched live rows. That reasoning doesn't hold, for exactly the reason both reviewers gave, and I confirmed it in the code:

`ReviewForm.tsx` (lines 663-668) already implements the Phase 2.1 contract:

```ts
const canonicalWins =
  subjectOrigin === 'user-selected' || (subjectOrigin === 'entity-page' && !isEditMode);
const persistedCategory = canonicalWins && canonicalCategory ? canonicalCategory : /* legacy */;
```

So a deliberately chosen subject already persists the **canonical entity type**, while `questionnaireKind` keeps using the legacy 5-bucket mapping for the Step 3/4 UI. A Course review persists `category = 'course'` and renders product-shaped questions. The 17 old rows (`food` on a `place`, `product` on a `brand`) are pre-Phase-2.1 data that a `BEFORE INSERT`-only trigger never touches, and no backfill runs. Enforcing consistency on new inserts is therefore safe and is the point of Phase 2.1.

**Revised:** the trigger and the service boundary enforce `reviews.category = referenced entity.type` on **INSERT only**. `review_subject_type_divergence` telemetry stays, but as a regression signal — divergence on a new review is a bug, not accepted behaviour.

## Other corrections accepted

- **Trigger hardening.** The trigger function queries `public.entities`, so it is `SECURITY DEFINER`, owned by `postgres`, with a pinned `search_path`, matching the discipline of `create_entity_subject`. It must be tested through a normal authenticated insert, not just service-role SQL, so an RLS-invisible row can never cause a false rejection. The existing FK stays; the trigger adds the null rule, the not-soft-deleted rule, and the type-consistency rule.
- **Service copy.** A `service` entity is the service itself — "Haircut", "AC repair", "Screen replacement", "Home deep cleaning" — not the provider (a salon is a `place`, a plumber is a `professional`). Quick-create placeholder and helper copy use service examples so the distinction is right before provider relationships arrive later.
- **Category assertions in the manual checks**, not just "the RPC accepts it".

## Confirmed earlier corrections

- **Service parity.** The live `create_entity_subject` explicitly raises `service subjects cannot be created here` and omits `service` from its standalone list, while `SubjectQuickCreate` offers all 15 types. Decision: allow **parentless** `service` in the RPC. No `place → service` or `professional → service` relationship is added.
- **One invariant.** `allowsMissingSubject(requirement)` is true only for `legacy-optional`; `required` and `locked` both demand an entity id. Shared by the Next gate and the submit guard.
- **`originalEntityId` scoped to the loaded review id**, so a mounted form can't carry a previous review's legacy status.
- **Copy: "Continue without linking"** — "You can keep this older review unlinked and continue editing it."
- **`isFromEntityPage` is `!!entity && !isEditMode`**, so "edit from an entity page" isn't detectable today and isn't invented here. `hasEntityContext = !!entity` is introduced for clarity; edits are governed purely by `originalEntityId`.
- **Cleanup deferred to 2.5** — `CategorySelector.tsx` and `steps/StepTwo.tsx` stay untouched.

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

No `NOT NULL` on `reviews.entity_id`, no backfill (27 of 77 reviews are unlinked and stay editable). No `UPDATE` guards at all. No component deletions, no questionnaire rework, no new provider relationships for `service`.

## Technical plan

1. **`src/components/profile/reviews/reviewSubjectPolicy.ts`** (new, pure)
   `subjectRequirement({ isEditMode, originalEntityId, isFromEntityPage })` → `'required' | 'legacy-optional' | 'locked'`, plus `allowsMissingSubject(requirement)`. No React, no network.

2. **Migration**
   - `create_entity_subject`: add `service` to the standalone allow-list and drop the blanket `service` rejection, keeping every other guard byte-for-byte (auth, bounds, API-pair rule, offering allow-list, advisory lock, empty-normalized-name rule). `service` stays parentless-only.
   - `BEFORE INSERT` trigger on `public.reviews` — `SECURITY DEFINER`, owner `postgres`, pinned `search_path` — rejecting: `entity_id IS NULL`; a missing or `is_deleted` subject; and `category <> entity.type`. Clear, human-readable exception messages. `INSERT` only.

3. **`SubjectSelectStep.tsx`**
   Replace `onSkip` with a `requirement` prop. The unlinked affordance renders only for `legacy-optional`, labelled "Continue without linking" with the explanatory line. For `required`, the create button is the only fallback and the empty-state copy points at it.

4. **`ReviewForm.tsx`**
   - Introduce `hasEntityContext = !!entity`; leave `isFromEntityPage` as-is.
   - Track `originalEntityId` keyed on the loaded review id.
   - Next gate and submit guard both call `allowsMissingSubject(requirement)`. Blocked submit returns to Step 2: "Choose what you're reviewing before publishing."
   - Remove `handleSubjectSkip`; emit `review_subject_legacy_unlinked` only when a legacy edit saves still unlinked, and `review_subject_type_divergence` if a new linked review's category ever differs from its subject type.

5. **Service-level guards**
   `createReview` in **both** `src/services/reviewService.ts` and `src/services/review/core.ts`: throw on a missing/blank `entity_id`, and throw when `category` doesn't match the referenced entity's canonical type. `updateReview` untouched.

6. **Quick-create service copy**
   Service placeholder/example text describes the service itself ("e.g. Haircut, AC repair"), never the provider.

7. **Telemetry**
   Add `review_subject_legacy_unlinked` and `review_subject_type_divergence` to `supabase/functions/log-search-funnel/allowlists.ts`. Keep `review_subject_skipped` accepted for older clients; the new UI stops emitting it. No query or review text.

8. **Step 3 derivation sweep**
   Confirm no `required` path reaches Step 3 with an empty `contentName` / `foodName`, across the mappings covering all 15 canonical types; derive from the subject where blank. **Venue stays editable** — `StepThree` applies `readOnly` to the name field only.

9. **Tests**
   - Policy matrix (all four rows) and `allowsMissingSubject`.
   - Stale-`originalEntityId` regression: legacy unlinked review → linked review in one mounted instance.
   - Next gating, submit guard, both service guards (null entity **and** category mismatch).
   - **15-type canonical-category test:** for every canonical type, a new review persists `category === subject.type` while `questionnaireKind` may still be the legacy bucket.
   - Step 3 title derivation for all 15 types. Full suite green.

## Acceptance criteria

- No application path creates a new review with `entity_id = NULL`: only `reviewService.ts` and `review/core.ts` insert into `reviews` (no RPC, edge function, or migration does) — both guarded, trigger as backstop.
- Every new linked review satisfies `category = subject.type`; divergence is a bug.
- Every type quick-create offers is accepted by the RPC (Service parity fixed).
- Legacy unlinked rows remain editable and savable, unchanged.
- The trigger accepts a normal authenticated insert of a valid subject (RLS-safe), verified through the app path.

## Manual verification

1. New review from the profile: no Skip; Next disabled until a subject is picked.
2. Search something nonexistent → create it → auto-selects → Next enables.
3. Edit a legacy unlinked review → "Continue without linking" appears; saving unlinked works.
4. Edit a linked review → no unlinked option.
5. Open a legacy unlinked review, close, open a linked review without reloading → subject-required (stale-state check).
6. Review from an entity page → locked, unchanged.
7. **Brand → product:** "Sony" then "WH-1000XM6" → `entity_id` = the product, `category = 'product'`.
8. **Place → dish:** "Truffles" then "Classic Burger" → venue context resolves → `entity_id` = the food entity, `category = 'food'`.
9. **Standalone service:** create "Haircut" → no provider step, `parent_id = NULL`, `type = 'service'`, review saves with `category = 'service'`.
10. **Course:** select a course subject → product-shaped Step 3, saved `category = 'course'`.
11. All submitted rows carry a non-null `entity_id`.

Stop for verification after 2.4; cleanup and questionnaire work land in 2.5.
