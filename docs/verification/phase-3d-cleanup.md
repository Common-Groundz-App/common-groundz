# Phase 3D — cleanup close-out

Cleanup only. No database migration, no column drops, no historical backfill, no
user-visible behaviour change.

**Close-out invariant:** no review-authoring or questionnaire module depends on a
five-bucket type or mapping. Every surviving five-bucket occurrence is documented
as search/filter compatibility only. Verified by grep below.

## 3D.0 Generated Supabase types — reconciled

The roadmap carried "Regenerate Supabase types" as open while Stage 1 reports said
the types already contained the new schema. The checked-in file was inspected
against the live schema:

| Schema object | Present in `src/integrations/supabase/types.ts` |
| --- | --- |
| `review_updates.would_recommend` | yes |
| `delete_latest_review_update` | yes |
| `recompute_review_timeline_state` | yes |
| `resolve_review_recommendation` | yes |
| `lookup_latest_recommendation_intent` | yes |

Conclusion: the generated file is current; the unchecked roadmap item was stale
bookkeeping. No regeneration required. Roadmap item ticked with this evidence.

Also removed: a duplicated stale "Phase 3D — NOT STARTED" roadmap block that
listed work already delivered in Stage 3.

## 3D.1 Five-bucket audit

| Occurrence | Classification | Reason |
| --- | --- | --- |
| `ReviewForm.tsx` — `category` / `setCategory` state, `LegacyReviewCategory` import | REMOVE | Dead: steps read the questionnaire registry; the state survived only as a fallback that `subjectRequirement` already forbids |
| `subjectSelection.ts` — `resolveQuestionnaireKind` | REMOVE | Superseded by `resolveQuestionnaire` (registry-driven) |
| `subjectSelection.ts` — `LEGACY_REVIEW_CATEGORIES`, `isLegacyReviewCategory` | REMOVE | Only consumer was `resolveQuestionnaireKind` |
| `subjectSelection.ts` — `SubjectPrefill`, `deriveSubjectPrefill`, `SubjectLike` | REMOVE | See 3D.4 |
| `mapCanonicalToLegacyCategory` | KEEP, MOVED | Still needed by search/filter bucketing; relocated and documented (3D.2) |
| `supabase/functions/_shared/reviewCategoryBuckets.ts` | KEEP | Edge-function search/filter aggregation; parity-tested mirror |
| `src/utils/fallbackImageUtils.ts` — `getCategoryFallbackImage` | KEEP | Image fallback by category string, not review taxonomy |
| `supabase/functions/smart-assistant/index.ts` — "Category fallback" search log | KEEP | Semantic-search fallback path |
| `discoveryService.ts:232`, `RecommendationForm.tsx` (`CategoryString`), `advancedPersonalizationService.ts:96` | DEFER | These are the `recommendation_category` **enum domain**, a separate DB type — not review taxonomy |
| `EntitySidebar.tsx:76` | DEFER | Entity-page display heuristic, outside review authoring |

## 3D.2 Bucket projection isolated

New module `src/services/reviewCategoryBuckets.ts` holds `ReviewBucket` and
`mapCanonicalToLegacyCategory`, with a header stating explicitly that it is a
search/filter projection over `reviews.category` and **not** the review taxonomy
(canonical = 15 entity types + questionnaire registry). The exhaustive `switch`
is preserved, so a new canonical type is a compile error rather than a silent
`product`.

- `reviewCategoryBucketParity.test.ts` repointed at the new path (6 tests pass).
- Mapping unit tests moved to `src/services/__tests__/reviewCategoryBuckets.test.ts`.
- The unused `LegacyReviewCategory` alias was deleted rather than kept as a
  deprecated name that could be mistaken for the taxonomy.

Grep proof — no review-authoring or questionnaire module imports it:

```
$ grep -rn "reviewCategoryBuckets" src --include=*.ts --include=*.tsx | grep -v __tests__
src/services/reviewCategoryBuckets.ts:8: * Deno mirror at `supabase/functions/_shared/reviewCategoryBuckets.ts` — can
```

