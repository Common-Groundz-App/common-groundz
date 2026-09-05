# Phase 3C audit + Phase 3D cleanup (revised after review)

## Part 1 — Phase 3C audit result

Phase 3C is **complete to the explicitly accepted verification level**, with two runtime checks still open. It is not claimed as unconditionally fully verified.

Checks run during this audit:

- Stages 0–3 are all ticked in `roadmap.md`, each with committed evidence under `docs/verification/`.
- Full test suite: **612/612 pass** (37 files). Latest build entry: **build OK**.
- No `convertToRecommendation`, `convertReviewToRecommendation` or `onConvert` identifiers remain anywhere.

Still UNVERIFIED (accepted risk, does not block Phase 3D):

1. Advisory-lock concurrency races — needs independent parallel database sessions.
2. Owner INSERT / owner undo / non-owner denial through a genuine authenticated Supabase session — external Supabase project, no session can be minted here.

### Generated-types discrepancy — resolved

The reviewers were right to challenge this. Direct comparison, done now:

- `src/integrations/supabase/types.ts` contains `review_updates.would_recommend` (Row/Insert/Update) plus `delete_latest_review_update`, `lookup_latest_recommendation_intent`, `recompute_review_timeline_state`, `resolve_review_recommendation` and `review_timeline_lock_key`.
- Live `information_schema` for `public.review_updates` returns exactly nine columns — `id, review_id, user_id, rating, comment, created_at, updated_at, media, would_recommend` — matching the generated file.

Conclusion: the generated types are **current**; the unchecked roadmap item is stale bookkeeping, not outstanding work. Phase 3D corrects the checkbox and records the comparison as evidence. No regeneration is needed.

### Bookkeeping defect

`roadmap.md` also contains a stale duplicate "Phase 3D — NOT STARTED" block listing two already-delivered Stage 3 items.

## Part 2 — Phase 3D plan

Cleanup only. No database migration, no user-visible behaviour change.

### 3D.0 — reconcile bookkeeping

- Tick the generated-types item with the comparison above as its evidence.
- Delete the stale duplicate Phase 3D block.
- Add the reviewer-introduced tasks (repo-wide bucket audit, bucket module extraction, explicit compatibility regressions) to `roadmap.md` under Phase 3D.

### 3D.1 — repo-wide five-bucket audit, every occurrence classified

Every remaining `food / movie / book / place / product` bucket usage is classified as REMOVE, KEEP or DEFER, and the table goes in the close-out document. Current findings:

| Location | Classification | Reason |
| --- | --- | --- |
| `ReviewForm.tsx` `category` state + `LegacyReviewCategory` import | REMOVE | dead form-level questionnaire kind |
| `subjectSelection.ts` `resolveQuestionnaireKind` | REMOVE | only caller is the state above |
| `subjectSelection.ts` `LEGACY_REVIEW_CATEGORIES` + `isLegacyReviewCategory` | REMOVE from this module | used only by `resolveQuestionnaireKind` |
| `subjectSelection.ts` `mapCanonicalToLegacyCategory` / `LegacyReviewCategory` type | KEEP, but MOVE (3D.2) | still the authoring source for the search/filter bucket projection |
| `supabase/functions/_shared/reviewCategoryBuckets.ts` | KEEP | intentional search/filter aggregation layer for edge functions |
| `discoveryService.ts:232`, `RecommendationForm.tsx`, `advancedPersonalizationService.ts:96` | DEFER | these are the `recommendation_category` enum domain, not review taxonomy |
| `EntitySidebar.tsx:76` | DEFER | entity-page display heuristic, unrelated to the review questionnaire |

### 3D.2 — isolate the retained bucket mapping in its own named module

The mapping no longer belongs in subject selection once subject selection stops using it.

- New module `src/services/reviewCategoryBuckets.ts` (frontend authoring side), documented at the top as **a search/filter projection over `reviews.category`, NOT the review taxonomy** — the canonical taxonomy is the 15 entity types plus the questionnaire registry.
- Move `mapCanonicalToLegacyCategory` and the `LegacyReviewCategory`/`ReviewBucket` type there; keep the exhaustive switch so a new canonical type stays a compile error.
- Repoint `reviewCategoryBucketParity.test.ts` and the Deno mirror's header comment at the new path.
- Assert no questionnaire or review-form module imports it (grep proof in the close-out).

