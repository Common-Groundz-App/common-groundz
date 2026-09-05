# Phase 3C audit + Phase 3D cleanup

## Part 1 — Phase 3C audit result

Phase 3C is complete across all four stages. Checks run just now:

- Stage 0 (frozen spec), Stage 1 (database foundation), Stage 2 (questionnaire UI + persistence) and Stage 3 (timeline intent + Convert removal) are all ticked in `roadmap.md`, each with a committed evidence document under `docs/verification/`.
- Full test suite: **612/612 pass** (37 files).
- Latest build entry: **build OK**.
- No remaining `convertToRecommendation`, `convertReviewToRecommendation` or `onConvert` identifiers anywhere in the codebase.
- No `questionnaireKind` identifier remains (only the function name `resolveQuestionnaireKind`, which Phase 3D removes).

Three known items stay open and are **not** claimed as done:

1. Advisory-lock concurrency races (needs independent parallel database sessions) — UNVERIFIED.
2. Owner INSERT / owner undo / non-owner denial through a genuine authenticated Supabase session — UNVERIFIED (external Supabase project; no session can be minted here).
3. Supabase generated types were not regenerated after the Stage 1 migration.

One bookkeeping defect found: `roadmap.md` contains a stale duplicate "Phase 3D — NOT STARTED" section that lists two Stage 3 items ("Undo latest update", "Retire the Convert action") which are already delivered.

## Part 2 — Phase 3D plan

Scope is cleanup only. No database migration, no behaviour change that a user can see. Every removal below is justified by a read done during this audit.

### Step 1 — remove the five-bucket questionnaire kind from the review form

The questionnaire is now selected from the subject's canonical type (`resolveQuestionnaire` in `questionnaire/resolve.ts`), and `steps/StepThree.tsx` / `steps/StepFour.tsx` no longer reference `category` at all. The form's `category` state is therefore only a fallback for a *subject-less new review*, which `subjectRequirement` already forbids (`required` for new profile/global reviews, `locked` from an entity page).

- Delete the `category` / `setCategory` state, its initialiser and all four assignments in `ReviewForm.tsx`.
- `persistedCategory` becomes: the canonical type when the user deliberately chose the subject, otherwise the review's already-stored raw category, untouched. The unreachable third case must **block the save with an explicit error**, never invent `'food'` or `'product'`.
- Delete `resolveQuestionnaireKind` from `subjectSelection.ts` once its last caller is gone.

Keep `mapCanonicalToLegacyCategory` and `LEGACY_REVIEW_CATEGORIES`: `supabase/functions/_shared/reviewCategoryBuckets.ts` mirrors them for search/filter bucketing, and `reviewCategoryBucketParity.test.ts` enforces that mirror.

### Step 2 — remove `foodName` / `contentName`

`SubjectPrefill` still returns `foodName` and `contentName`, but the only consumer (`ReviewForm.tsx` line ~659) uses just `canonicalType`, `category` and `venue`; identity now comes from `resolveReviewIdentity`.

- Drop both fields from `SubjectPrefill` and from `deriveSubjectPrefill`'s three return paths.
- Update `__tests__/subjectSelection.test.ts` to assert the remaining contract (food keeps `venue` empty for the parent lookup; place prefers the Google formatted address).

### Step 3 — decide `reviews.is_converted` (audit outcome: keep the column, drop the client field)

Queried live data: 78 reviews, exactly **6** with `is_converted = true`, and the same 6 are the only rows with a non-null `recommendation_id`. All predate May 2025 and each has a matching recommendation row.

- **Keep both columns.** They are historical provenance for those 6 rows; dropping them destroys the only record that the conversion happened.
- **Remove `is_converted` from the client `Review` interface** in `src/services/reviewService.ts` — nothing reads it, and now that the Convert action is gone nothing writes it. `recommendation_id` stays on the interface (it is a real FK that other code may legitimately follow).
- Record the decision in `roadmap.md` so it is not revisited.

### Step 4 — versioning scaffolding: explicit keep decision

`QUESTIONNAIRE_VERSION = 1` and the strict numeric-version checks in `questionnaire/envelope.ts` and both resolvers are **not** scaffolding — they are the frozen Stage 0 data contract and the forward-compatibility guarantee (unknown versions are never rendered and never destroyed). Nothing here is removed. The roadmap line is amended to say so rather than left as an open task.

### Step 5 — roadmap correction and close-out

- Delete the stale duplicate "Phase 3D — NOT STARTED" block.
- Mark Phase 3D items delivered, with the two keep-decisions recorded.
- Keep the three open Stage 1 / types items exactly as they are — they are not part of Phase 3D and stay UNVERIFIED.
- Write `docs/verification/phase-3d-cleanup.md` with files changed, identifiers removed, the `is_converted` data query and its result, and test/build output.

### Verification

- `bunx vitest run` — full suite must stay green (612 baseline, minus any test lines removed with the deleted fields).
- `tsgo --noEmit` — proves no dangling reference to the removed state or fields.
- Production build green.
- Grep proof that `resolveQuestionnaireKind`, `foodName`, `contentName` and the client `is_converted` field have no remaining call sites.
- Manual read-through of the create and edit save paths confirming `reviews.category` receives the same value it does today in all three reachable cases.

### Out of scope

- No database migration; no column drops.
- The two UNVERIFIED Stage 1 items stay unverified — they need parallel sessions and a real authenticated session, neither obtainable here.
- Regenerating `src/integrations/supabase/types.ts` remains a separate carry-over.
