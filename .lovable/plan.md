# Phase 3C (v5) — final: RPC undo + privilege hardening

Both rounds of review are right and everything is folded in. This is the final
architecture — both reviewers now approve it; the remaining notes are Stage 1
acceptance guardrails, not redesigns.

Why the earlier enforcement shape was wrong (kept for the record): a general
`DELETE` policy plus a row-level "newest?" trigger is not a safe LIFO API — a
single `DELETE ... WHERE review_id = ...` is evaluated row by row and "newest" is
re-checked per row, so statement shape decides the outcome. And `current_user`
inside a `SECURITY DEFINER` function is the function's *owner*, so privilege checks
based on it would misidentify ordinary callers as privileged. LIFO is therefore one
authenticated RPC, recomputation always runs after the mutation, and every timeline
mutation on a review serializes against that review.

## Roadmap additions (Stage 0 writes these)

- Timeline history is append-only; the owner may undo only the newest entry, via an
  atomic RPC.
- Forward-compatibility contract: unknown questionnaire data is never rendered and
  never destroyed by unrelated saves.
- Legacy category-mismatch reviews stay in compatibility mode until the subject is
  deliberately reselected.

## Verified facts behind this plan

- Across `src/`, `review_updates` is only ever **selected** and **inserted** — no
  edit or delete path exists in any user or admin surface (the delete on
  `TimelineReviewCard` removes the parent *review*). Append-only is already the
  shipped behaviour; the DB policies were merely wider than the product.
- Current policies do allow owner `UPDATE` and owner `DELETE`, and INSERT checks only
  `auth.uid() = user_id` — never review ownership. Both get closed in Stage 1.

## Stage 0 — close 3B properly (docs only, no code)

1. **Rewrite `docs/phase-3b-tag-vocabularies.md`** — the shipped file still marks
   `story`, `acting`, `writing`, `gameplay` as `positive`. Bare aspects become
   evaluative: `compelling_story`, `strong_acting`, `striking_cinematography`,
   `strong_writing`, `memorable_characters`, `engaging_gameplay`, `good_service`,
   `very_clean`, `convenient_location`, `good_value`, `high_quality`,
   `great_packaging`, `strong_ending`, `great_with_friends`, `solid_build`.
   Preference-dependent traits (slow burn, crowded, challenging, fast paced) stay
   plain aspects marked `neutral`. `rude_service` → `unhelpful_service`. `best_for`
   entries carry explicit `sentiment: 'neutral'`.
2. **The four flagged entries**: movie `subtitles_needed` → `memorable_visuals`;
   brand `fast_delivery` → `wide_range`; professional `missed_deadlines` →
   `didnt_follow_through`; experience `good_guide` → `well_organised`.
3. **Tag identity is composite** — `(type, field id, tag id)`; cross-type
   aggregation needs an explicit shared-definitions map, never string reuse.
4. **Food is excluded from generic `stood_out`**: `would_recommend` +
   `repeat_intent` + existing Food Tags (`metadata.food_tags`) + `portion`.
5. Roadmap corrections: Phase 2.5B is *optional wizard consolidation*; Phase 3D's
   full cleanup scope restored (`questionnaireKind`, five-bucket branches, obsolete
   `foodName`/`contentName` state, versioning scaffolding, `is_converted` decision).
6. `FoodTagSelector` is **regression-identical in behaviour, vocabulary, styling and
   persistence** — not "byte-identical source".

Freeze tag ids only after this file is corrected and the lint test passes.

## Stage 1 — database foundation (no new UI)

One migration:

- `review_updates.would_recommend text NULL`,
  `CHECK (would_recommend IN ('yes','maybe','no','auto'))`, partial index on
  `(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`.
- **INSERT authorization**: authenticated, `user_id = auth.uid()`, **and** the parent
  review owned by `auth.uid()`.
- **Server-owned chronology (overwrite, not rejection — Codex):** a `BEFORE INSERT`
  trigger **replaces** `created_at`/`updated_at` with `now()` unconditionally; a
  caller-supplied value is ignored rather than causing an error. Acceptance tests
  assert the *persisted* timestamp is server-generated.
- **No ordinary `UPDATE`, no ordinary `DELETE`.** Both policies are dropped, and a
  guard trigger rejects any non-privileged attempt as a backstop. A changed opinion
  is a new event.
- **One shared lock helper, one key derivation (Codex):** a single private function
  derives the advisory lock key from the review UUID, used identically by the insert
  trigger, the owner RPC and the maintenance RPC. No two namespaces or hash
  functions. `pg_advisory_xact_lock` (same convention as `create_entity_subject`).
