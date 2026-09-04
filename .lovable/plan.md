# Stage 2 — questionnaire UI + persistence

## Stage 1 status first (honest answer)

Stage 1's build is complete and evidenced in `docs/verification/phase-3c-stage1-selftest.md`: column, constraint and index, owner-only INSERT with UPDATE/DELETE/TRUNCATE revoked, server-owned chronology, advisory-lock helper, LIFO undo RPC, `service_role`-only maintenance RPC, consolidated recompute, all functions owned by `postgres`, SQL↔TS resolver parity through one shared fixture (0 mismatches), whole-dataset parity, and the database-role privilege matrix. `would_recommend` is present in the regenerated Supabase types.

Two items remain **UNVERIFIED** and stay unticked on the roadmap:
- Advisory-lock concurrency races require independent parallel sessions.
- Owner INSERT / owner undo / non-owner INSERT denial from a genuine authenticated session (`auth.uid()` present).

Neither is a Stage 2 dependency: Stage 2 writes no timeline rows and never writes `is_recommended`. It only writes `reviews.metadata`. So Stage 2 proceeds, and these two carry forward as open Stage 1 items rather than being quietly marked done.

---

## Step 1 — registry data for all 15 types (frozen spec, verbatim)

Extend `questionnaire/registry.ts` — pure data, no React, no network:
- Field kinds actually rendered this stage: `single-choice` (chips) and `tags`.
- New tag sets `stood_out:<type>` and `best_for:<type>`, each entry `{ value, label, emoji, sentiment }`. Sentiment is registry metadata and is **never persisted**.
- Per-type field sets exactly as frozen: every type gets `would_recommend` + `stood_out` (except `food`, which has no generic `stood_out`), plus that type's repeat-intent label and extra dimension from the frozen matrix (`portion`, `best_for`, `value`, `trust`, `worth_time`, `solves_problem`; `course` has no repeat intent; `movie` and `others` have no extra dimension).
- `food` keeps `tagSet: 'food'` → the existing `FoodTagSelector`, plus `would_recommend`, `repeat_intent` ("Order again?") and `portion`. No `stood_out`, no `value`.
- `legacy_unlinked` gets none of this and stays `sections: []`.
- **Registry lint test** asserting the shipped vocabularies match `docs/phase-3b-tag-vocabularies.md` exactly — every tag id, every sentiment, and the per-type count in each heading. Divergence is an implementation bug, never a licence to edit the frozen doc.

## Step 2 — `CuratedTagSelector` + choice chips

- New `CuratedTagSelector`: curated chips from a named vocabulary plus optional custom entries. Caps: 5 combined, max 3 custom, 40 characters, NFC-normalized and trimmed before case-insensitive dedupe while preserving the user's casing, never blank.
- `FoodTagSelector` stays **regression-identical** in behaviour, vocabulary, styling and `metadata.food_tags` persistence, and is exempt from the new caps. It is not rewritten as a wrapper in this stage.
- New `ChoiceChips` for `single-choice`: nothing preselected; re-tapping the selected option clears it back to unanswered.
- `QuestionnaireSections.tsx` learns the two new kinds and stays entity-type-agnostic.

## Step 3 — persistence

- `metadata.questionnaire = { version: 1, type: <reviews.category>, answers: { … } }`, merged through the existing `mergeReviewMetadata` — never replacing the column. `version` is written as a JSON **number**, matching the strict SQL resolver.
- **Envelope type follows the DB contract, not a display resolver.** The DB validates `metadata.questionnaire.type === reviews.category`, so the client writes that exact value. For a linked review the linked entity's canonical type must also equal `reviews.category`; when it does not, the review is in compatibility mode and the client **never creates or updates** a v1 envelope. After a deliberate subject replacement, `reviews.category` is recanonicalized from the new subject and the envelope uses that category, so React and SQL validation cannot disagree.
- Unanswered fields are **omitted** from `answers` — never `""`, `null` or `[]`. `stood_out` / `best_for` persist as `{ selected: [...], custom: [...] }`, omitting empty arrays.
- `would_recommend` is written into the envelope only; the DB trigger derives `is_recommended`. No client-side recommendation writes.
- **Version-selection policy:** a stored envelope is read only when `version === 1` (numeric) and its `type` matches as above. A mismatched envelope is never rendered and never destroyed; it is carried through untouched until the subject is reselected.
- **No-envelope legacy edit:** an existing linked review with a valid canonical subject and no `metadata.questionnaire` is offered the v1 questions, but an unrelated save (headline, thoughts, media, rating, visibility) leaves the envelope **absent**. It is created only once at least one questionnaire answer is supplied.
- **Field-level dirty tracking, not whole-object rewrite:** persistence patches `answers` field by field. A field the user never touched is written back byte-identical, including values this build cannot render (future fields, unknown tag ids). A field the user did edit is rewritten from its visible values, so a stale unknown tag inside an edited field can genuinely be replaced or cleared. The whole `answers` object is never replaced.
- **Caps govern creation and modification, not passive viewing.** Stored values are grandfathered: an over-length custom tag is displayed and preserved intact, never truncated, and a field already holding more values than the cap renders all of its recognized values. While a field is over cap, the "add" affordance is disabled with an explanatory hint; any state the user actually edits must satisfy current caps before saving. New input always enforces 5 total / 3 custom / 40 characters.
- **Clearing:** clearing the last remaining answer **removes** `metadata.questionnaire` entirely rather than leaving `{ version, type, answers: {} }` — absent keeps its honest meaning "no questionnaire was answered". Removal applies only when no untouched/unknown field remains; if one does, it is preserved and the envelope stays.
- **Reset on subject change:** any `entity_id` change clears the questionnaire envelope and known subject-specific metadata (`food_tags`), and preserves unrelated root metadata and provenance untouched.

## Step 4 — wizard wiring

- Generic questionnaire answers live in one `answers` state object on the review form, hydrated from the stored envelope on open and reset on `entity_id` change.
- `QuestionnaireSections` keeps rendering from its existing location in `StepFour.tsx` — no step is moved or renumbered.
- Save path routes through the Step 3 patch builder, so create and edit share one code path.
- Tests: registry lint, `CuratedTagSelector` cap/dedupe/grandfathering behaviour, choice-chip clearing, and an end-to-end materialization test (answers → merged metadata → resolver output) that proves envelope-over-rating precedence without touching Stage 3 timeline UI.

## Explicitly out of scope

No Stage 3 work: no "Would you still recommend it?" timeline control, no undo-latest-update UI, no Convert-action retirement.

## Manual acceptance (you)

1. New review for a movie, product, place, food, course and `others` → correct questions and repeat-intent wording per type; food shows Food Tags + portion and no generic "What stood out".
2. Answer nothing → submit succeeds; stored metadata contains no questionnaire key at all.
3. Answer, save, reopen → answers restored exactly; unrelated metadata intact.
4. Change the subject mid-form → questionnaire and food tags cleared, everything else intact.
5. Edit an older review, change only the headline → no questionnaire metadata appears.
6. Edit a legacy review whose category no longer matches its subject → compatibility mode, saves without losing stored data.
7. Recommendation flag still follows the frozen precedence (envelope beats rating; timeline beats envelope).

## Report and stop

Stage 2 ends with a report: registry lint output, test results including the end-to-end materialization test, confirmation that no Stage 3 timeline UI was included, and the two Stage 1 items still UNVERIFIED. Stage 3 does not begin until you review it.
