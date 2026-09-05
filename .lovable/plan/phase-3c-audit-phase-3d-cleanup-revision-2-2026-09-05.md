# Phase 3C audit + Phase 3D cleanup (revision 2)

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

Direct comparison, done now:

- `src/integrations/supabase/types.ts` contains `review_updates.would_recommend` (Row/Insert/Update) plus `delete_latest_review_update`, `lookup_latest_recommendation_intent`, `recompute_review_timeline_state`, `resolve_review_recommendation` and `review_timeline_lock_key`.
- Live `information_schema` for `public.review_updates` returns exactly nine columns — `id, review_id, user_id, rating, comment, created_at, updated_at, media, would_recommend` — matching the generated file.

Conclusion: the generated types are **current**; the unchecked roadmap item is stale bookkeeping, not outstanding work. Phase 3D corrects the checkbox and records this comparison as evidence. No regeneration needed.

### Bookkeeping defect

`roadmap.md` also contains a stale duplicate "Phase 3D — NOT STARTED" block listing two already-delivered Stage 3 items.

## Part 2 — Phase 3D plan

Cleanup only. No database migration, no user-visible behaviour change.

**Close-out invariant (new):** no review-authoring or questionnaire module may depend on a five-bucket type or mapping. Any surviving five-bucket logic must be explicitly documented as search/filter compatibility only.

### 3D.0 — reconcile bookkeeping

- Tick the generated-types item with the comparison above as its evidence.
- Delete the stale duplicate Phase 3D block.
- Add the reviewer-introduced tasks (repo-wide bucket audit, bucket module extraction, prefill removal, alias audit, explicit compatibility regressions) to `roadmap.md` under Phase 3D.

### 3D.1 — repo-wide five-bucket audit, every occurrence classified

Every remaining `food / movie / book / place / product` usage is classified REMOVE / KEEP / DEFER, and the table goes in the close-out. Current findings:

| Location | Classification | Reason |
| --- | --- | --- |
| `ReviewForm.tsx` `category` state + `LegacyReviewCategory` import | REMOVE | dead form-level questionnaire kind |
| `subjectSelection.ts` `resolveQuestionnaireKind` | REMOVE | only caller is the state above |
| `subjectSelection.ts` `LEGACY_REVIEW_CATEGORIES` + `isLegacyReviewCategory` | REMOVE | used only by `resolveQuestionnaireKind` |
| `subjectSelection.ts` `SubjectPrefill` / `deriveSubjectPrefill` / `SubjectLike` | REMOVE (3D.4) | obsolete adapter; `SubjectLike` has no other importer |
| `mapCanonicalToLegacyCategory` | KEEP, but MOVE (3D.2) | still the authoring source for the search/filter bucket projection |
| `supabase/functions/_shared/reviewCategoryBuckets.ts` | KEEP | intentional search/filter aggregation layer for edge functions |
| `discoveryService.ts:232`, `RecommendationForm.tsx`, `advancedPersonalizationService.ts:96` | DEFER | `recommendation_category` enum domain, not review taxonomy |
| `EntitySidebar.tsx:76` | DEFER | entity-page display heuristic, unrelated to the questionnaire |

### 3D.2 — isolate the retained bucket mapping in its own named module

- New module `src/services/reviewCategoryBuckets.ts`, documented at the top as **a search/filter projection over `reviews.category`, NOT the review taxonomy** — the canonical taxonomy is the 15 entity types plus the questionnaire registry.
- Move `mapCanonicalToLegacyCategory` and the `LegacyReviewCategory` / `ReviewBucket` type there; keep the exhaustive switch so a new canonical type stays a compile error.
- Repoint `reviewCategoryBucketParity.test.ts` and the Deno mirror's header comment at the new path; move the mapping unit tests out of `subjectSelection.test.ts`.
- Grep proof in the close-out that no `src/components/profile/reviews/**` module imports it.

### 3D.3 — remove the form's five-bucket state

Justification from this audit: `steps/StepThree.tsx` and `steps/StepFour.tsx` no longer reference `category`; the questionnaire comes from `resolveQuestionnaire`. The `category` state survives only as a fallback for a subject-less new review, which `subjectRequirement` already forbids (`required` for new profile/global reviews, `locked` from an entity page).

- Delete `category` / `setCategory`, its initialiser and all four assignments in `ReviewForm.tsx`.
- `persistedCategory` follows this frozen truth table — canonical authority is **not** limited to manually picked subjects, so a new review opened from an entity page keeps writing that entity's canonical type exactly as it does today:

| Case | Written to `reviews.category` |
| --- | --- |
| New review, subject picked in the form (`user-selected`) | canonical subject type |
| New review opened from an entity page (`entity-page`, locked/preselected) | canonical subject type — no re-selection required |
| New review with no valid subject | **block submission** with an explicit error; never invent `'food'` / `'product'` |
| Edit, subject deliberately changed or re-selected | canonical new subject type, and subject-specific questionnaire data is cleared |
| Edit, subject unchanged (`loaded`) | stored raw category preserved byte-identical |
| Edit, legacy-unlinked | stored raw category preserved byte-identical |

This is exactly today's `canonicalWins = subjectOrigin === 'user-selected' || (subjectOrigin === 'entity-page' && !isEditMode)` rule, written down so removing the fallback state cannot change it.
- Delete `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`, `isLegacyReviewCategory`.