- **The INSERT path takes the lock too, before it mutates (both reviewers):** the
  insert trigger acquires the per-review lock *before* inserting and holds it through
  recomputation. Inserts, undos and recomputation serialize per review; different
  reviews stay independent.
- **Owner LIFO undo = one atomic RPC**, `delete_latest_review_update(p_review_id,
  p_expected_update_id)`, `SECURITY DEFINER`, pinned `search_path`:
  1. authenticate from `auth.uid()` (never a passed-in user id) and verify review
     ownership;
  2. acquire the shared per-review lock;
  3. resolve the current newest update (`ORDER BY created_at DESC, id DESC LIMIT 1`);
  4. require it to equal `p_expected_update_id`;
  5. delete exactly that one row (`WHERE id = ...`, single row);
  6. **after** the delete, call the shared recompute function;
  7. commit — all of it in one transaction.
  It returns a **typed result** `{ status: 'deleted' | 'conflict' | 'not_found',
  deletedUpdateId?, latestUpdateId? }`; authorization failures remain real database
  errors, not disguised conflicts, so Stage 3's refresh behaviour is deterministic.
- **Privileged maintenance RPC** for arbitrary abuse removal: executable **only by
  `service_role`**, stated explicitly in the migration and enforced by `GRANT` — no
  role-membership heuristics, no `current_user` checks inside a definer function, no
  caller-supplied flags. Same lock, same post-delete recompute path.
- **Function privilege hardening (Codex, blocks Stage 1 completion):** every
  SECURITY DEFINER and internal helper gets `REVOKE ALL ... FROM PUBLIC` (and from
  `anon`/`authenticated`) immediately after creation; execution is then granted
  *only* where intended — the undo RPC to `authenticated`, the maintenance RPC to
  `service_role`, and internal helpers (recompute, wrapper, lock helper) to **no
  caller-facing role** at all, so the RPCs are the only mutation surface. Privilege
  tests assert anonymous and authenticated sessions cannot call the internal
  functions directly.
- **One shared recompute function** — `latest_rating`, `timeline_count`,
  `has_timeline`, `trust_score`, resolved `is_recommended` — called by the insert
  trigger and by both delete RPCs, always after the mutation. It is
  **recursion-safe**: since recomputation writes to `reviews`, the recommendation
  trigger is gated (column-of-interest filtering) so the write cannot re-trigger
  recomputation into a loop; "calculate" and "write" responsibilities stay split.
- **Two resolver functions**: a *pure* decision function
  `(original envelope, latest intent event, effective rating) → intent | source |
  is_recommended` with no queries, plus a review-aware wrapper owning the
  deterministic lookup. TypeScript mirrors the split
  (`lookupLatestRecommendationIntent(reviewId)` → pure resolver), sharing one fixture.
- **Strict envelope extraction**: object, `version = 1`, `type` equals the review's
  canonical `category`, `answers` object, `would_recommend` exactly
  `yes`/`maybe`/`no`; anything else → `COALESCE(latest_rating, rating) >= 4`.
- **Trigger consolidation**: drop both overlapping recommendation triggers and the
  older timeline-stats trigger; keep one recommendation trigger plus the enhanced
  timeline-stats trigger. Trust scoring preserved, not redesigned.

Acceptance: whole-dataset before/after snapshot of all 77 reviews shows zero drift in
`is_recommended`, `trust_score`, `latest_rating`, `timeline_count`; direct `UPDATE`
and direct `DELETE` (single-row and `WHERE review_id = ...` bulk) both denied;
stranger insert denied; a client-supplied `created_at` is **overwritten** (test
asserts the persisted value is server-generated); old clients omitting
`would_recommend` still insert; **both the insert trigger and the undo RPC hold the
same per-review lock from the same shared key helper before mutating** (asserted
explicitly); RPC undo of the newest row rolls derived state back exactly one step and
returns `status: 'deleted'`; stale `p_expected_update_id` returns `status:
'conflict'` with the current `latestUpdateId` and deletes nothing;
**concurrency fixtures** for insert-vs-undo and two simultaneous undos on the same
review (one wins, one conflicts, aggregates stay consistent) and for mutations on two
different reviews proceeding in parallel; undo of an `auto` row restores the previous
explicit intent; undo of the last remaining update restores the original answer as
authoritative; privileged mid-history removal recomputes identically; **privilege
tests** prove anon/authenticated cannot execute the recompute, wrapper, lock or
maintenance functions, and that only `authenticated` reaches the undo RPC while only
`service_role` reaches maintenance; recompute-on-recompute recursion is absent
(trigger gating verified by an unrelated-column update producing exactly one
recomputation); shared fixture green in Vitest and the SQL/Deno runner; Supabase
types regenerated.

## Stage 2 — review questionnaire (UI + persistence)

