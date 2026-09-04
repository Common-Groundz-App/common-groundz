# Stage 1 close-out (delivered and reviewed first), then Stage 2 — questionnaire UI + persistence

**Execution order is a hard boundary.** Step 0 is delivered on its own, reported, and stops for your review. Stage 2 Steps 1–4 begin only after you approve that report. If any required Stage 1 check cannot actually be executed, Stage 2 does not start — the report says so and waits for your decision.


## Is Stage 1 complete?

Mostly, but not fully. Verified now against the live database and the repo:

Done and evidenced (`docs/verification/phase-3c-stage1-selftest.md`, 41 PASS / 0 FAIL):
- `review_updates.would_recommend` column, check constraint and partial index exist, and are present in the regenerated `src/integrations/supabase/types.ts`.
- Single owner-scoped INSERT policy; `UPDATE`/`DELETE`/`TRUNCATE` revoked from `PUBLIC`, `anon`, `authenticated` and `service_role`.
- Server-owned chronology, shared lock-key helper, consolidated recompute, LIFO undo RPC, `service_role` maintenance RPC, all functions `OWNER TO postgres` with hardened execute grants.
- SQL resolver truth table (17 cases), tie-break, recompute, recursion and authorization checks.

Open items (must not be reported as passing):
1. **No TypeScript resolver exists.** Stage 1 required a pure resolver plus review-aware wrapper in *both* SQL and TypeScript, driven by one shared fixture. Nothing in `src/` references `timeline_explicit` / `rating_inferred`, so SQL/TS drift is currently unguarded.
2. **Advisory-lock concurrency is UNVERIFIED** — it needs independent parallel sessions, not the single-session harness.
3. **Real role-session privilege denial** was inferred from grants, not attempted from actual `anon` / `authenticated` / `service_role` sessions.
4. `roadmap.md` Stage 1 checkboxes are still unticked.

So Stage 1 is closed out and reported first; Stage 2 is a separate delivery.

---

## Step 0 — Stage 1 close-out (standalone delivery, stop for review)