### 3D.4 — remove the whole `SubjectPrefill` adapter, not just two fields

Codex is right, and I confirmed it by reading `handleSubjectChange`: `prefill.venue` is never read (venue snapshotting lives in `questionnaire/identityPersistence.ts` via `deriveVenueSnapshot`), `prefill.category` exists only to feed the state 3D.3 deletes, and `prefill.canonicalType` is just `parseEntityTypeAtBoundary(subject.type)`. Keeping `SubjectPrefill.category` would force a questionnaire-side module to import the bucket projection, violating the close-out invariant.

- Delete `SubjectPrefill`, `deriveSubjectPrefill` and the now-unused `SubjectLike` (no other importer).
- `handleSubjectChange` parses the subject type directly with the strict boundary parser and keeps the identical guard: an unparseable type shows the same "We can't use this one yet" toast and changes nothing — never coerced to `others` or `product`.
- With the mapping moved and the adapter gone, `subjectSelection.ts` is empty and is deleted; its test file is folded into the new bucket-module test plus the existing identity/venue tests.
- Keep `legacyTitle` / `legacyVenue` — the narrow, explicitly named legacy-unlinked editing adapter, still the only way historical unlinked rows stay maintainable.

### 3D.5 — versioning and forward compatibility: permanent, explicit keep

`QUESTIONNAIRE_VERSION = 1` and the strict numeric-version checks in `questionnaire/envelope.ts` and both resolvers are the frozen Stage 0 data contract and the forward-compatibility guarantee (unknown versions are never rendered and never destroyed). Nothing removed; the roadmap line is amended to read "permanent contract" instead of sitting as an open cleanup task.

### 3D.6 — `is_converted`: audit consumers, then record a deprecation note

Corrected reasoning: `recommendation_id` already proves conversion for the same rows, so `is_converted` is **not** unique provenance.

Data measured: 78 reviews; exactly **6** with `is_converted = true`; the same 6 are the only rows with a non-null `recommendation_id`; each has a matching recommendation row.

Consumer audit to complete before deciding, each result recorded in the close-out: database views, triggers/functions/RPCs, edge functions, client queries and filters, generated types, analytics/admin code. Current client-side finding: the only occurrence outside generated types is an unused field declaration in `src/services/reviewService.ts`.

If the audit confirms no live consumer, document it verbatim as: *deprecated historical compatibility column — do not read, do not write; retained only to avoid an unnecessary destructive migration.* If a live consumer turns up, I stop and report before changing anything.

- Remove the unused client `is_converted` field from the `Review` interface. `recommendation_id` stays (real FK).

### 3D.7 — explicit compatibility regression acceptance

Named acceptance tests, not assumed coverage:

1. Editing a legacy-unlinked review keeps title/venue editable and saves them.
2. Re-saving an untouched historical review does not rewrite `reviews.category`.
3. Stored-category / subject-type mismatch stays in compatibility mode — no envelope created or updated.
4. A new review with an unparseable linked subject is blocked, never coerced.
5. Questionnaire version handling: numeric `1` valid, string `"1"` absent, future version incompatible and preserved.
6. Unknown future answer keys and unknown tag ids survive a save byte-identical.
7. Replacing the subject with a different subject of the same type still resets subject-specific answers.
8. `resolveQuestionnaire` returns a registry config directly for all 15 canonical types.
9. Venue snapshot behaviour stays as tested in `identityPersistence` after the prefill adapter is gone (Google formatted address preferred; food venue comes from the provider lookup, never the dish name).
10. New review launched from an entity page with a locked subject saves successfully and writes the entity's canonical type — without the user re-selecting the subject.
11. A category/type-mismatch review that deliberately re-selects its subject leaves compatibility mode, re-canonicalizes `reviews.category` from the new subject, and clears the old subject-specific questionnaire data.
12. One case per row of the 3D.3 truth table: new user-selected, new entity-page, untouched linked edit, deliberately re-linked edit, legacy-unlinked edit, and invalid/subject-less new review.

### 3D.8 — stale alias and import audit

A final sweep proving no obsolete taxonomy name survives under a different label. Grep and classify exactly like 3D.1: `LegacyReviewCategory`, `questionnaireKind`, `resolveQuestionnaireKind`, `getReviewCategory`, `categoryFallback` / "category fallback", and any `'food' | 'movie' | 'book' | 'place' | 'product'` union. Occurrences are not deleted blindly — each is classified REMOVE / KEEP (documented as search/filter compatibility) / DEFER, and the close-out states the invariant is satisfied.

### Verification

- `bunx vitest run` — full suite green (612 baseline, adjusted for removed/added cases).
- `tsgo --noEmit`; production build green.
- Grep proof: no remaining `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`, `deriveSubjectPrefill`, `SubjectPrefill`, `foodName`, `contentName`, client `is_converted`; no review-authoring or questionnaire import of the bucket module.
- Read-through of create and edit save paths confirming `reviews.category` receives the same value it does today in every reachable case.
- Close-out `docs/verification/phase-3d-cleanup.md`: files changed, identifiers removed, the bucket classification table, the alias-audit table, the generated-types comparison, the `is_converted` consumer audit with query results, the invariant statement, and all test/build output.

### Out of scope

- No database migration, no column drops, no historical backfill.
- The two UNVERIFIED Stage 1 runtime checks stay unverified.
- Phase 2.5B stays separate; work stops after the Phase 3D close-out.
