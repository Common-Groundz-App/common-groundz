# Stage 2 — questionnaire UI + persistence (with a Stage 1 close-out first)

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

So Stage 2 starts with a short close-out, then the questionnaire work.

---

## Step 0 — Stage 1 close-out

- `src/services/review/recommendationResolver.ts`: pure `resolveReviewRecommendation(envelope, category, effectiveRating)` returning `{ intent, source }` with `source` in `timeline_explicit | review_explicit | rating_inferred`, plus `lookupLatestRecommendationIntent(updates)` ordering by `created_at DESC, id DESC`. Strict envelope validation (version exactly `1`, `type` strictly equal to the review category, `answers` a plain object, `would_recommend` exactly `yes|maybe|no`); malformed = absent, never `false`; `maybe` → `false`; a latest `auto` resolves to `intent: null, source: rating_inferred`.
- One shared fixture file (`recommendationTruthTable.ts`) consumed by a Vitest suite and by the same-cases SQL check, so both sides prove identical output. No behaviour change to the DB.
- Concurrency: run the four documented races (insert vs undo, undo vs undo, maintenance vs undo, two different reviews) from parallel independent sessions and record results. If parallel sessions cannot be established, it stays explicitly UNVERIFIED — not quietly passed.
- Role-session denial: attempt direct `UPDATE`/`DELETE`/`TRUNCATE` as real `anon` and `authenticated` sessions and record the errors.
- Tick `roadmap.md` Stage 1, appending the concurrency and role-session evidence to the verification doc.

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

- `metadata.questionnaire = { version: 1, type: <canonical category>, answers: { … } }`, merged via the existing `mergeReviewMetadata` — never replacing the column.
- Unanswered fields are **omitted** from `answers` — never `""`, `null` or `[]`. `stood_out` / `best_for` persist as `{ selected: [...], custom: [...] }`, omitting empty arrays.
- `would_recommend` is written into the envelope only; the DB trigger derives `is_recommended`. No client-side recommendation writes.
- **Version-selection policy:** a stored envelope is read only when `version === 1` and `type` equals the review's canonical category. A legacy category-mismatch review renders in compatibility mode — its unknown envelope is never rendered and never destroyed; it is carried through untouched until the subject is reselected.
- **Reset on subject change:** any `entity_id` change clears questionnaire answers and subject-specific metadata (including `food_tags`) so answers can never describe the previous subject.
- Render-vs-persist separation: unknown fields/tags in a stored envelope are dropped from render but preserved on write.

## Step 4 — wizard wiring

`ReviewForm` holds a single `answers` object keyed by field id (replacing the ad-hoc `foodTags` state path for non-food types; food keeps its existing `metadata.food_tags` contract). Questions render in Step 3 under the registry order. All questions stay **optional** — nothing new blocks submission.

## Out of scope for Stage 2

Stage 3 items only: the "Would you still recommend it?" timeline question, `auto` reset, source copy, "Undo latest update" UI, and retiring the Convert action. No Phase 3D cleanup.

## Tests

- Registry lint vs the frozen doc (ids, sentiments, counts, per-type field sets).
- `CuratedTagSelector` caps, custom dedupe/normalization, blank rejection; FoodTagSelector regression suite unchanged and uncapped.
- Choice chips: no preselection, re-tap clears.
- Persistence: envelope shape per type; omission of unanswered fields; merge preserves unrelated metadata; version/type mismatch → compatibility mode, envelope preserved; `entity_id` change resets answers and `food_tags`; unknown tag ids not rendered but not destroyed.
- Stage 0 close-out: shared truth table green in Vitest and SQL with identical output.
- `bunx vitest run` + typecheck green.

## Manual acceptance (you)

1. New review for a movie, product, place, food, course and `others` → correct questions and repeat-intent wording per type; food shows Food Tags + portion and no generic "What stood out".
2. Answer nothing → submit succeeds; stored metadata contains no empty questionnaire keys.
3. Answer, save, reopen → answers restored exactly; unrelated metadata intact.
4. Change the subject mid-form → answers and food tags cleared.
5. Edit a legacy review whose category no longer matches its subject → compatibility mode, saves without losing stored data.
6. Recommendation flag still follows the frozen precedence (envelope beats rating).

## Report and stop

Stage 2 ends with a report: Stage 1 close-out results (including anything still UNVERIFIED), registry lint output, test results, and confirmation that no Stage 3 timeline UI was included. Stage 3 does not begin until you review it.