- `src/services/review/recommendationResolver.ts`, mirroring the SQL decision function exactly:

  - `lookupLatestRecommendationIntent(updates)` — **ordering only**, `created_at DESC, id DESC`, returns the newest event whose `would_recommend` is non-null (or `null`).
  - `resolveReviewRecommendation(envelope, category, latestTimelineIntent, effectiveRating)` → `{ intent, isRecommended, source }`, `source` in `timeline_explicit | review_explicit | rating_inferred`. Precedence: timeline intent → envelope answer → rating. Strict envelope validation (version exactly `1`, `type` strictly equal to the review's canonical category, `answers` a plain object, `would_recommend` exactly `yes|maybe|no`); malformed/unsupported = **absent**, never `false`; `maybe` → `false`; a latest `auto` resolves to `intent: null, source: rating_inferred`. Rating inference uses the same effective rating the SQL side uses (`COALESCE(latest_rating, rating) >= 4`, null → false) — the threshold and null handling are asserted, not assumed.
- **Literal single fixture, no duplication:** `src/services/review/__fixtures__/recommendationTruthTable.json` is the one machine-readable source. Vitest imports it directly; the SQL/Deno harness reads the same file and feeds each case to the SQL resolver, comparing against the same expected values. No hand-copied `VALUES` list anywhere. A case count assertion on both sides makes a silently-skipped file a failure.
- Concurrency: run the four documented races (insert vs undo, undo vs undo, maintenance vs undo, two different reviews) from parallel independent sessions and record results. If parallel sessions cannot be established, it stays explicitly UNVERIFIED — not quietly passed.
- Role-session verification from **real sessions**, not from grants: `anon` and `authenticated` direct `UPDATE`/`DELETE`/`TRUNCATE` denied; `service_role` direct `UPDATE`/`DELETE` **denied** while `service_role` executing the maintenance RPC **succeeds** (the Option A boundary claim is unproven without this pair).
- `roadmap.md` Stage 1 boxes are ticked **only** for items actually proven from real sessions; anything unexecutable stays unticked and is listed as UNVERIFIED in `docs/verification/phase-3c-stage1-selftest.md`.
- **Stop here.** Report Step 0 results — resolver + fixture parity output, concurrency results, the role-session matrix, and any UNVERIFIED item — and wait for approval before Step 1.



---

## Step 1 — registry data for all 15 types (frozen spec, verbatim)

Extend `questionnaire/registry.ts` — pure data only:
- New field kinds actually rendered this stage: `single-choice` (chips) and `tags`.
- New tag sets: `stood_out:<type>` and `best_for:<type>`, each entry `{ value, label, emoji, sentiment }`. Sentiment is registry metadata and is **never persisted**.
- Per-type field sets exactly as frozen: every type gets `would_recommend` + `stood_out` (except `food`, which has no generic `stood_out`), plus the per-type repeat-intent label and extra dimension from the frozen matrix (`portion`, `best_for`, `value`, `trust`, `worth_time`, `solves_problem`; `course` has no repeat intent; `movie` and `others` have no extra).
- `food` keeps `tagSet: 'food'` → existing `FoodTagSelector`, plus `would_recommend`, `repeat_intent` ("Order again?") and `portion`. No `stood_out`, no `value`.
- `legacy_unlinked` gets none of this and stays `sections: []`.
- **Registry lint test** asserting the shipped vocabularies match `docs/phase-3b-tag-vocabularies.md` exactly — every tag id, every sentiment, and the per-type count in each heading. Divergence is an implementation bug, never a licence to edit the frozen doc.

## Step 2 — `CuratedTagSelector` + choice chips

- New `CuratedTagSelector`: curated chips from a vocabulary, optional custom entries; caps 5 combined, max 3 custom, 40 chars, NFC-normalized and trimmed before case-insensitive dedupe while preserving the user's casing, never blank.
- `FoodTagSelector` stays **regression-identical in behaviour, vocabulary, styling and `metadata.food_tags` persistence**, and is exempt from the new cap. It is not rewritten as a wrapper in this stage.
- New `ChoiceChips` for `single-choice`: nothing preselected; re-tapping the selected option clears it back to unanswered.
- `QuestionnaireSections.tsx` learns the two new kinds and stays entity-type-agnostic.

## Step 3 — persistence

- `metadata.questionnaire = { version: 1, type: <reviews.category>, answers: { … } }`, merged via the existing `mergeReviewMetadata` — never replacing the column.
- **Envelope type follows the DB contract, not a display resolver.** The DB validates `metadata.questionnaire.type === reviews.category`, so the client uses that exact value. For a normal linked review the linked entity's canonical type must also equal `reviews.category`; when it does not, the review is in compatibility mode and the client **never creates or updates** a v1 envelope. After a deliberate subject replacement, `reviews.category` is recanonicalized from the new subject and the envelope uses that category. React validation and SQL validation therefore cannot disagree.
- Unanswered fields are **omitted** from `answers` — never `""`, `null` or `[]`. `stood_out` / `best_for` persist as `{ selected: [...], custom: [...] }`, omitting empty arrays.
- `would_recommend` is written into the envelope only; the DB trigger derives `is_recommended`. No client-side recommendation writes.
- **Version-selection policy:** a stored envelope is read only when `version === 1` and its `type` matches as above. A mismatched envelope is never rendered and never destroyed; it is carried through untouched until the subject is reselected.
- **No-envelope legacy edit (restored contract):** an existing linked review with a valid canonical subject and **no** `metadata.questionnaire` is offered the v1 questions, but an unrelated save (headline, thoughts, media, rating, visibility) leaves the envelope **absent**. The envelope is created only once at least one questionnaire answer is supplied.
- **Field-level dirty tracking, not whole-object rewrite:** persistence patches `answers` field by field. A field the user never touched is written back byte-identical, including values this build cannot render (future fields, unknown tag ids). A field the user **did** edit is rewritten from its visible values — so a stale unknown tag inside an edited field can genuinely be replaced or cleared. Never replace the whole `answers` object.
- **Caps govern creation and modification, not passive viewing.** Existing stored values are grandfathered: a stored custom tag longer than the cap is displayed and preserved **intact**, never visually truncated, and a field already holding more values than the cap renders **all** of its recognized values. While a field is over cap, the "add" affordance is disabled with an explanatory hint until the user reduces it; any state the user actually edits must satisfy the current caps before it can be saved. New input always enforces 5 total / 3 custom / 40 characters. Unknown tag ids remain unrendered but preserved unless that exact field is deliberately rewritten. Nothing is silently dropped because it predates a cap.
- **Clearing:** clearing the last remaining answer **removes** `metadata.questionnaire` entirely rather than leaving `{ version, type, answers: {} }` — absent keeps its honest meaning "no questionnaire was answered". Removal only applies when no untouched/unknown field remains; if one does, it is preserved and the envelope stays.
- **Reset on subject change:** any `entity_id` change clears the questionnaire envelope and known subject-specific metadata (`food_tags`), and **preserves unrelated root metadata and provenance** untouched.


## Step 4 — wizard wiring

Generic Phase 3 questionnaire answers live in one `answers` state object on `ReviewForm`, keyed by field id; the existing Food Tags keep their current dedicated state and `metadata.food_tags` persistence path unchanged. Questions render in the **existing** `StepFour` → `QuestionnaireSections` location (verified: `StepFour.tsx` is where the registry sections render today) — Stage 2 expands that section and does **not** relocate anything between steps; wizard-layout restructuring stays deferred to Phase 2.5B. All questions stay **optional**: `StepNavigation` and the submit gates are untouched. Chips are real toggle buttons with `aria-pressed`, keyboard operable, and wrap on narrow viewports.

## Out of scope for Stage 2

Stage 3 items only: the "Would you still recommend it?" timeline question, `auto` reset, source copy, "Undo latest update" UI, and retiring the Convert action. No Phase 3D cleanup. No React code ever writes `reviews.is_recommended` — the form writes the answer, the DB resolver owns the materialized flag.


## Tests

- Registry lint vs the frozen doc (ids, sentiments, counts, per-type field sets).
- `CuratedTagSelector` caps, custom dedupe/normalization, blank rejection; FoodTagSelector regression suite unchanged and uncapped.
- Choice chips: no preselection, re-tap clears.
- Persistence: envelope shape per type; unanswered fields omitted; merge preserves unrelated metadata; version/type mismatch → compatibility mode, envelope preserved.
- **No-envelope regression:** legacy review with no `metadata.questionnaire`, headline-only edit → `metadata.questionnaire` remains **absent**.
- **Field-level dirty state:** untouched field carrying an unknown tag survives an edit to a *different* field; editing that same field replaces/clears the unknown tag; clearing the last answer removes the envelope; an untouched unknown field keeps the envelope alive.
- **Grandfathered over-cap data:** 6 stored selected tags → all six render and survive; 4 stored custom tags → an edit to a *different* field preserves all four; a stored 60-character custom tag is displayed and re-saved byte-identical; while over cap, adding is blocked; once the user edits that field, the resulting state must satisfy the current caps to save.
- `entity_id` change clears the envelope and `food_tags` while unrelated root metadata and provenance survive.
- **End-to-end materialization (crosses UI → metadata → trigger → column):** saving `would_recommend` through the real review persistence path sets `reviews.is_recommended` correctly; changing it updates the flag; clearing it falls back to rating inference; a timeline event overrides the envelope; a latest `auto` returns the review to rating inference. This runs against the database, not a mock, so a metadata write that fails to fire the trigger cannot pass.
- Step 0 close-out: the one JSON truth table green in both Vitest and the SQL harness with identical output and matching case counts.
- `bunx vitest run` + typecheck green.


## Manual acceptance (you)

1. New review for a movie, product, place, food, course and `others` → correct questions and repeat-intent wording per type; food shows Food Tags + portion and no generic "What stood out".
2. Answer nothing → submit succeeds; stored metadata contains no questionnaire key at all.
3. Answer, save, reopen → answers restored exactly; unrelated metadata intact.
4. Change the subject mid-form → questionnaire and food tags cleared, everything else intact.
5. Edit an older review, change only the headline → no questionnaire metadata appears.
6. Edit a legacy review whose category no longer matches its subject → compatibility mode, saves without losing stored data.
7. Recommendation flag still follows the frozen precedence (envelope beats rating; timeline beats envelope).


## Report and stop

Stage 2 ends with a report: Stage 1 close-out results (including anything still UNVERIFIED), registry lint output, test results, and confirmation that no Stage 3 timeline UI was included. Stage 3 does not begin until you review it.