(The only match is the module's own comment. No `src/components/profile/reviews/**` importer.)

## 3D.3 Form five-bucket state removed; `reviews.category` truth table frozen

`category` / `setCategory`, its initialiser and all assignments are gone from
`ReviewForm.tsx`. The persistence rule was extracted verbatim into
`src/components/profile/reviews/categoryPersistence.ts`
(`canonicalCategoryWins`, `resolvePersistedCategory`) so it is unit-tested rather
than implied, and behaves identically to the previous inline expression:

| Case | Written to `reviews.category` |
| --- | --- |
| New review, subject picked in the form (`user-selected`) | canonical subject type |
| New review opened from an entity page (`entity-page`, locked/preselected) | canonical subject type — no re-selection required |
| New review with no valid subject | `null` ⇒ **submission blocked**; never `'food'` / `'product'` |
| Edit, subject deliberately re-selected | canonical new subject type (subject-specific answers cleared) |
| Edit, subject unchanged (`loaded`) | stored raw category, byte-identical |
| Edit, legacy-unlinked | stored raw category, byte-identical |

Removed with it: `resolveQuestionnaireKind`, `LEGACY_REVIEW_CATEGORIES`,
`isLegacyReviewCategory`.

## 3D.4 `SubjectPrefill` adapter removed entirely

Read-through of `handleSubjectChange` confirmed: `prefill.venue` was never read
(venue snapshotting lives in `questionnaire/identityPersistence.ts` via
`deriveVenueSnapshot`), `prefill.category` fed only the state deleted in 3D.3, and
`prefill.canonicalType` was just `parseEntityTypeAtBoundary(subject.type)`.
Keeping `SubjectPrefill.category` would have forced a questionnaire-side module to
import the bucket projection, violating the close-out invariant.

`handleSubjectChange` now parses the subject type directly with the strict boundary
parser and keeps the identical guard: an unparseable type shows the same
"we can't use this one yet" message and changes nothing — never coerced to `others`
or `product`. With the mapping moved and the adapter gone, `subjectSelection.ts` was
empty and was deleted; its tests were folded into the bucket-module test and the
Phase 3D compatibility test.

Kept: `legacyTitle` / `legacyVenue` — the narrow, explicitly named legacy-unlinked
editing adapter, still the only way historical unlinked rows stay maintainable.

## 3D.5 Questionnaire versioning — permanent contract

`QUESTIONNAIRE_VERSION = 1` and the strict numeric-version checks in
`questionnaire/envelope.ts` and both resolvers are the frozen Stage 0 data contract
and the forward-compatibility guarantee: unknown versions are never rendered and
never destroyed. Nothing removed. The roadmap line now reads "permanent contract"
instead of sitting as an open cleanup task.

## 3D.6 `reviews.is_converted` — audited, deprecated, retained

Corrected reasoning: `recommendation_id` already proves conversion for the same
rows, so `is_converted` is **not** unique provenance.

Data measured: 78 reviews; exactly 6 with `is_converted = true`; the same 6 rows
are the only ones with a non-null `recommendation_id`; each has a matching
recommendation row.

Consumer audit:

| Consumer surface | Result |
| --- | --- |
| Database views (`information_schema.views` definition search) | none |
| Functions / triggers / RPCs (`pg_get_functiondef` search) | none |
| Edge functions (`grep supabase/`) | none |
| Client queries and filters (`grep src/`) | none |
| Generated types | present (schema reflection only) |
| Analytics / admin code | none |

Only occurrence in application code was an unused field declaration on the `Review`
interface in `src/services/reviewService.ts`. Decision recorded verbatim in that
file and here:

> `reviews.is_converted` is a deprecated historical compatibility column — do not
> read, do not write. It is retained only to avoid an unnecessary destructive
> migration; conversion is already proven by `recommendation_id`.

The unused client field was removed. `recommendation_id` stays (real FK).

## 3D.7 Compatibility regression acceptance

`src/components/profile/reviews/__tests__/phase3dCompatibility.test.ts` — 19 named
acceptance cases, not assumed coverage:

- all six `reviews.category` truth-table rows, including "no valid subject ⇒ null,
  never a bucket" and "entity-page origin cannot rewrite an existing row";
- legacy-unlinked title/venue editing (`source: 'legacy-editable'`) and
  `subjectRequirement` returning `legacy-optional` so unlinked rows re-save;
- stored-category / subject-type mismatch stays in compatibility mode
  (`isQuestionnaireWritable` false) and exits on deliberate re-selection;
- a new review with an unparseable linked subject is blocked, never coerced;
- `resolveQuestionnaire` returns a registry config directly for all 15 canonical types;
- questionnaire versions: numeric `1` valid, string `"1"` incompatible (never v1),
  future version incompatible and preserved;
- venue snapshot behaviour after the prefill removal: Google formatted address
  preferred for places, food venue from the provider lookup and never the dish name,
  stored identity preserved on a plain re-save.

## 3D.8 Stale alias and import audit

```
$ grep -rn "subjectSelection|resolveQuestionnaireKind|LEGACY_REVIEW_CATEGORIES|deriveSubjectPrefill|SubjectPrefill|foodName|contentName" src supabase
(only two documentation comments in the new/renamed test files)

$ grep -rn "LegacyReviewCategory" src supabase
(no matches)

$ grep -rn "'food' | 'movie'" src supabase
src/components/recommendations/RecommendationForm.tsx:20 — DEFER (recommendation_category enum)
src/services/reviewCategoryBuckets.ts:20 — KEEP (documented search/filter projection)
```

No remaining client `is_converted`. Invariant satisfied.

## Verification results

| Check | Result |
| --- | --- |
| `bunx vitest run --project node` | 32 files, **589 tests pass** |
| `bunx vitest run --project dom` | 6 files, **38 tests pass** |
| `bunx tsgo --noEmit` | clean, no output |
| Production build | green (build log clean after the final edits) |
| Grep audits (3D.2, 3D.8) | as quoted above |
| Save-path read-through | `reviews.category` receives the same value in every reachable case (3D.3 table) |

Test-count note: the previous 612 figure included `subjectSelection.test.ts`
(deleted) and the pre-move mapping cases; those cases now live in
`reviewCategoryBuckets.test.ts` and `phase3dCompatibility.test.ts`.

## Still UNVERIFIED (Phase 3C carry-over — not substituted)

Phase 3C is complete **to the explicitly accepted verification level**, not
unconditionally verified. These two runtime checks remain open and were accepted
as risk:

- **UNVERIFIED** — Stage 1 advisory-lock concurrency races (insert vs undo, undo vs
  undo, maintenance vs undo, two different reviews): requires independent parallel
  authenticated sessions.
- **UNVERIFIED** — authenticated owner INSERT / owner undo / non-owner INSERT denial
  through a real Supabase session with `auth.uid()` present, i.e. the
  browser → supabase-js → RLS hop. This is an external Supabase project, so no test
  session can be minted in this environment.

## Out of scope / not started

- No database migration, no column drops, no historical backfill.
- Phase 2.5B (wizard consolidation) remains deferred and was **not started**.

---

## Close-out gap closures (second pass)

Two leftovers were found by a re-audit and closed without weakening any
invariant.

### 1. Parity test moved out of the review-authoring tree

`src/components/profile/reviews/__tests__/reviewCategoryBucketParity.test.ts`
imported the five-bucket compatibility module, which contradicted the 3D.2
invariant. All six parity cases were merged verbatim into
`src/services/__tests__/reviewCategoryBuckets.test.ts` and the old file deleted;
`vitest.config.ts` updated accordingly. The invariant was kept as written.

```
$ rg -ln "reviewCategoryBuckets" src/components/profile/reviews
NONE
```

Remaining references are the service module itself, its service-level test, the
Deno mirror `supabase/functions/_shared/reviewCategoryBuckets.ts` and its two
edge-function consumers (search/filter compatibility layer) — no review-authoring
or questionnaire production module.

### 2. Same-type subject replacement — real reset behaviour tested

Acceptance case 7 is proven at two levels, not by an id-comparison helper.

- **Persistence layer** — `phase3dCompatibility.test.ts`:
  `buildReviewMetadataForSave` with `questionnaireReset: true` removes the
  questionnaire envelope and empties `food_tags`, while unrelated stored
  metadata (`provenance`) survives byte-identical. The mirror case (subject
  unchanged) leaves the envelope and tags exactly as stored.
- **Behaviour layer** — `src/components/profile/reviews/__tests__/ReviewFormSubjectReset.test.tsx`
  drives the real `ReviewForm` (SubjectSelectStep → `handleSubjectChange` →
  `resetQuestionnaireAnswers`) and reads the live answers where they render, in
  Step Four:
  - product → a *different* product id clears choice and curated answers;
  - product → the *identical* id clears nothing;
  - food → a *different* food id clears choices **and** `food_tags`;
  - food → the *identical* id keeps both.

### Two production defects surfaced by the behaviour test

- `ReviewForm` populated `selectedEntity` in an effect that also depended on
  `selectedEntity`; each run allocated a fresh object, so the effect re-triggered
  itself without bound (an unbounded render loop in the edit modal). Fixed with a
  functional update and a narrowed dependency list.
- Editing a linked review never hydrated the Step 2 subject from the stored
  link, so the subject picker opened empty and "Next" stayed disabled until the
  user re-picked the subject — which then cleared their answers. The stored
  subject is now hydrated on load.

A pre-existing typecheck error in `src/services/review/timeline.ts` (the
`review_updates` insert object did not match the generated Insert row) was also
fixed: `rating` is omitted rather than sent as `null`, and `media` is typed as
`Json`.

### Verification (second pass)

| Check | Result |
| --- | --- |
| Focused: `reviewCategoryBuckets`, `phase3dCompatibility`, `ReviewFormSubjectReset` | pass |
| Full Vitest suite | 38 files, **633 tests pass** |
| `tsgo --noEmit` | clean |
| Production build | green (`vite build`, exit 0) |
| Grep audit (3D.2) | 0 hits under `src/components/profile/reviews` |

Phase 3D is complete. Phase 2.5B was **not** started.