- Corrected vocabularies for the 14 non-food types; `choice` control (nothing
  preselected, re-tap clears); `CuratedTagSelector` (5 combined / max 3 custom / 40
  chars / NFC-trim then case-insensitive dedupe preserving casing); Food Tags
  untouched and exempt from the caps.
- **Version-selection policy:** new review → v1; existing review with a valid v1
  envelope → v1; existing review with no envelope → compatibility mode, questions
  optional and **no envelope written unless the user actually answers something**;
  subject deliberately replaced → fresh v1.
- **Legacy category mismatch:** where `reviews.category` disagrees with the linked
  entity's canonical type (e.g. `category = food`, entity `place`), an envelope built
  from the entity type would be permanently ignored by strict validation. Those
  reviews stay in compatibility mode and are offered **no** v1 questions; they become
  eligible only when the user deliberately reselects the subject, which canonicalises
  `category`. Answering one optional field never rewrites `category`.
- **Reset boundary is `entity_id`, not canonical type:** replacing Movie A with Movie
  B discards the envelope even though the vocabulary matches. Same for
  product→product, food→food, place→place, brand→brand, professional→professional.
  On any subject change, **subject-specific root metadata is cleared too**
  (`metadata.food_tags`) while unrelated root metadata is preserved.
- **Render-vs-persist separation:** the form never renders what it doesn't
  understand, and never destroys it either.

  | Stored state | Behaviour |
  |---|---|
  | Unsupported `version` | Preserve the whole envelope untouched; render nothing, edit nothing |
  | Valid v1, unknown field key | Don't render; preserve on unrelated save |
  | Valid v1, unknown tag id | Don't render as a selected chip; preserve on unrelated save |
  | User edits that specific field | Rewrite **only** that field with sanitized current values |
  | Subject entity replaced | Discard the old envelope, initialise a clean one |
  | Corrupt / non-object envelope | Preserve raw metadata unless subject replacement initialises a clean envelope |

  Saves patch owned fields into the existing `answers` object rather than replacing
  it, on top of `mergeReviewMetadata`.

Acceptance: all 15 types render their frozen matrix; food shows exactly one tag
field; round-trip save/reload; forward-compatibility tests proving
`some_future_field` and `some_future_tag` survive both an unrelated headline edit and
an edit to a *different* questionnaire field; legacy review edited without answering
stores no envelope; mismatched-category review is offered no questions; subject swap
within the same type clears answers and food tags; registry lint test asserts unique
`snake_case` ids with declared sentiment per vocabulary.

## Stage 3 — timeline intent, Undo UI, dead-action cleanup

- "Would you still recommend it?" with the resolved current state and its source in
  plain words, three unselected options, "Use my rating instead" (`auto`), untouched
  = no change, divergence nudge that never rewrites the answer, honest copy when the
  resolve query fails.
- **Undo latest update** (not "Delete") on the newest entry only, calling
  `delete_latest_review_update({ reviewId, expectedUpdateId })`. On conflict the UI
  refreshes and says the timeline changed and to review the latest update before
  undoing it — it never silently removes whatever became newest after the dialog
  opened. Older entries explain: timeline history is chronological, undo newer
  updates first.
- Remove the Convert action from both `ReviewCard` layouts plus its hook/service
  wiring. `is_converted` is decided in 3D.

## Technical notes

- Migration objects: column, check, partial index, INSERT policy replacement, drop of
  UPDATE/DELETE policies, chronology trigger, mutation guard trigger, shared lock-key
  helper, shared recompute function, owner LIFO RPC, privileged maintenance RPC, pure
  resolver, review-aware wrapper, consolidated triggers, and `REVOKE`/`GRANT`
  statements for every function.
- Delivery: Stage 0 frozen and verified first, then each stage deployed and verified
  separately — after Stage 1, the migration, whole-dataset parity, authorization,
  privilege and concurrency results are reported before Stage 2 begins.
- Files: `docs/phase-3b-tag-vocabularies.md`, `roadmap.md`,
  `questionnaire/registry.ts`, `QuestionnaireSections.tsx`, new
  `CuratedTagSelector.tsx`, new `recommendationIntent.ts` + shared fixture,
  `ReviewForm.tsx`, `steps/StepThree.tsx`, `steps/StepFour.tsx`,
  `ReviewTimelineViewer.tsx`, `services/review/timeline.ts`,
  `services/reviewService.ts`, `ReviewCard.tsx`, `ProfileReviews.tsx`.
- `reviews.is_recommended` stays the indexed compatibility signal; no cached
  intent/source columns.

## Out of scope

Entity-page tag aggregation, intent analytics, trust-score redesign, Phase 2.5B,
dropping `is_converted`, editing timeline text after posting.