### 3D.3 — remove the form's five-bucket state

Justification from this audit: `steps/StepThree.tsx` and `steps/StepFour.tsx` no longer reference `category` at all; the questionnaire comes from `resolveQuestionnaire`. The `category` state survives only as a fallback for a subject-less new review, which `subjectRequirement` already forbids (`required` for new profile/global reviews, `locked` from an entity page).

- Delete `category` / `setCategory`, its initialiser and all four assignments in `ReviewForm.tsx`.
- `persistedCategory` becomes: the canonical type when the user deliberately chose the subject, otherwise the review's already-stored raw category, untouched. The remaining unreachable case must **block the save with an explicit error** — never invent `'food'` or `'product'`.
- Delete `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES` and `isLegacyReviewCategory`.

### 3D.4 — remove `foodName` / `contentName`, keep the legacy-unlinked adapter

The only consumer of `deriveSubjectPrefill` uses `canonicalType`, `category` and `venue`; identity comes from `resolveReviewIdentity`.

- Drop both fields from `SubjectPrefill` and its three return paths; update `subjectSelection.test.ts`.
- Keep `legacyTitle` / `legacyVenue` — they are the narrow, explicitly named legacy-unlinked editing adapter, still the only way historical unlinked rows stay maintainable.

### 3D.5 — versioning and forward compatibility: permanent, explicit keep

`QUESTIONNAIRE_VERSION = 1` and the strict numeric-version checks in `questionnaire/envelope.ts` and both resolvers are the frozen Stage 0 data contract and the forward-compatibility guarantee (unknown versions are never rendered and never destroyed). Nothing removed; the roadmap line is amended to say "permanent contract" instead of sitting as an open cleanup task.

### 3D.6 — `is_converted`: audit consumers, then record an accurate rationale

Corrected reasoning — `recommendation_id` already proves conversion for the same rows, so `is_converted` is **not** the only provenance record.

Data measured: 78 reviews; exactly **6** with `is_converted = true`; the same 6 are the only rows with a non-null `recommendation_id`; each has a matching recommendation row.

Consumer audit to complete before deciding (each result recorded in the close-out): database views, triggers/functions/RPCs, edge functions, client queries and filters, generated types, analytics/admin code. Current client-side finding: the only occurrence outside generated types is an unused field declaration in `src/services/reviewService.ts`.

Expected decision, to be confirmed by that audit and recorded verbatim: *`is_converted` is redundant historical state, retained because six legacy rows use it and a destructive migration buys nothing; application code neither reads nor writes it.* If the audit finds a live consumer, the plan changes and I report before touching anything.

- Remove the unused client `is_converted` field from the `Review` interface. `recommendation_id` stays (real FK).

### 3D.7 — explicit compatibility regression acceptance

Because 3D removes substantial compatibility state, these become named acceptance tests rather than assumed coverage:

1. Editing a legacy-unlinked review keeps title/venue editable and saves them.
2. Re-saving an untouched historical review does not rewrite `reviews.category`.
3. Stored-category / subject-type mismatch stays in compatibility mode — no envelope created or updated.
4. A new review with an unparseable linked subject is blocked, never coerced.
5. Questionnaire version handling: numeric `1` valid, string `"1"` absent, future version incompatible and preserved.
6. Unknown future answer keys and unknown tag ids survive a save byte-identical.
7. Replacing the subject with a different subject of the same type still resets subject-specific answers.
8. `resolveQuestionnaire` returns a registry config directly for all 15 canonical types.

### Verification

- `bunx vitest run` — full suite green (612 baseline, adjusted for removed/added cases).
- `tsgo --noEmit`; production build green.
- Grep proof: no remaining `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`, `foodName`, `contentName`, client `is_converted`; no questionnaire/review-form import of the bucket module.
- Read-through of create and edit save paths confirming `reviews.category` receives the same value it does today in every reachable case.
- Close-out `docs/verification/phase-3d-cleanup.md`: files changed, identifiers removed, the full bucket classification table, the generated-types comparison, the `is_converted` consumer audit and query results, and all test/build output.

### Out of scope

- No database migration, no column drops, no historical backfill.
- The two UNVERIFIED Stage 1 runtime checks stay unverified.
- Phase 2.5B stays separate; work stops after the Phase 3D close-out.
