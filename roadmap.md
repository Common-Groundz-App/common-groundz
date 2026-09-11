# Roadmap

## Phase 3B — questionnaire specification (spec only, no code)
- [x] Recommendation-intent contract frozen (v4 + reviewer amendments)
- [x] Deterministic "latest timeline intent" ordering (`created_at DESC, id DESC`)
- [x] DB-boundary authorization contract for timeline intent writes (verified gap)
- [x] Executable shared-fixture parity contract (Vitest + Deno/SQL harness)
- [x] Whole-dataset + controlled-fixture trust-score verification contract
- [x] Curated tag vocabularies for the 14 non-food types (ids, labels, emojis, sentiment)

## Phase 3C — implementation

### Stage 0 — freeze the data contract (docs only) — FROZEN
Vocabulary spec frozen at `docs/phase-3b-tag-vocabularies.md`; Stage 2's registry lint must match it exactly.
- [x] Evaluative tag ids/labels; preference-dependent traits stay neutral
- [x] Tag identity is composite `(type, field id, tag id)`; no global ontology
- [x] Food excluded from generic `stood_out` (Food Tags already fill that role)
- [x] `FoodTagSelector` is regression-identical in behaviour, not byte-identical source
- [x] Timeline history is append-only; owner may undo only the newest entry, via an atomic RPC
- [x] Forward-compatibility: unknown questionnaire data is never rendered and never destroyed
- [x] Legacy category-mismatch reviews stay in compatibility mode until the subject is reselected

### Stage 1 — database foundation (delivered and reviewed)
- [x] `would_recommend` column, check constraint, partial index on `review_updates`
- [x] INSERT authorization requires review ownership; drop ordinary UPDATE/DELETE
- [x] Server-owned chronology (client `created_at` overwritten, not rejected)
- [x] Shared per-review advisory lock helper; insert path locks before mutating
- [x] Atomic owner LIFO undo RPC with expected-update conflict result
- [x] `service_role`-only maintenance removal path
- [x] Function privilege hardening: REVOKE PUBLIC, explicit GRANTs, privilege tests
- [x] Shared post-mutation recompute function; recursion-safe trigger gating
- [x] Pure SQL/TS recommendation resolver + review-aware wrapper, one shared fixture
      (frozen output contract: `source` is `timeline_explicit | review_explicit |
      rating_inferred`; a latest `auto` event resolves to `intent: null`,
      `source: rating_inferred` — `auto` stays historical event data, never resolved intent)
- [x] Explicit `OWNER TO postgres` on every privileged/internal function (definer chain
      documented in SQL, not assumed from the migration runner)
- [x] Maintenance RPC re-checks the target row under the advisory lock and verifies the
      deleted row count, so a lost race returns `not_found`, never a false `deleted`
- [x] Trigger consolidation with whole-dataset and concurrency regression checks
- [x] Explicitly assert RLS is enabled on `review_updates` in the authorization tests
- [x] Test-harness rules: no `SET ROLE` inside a `SECURITY DEFINER` harness (role/privilege
      denial must be attempted from a real session running as that role); one correctly
      typed scalar `SELECT ... INTO` per assertion; direct UPDATE/DELETE inside the harness
      is labelled test-only fixture manipulation; chronology asserts the client value did
      not survive *and* that the stored value equals `transaction_timestamp()` — the trigger
      uses `now()` (transaction start), so comparing against a later `clock_timestamp()`
      captured inside the harness produces false failures; fixture user/entity ids are
      confirmed to exist and match the review category before running; the harness and its
      results table are dropped once evidence is captured, so no permanent privileged
      surface remains
- [x] Strict envelope `version`: JSON numeric `1` only; string `"1"` is malformed and must
      resolve as *absent* (fix SQL resolver, TS resolver and shared fixture together)
- [x] SQL parity consumes `recommendationTruthTable.json` through the committed
      generator at run time — never a hand-copied JSON blob inside a migration
- [x] Label `SET LOCAL ROLE` checks as *database-role privilege* tests, not real Supabase
      sessions; verify sanctioned owner INSERT / owner undo / non-owner INSERT denial from a
      genuine authenticated session (`auth.uid()` present) or report them UNVERIFIED
- [x] Close-out evidence table stays temporary, no `PUBLIC` SELECT, dropped after capture

- [ ] Advisory-lock concurrency (insert vs undo, undo vs undo, maintenance vs undo, two
      different reviews) requires independent parallel sessions — never reported as passing
      on the strength of the single-session self-test
- [ ] Authenticated owner INSERT / owner undo / non-owner INSERT denial via real Supabase
      session (`auth.uid()` present)

- [x] Supabase generated types reconciled (Phase 3D.0): the checked-in
      `src/integrations/supabase/types.ts` already carries `review_updates.would_recommend`
      and the Stage 1 RPCs (`delete_latest_review_update`, `recompute_review_timeline_state`,
      `resolve_review_recommendation`, `lookup_latest_recommendation_intent`) — the unchecked
      item was stale bookkeeping, not a stale file

### Stage 2 — questionnaire UI + persistence (delivered and reviewed)
- [x] Registry entries for all 15 canonical types + `CuratedTagSelector`; Food Tags untouched
- [x] Curated vocabularies live in one module; registry lint test proves parity with the approved matrix doc
- [x] Envelope written as `metadata.questionnaire` with numeric `version: 1`, `type` = `reviews.category` (never a display resolver)
- [x] Field-level dirty patching: only answered fields are written; clearing the last answer removes the envelope
- [x] Over-cap stored tags are grandfathered on read (caps govern creation/modification, not passive viewing)
- [x] Reset answers and subject-specific metadata on any `entity_id` change
- [x] Render-vs-persist separation with forward-compatibility tests (unknown field ids / future versions preserved, never rendered)
- [x] End-to-end materialization test — runs through the ONE shared save helper (`buildReviewMetadataForSave`), asserts in SQL, and cleans up by fixture id only

### Stage 3 — timeline intent + cleanup (delivered and reviewed)
- [x] "Would you still recommend it?" with `auto` reset and honest source copy
- [x] `addReviewUpdate` accepts `yes | maybe | no | auto | null`; skipped/cleared → column omitted; only explicit reset writes `auto`
- [x] `ChoiceChips` in `ReviewTimelineViewer` with re-tap-to-clear semantics
- [x] Honest source-copy helper: provenance claims only when caller has complete timeline history
- [x] Atomic owner-only LIFO undo wrapper around `delete_latest_review_update`, refetches parent review
- [x] Removed Convert-to-recommendation call sites and wiring (action was already a silent no-op due to trigger)
- [x] Regression tests for `no`+`null` vs `no`+`auto` resolver outcomes
- [x] Vitest + production build green

## Phase 3D — cleanup (delivered; close-out gaps reopened, see below)
Close-out invariant: no review-authoring or questionnaire module depends on a five-bucket
type or mapping; surviving five-bucket logic is documented as search/filter compatibility only.

- [x] 3D.0 Generated types reconciled; duplicate stale Phase 3D roadmap block removed
- [x] 3D.1 Repo-wide five-bucket audit, every occurrence classified REMOVE / KEEP / DEFER
- [x] 3D.2 Bucket mapping lives in `src/services/reviewCategoryBuckets.ts` and is documented as a
      search/filter projection. The Deno-mirror parity cases were merged into
      `src/services/__tests__/reviewCategoryBuckets.test.ts` and the old
      `src/components/profile/reviews/__tests__/reviewCategoryBucketParity.test.ts` deleted, so the
      strong invariant holds literally: nothing under the review-authoring tree references the
      five-bucket module (grep: 0 hits in `src/components/profile/reviews`).
- [x] 3D.3 Form-level five-bucket state removed; `reviews.category` truth table extracted to
      `categoryPersistence.ts` and unit-tested; unresolvable case blocks the save
- [x] 3D.4 `SubjectPrefill` / `deriveSubjectPrefill` / `SubjectLike` removed, `subjectSelection.ts`
      deleted; `legacyTitle` / `legacyVenue` legacy-unlinked adapter kept
- [x] 3D.5 Questionnaire versioning and forward compatibility — permanent contract, not scaffolding
- [x] 3D.6 `reviews.is_converted` audited (no DB view, function, RPC, edge-function or client
      consumer); documented as deprecated historical column, unused client field removed
- [x] 3D.7 Acceptance case 7 (same-type subject replacement resets subject-specific answers) now
      has named tests: persistence-layer cases through `buildReviewMetadataForSave` in
      `phase3dCompatibility.test.ts`, plus behaviour-layer `ReviewFormSubjectReset.test.tsx`
      driving the real form (product→product and food→food, each with a distinct same-type id and
      an identical-id no-reset mirror).
- [x] 3D.8 Stale alias and import audit
- [x] Full Vitest suite (38 files / 633 tests), `tsgo --noEmit` clean and production build green
      after the reopened items were re-closed

## Phase 4 — retire the standalone recommendation feature

Boundary rule (three separate concepts, never conflated):
- `reviews.is_recommended` (explicit answer → latest timeline answer → rating fallback) is the **only**
  endorsement truth. Untouched by Phase 4.
- `posts.post_type='recommendation'` is an **editorial label** for contextual advice. Kept untouched;
  it must never contribute to endorsement truth, counts, trust or ranking.
- The standalone `public.recommendations` record is the retirement target. Identify legacy targets by
  destination (writes to `public.recommendations`), never by visible label or symbol name.

- [x] 4.0 Read-only audit and design capture — `docs/verification/phase-4-recommendations-audit.md`.
      Every legacy routine classified by semantic replacement (endorsement / engagement / plumbing /
      obsolete), every reader inventoried, post-type isolation confirmed, review-post rating source
      confirmed (`structured_fields.rating`), legacy card anatomy captured in
      `docs/verification/assets/`. **Gate: nothing removed until reviewed.**
- [x] 4.1 Stop legacy creation only — audit classifications corrected first (`UserRecommendationCard`
      and `RecommendationsModal` reclassified as separate features to keep; review post type added to
      the concept table with composer-write evidence; deletion gate written as "by data dependency,
      never by name"). Legacy "Recommend" button removed from `EntityDetail` (pre-v4 branch) and
      `EntityDetailV2` — removed, not relabelled, since both already had a Review CTA beside it. v4
      needed no change: it has no legacy creation CTA. Dormant listener, submit handler, upload hook
      and mounted form removed from `SmartComposerButton`. Legacy form/services left on disk and
      unreachable until 4.3
- [ ] 4.2 Apply the per-consumer decisions: endorsement maths reads only `reviews.is_recommended`;
      engagement inputs (trending, reputation, similarity, who-to-follow, personalisation, profile and
      directory counts, feed polling) get their own replacement or removal. Before/after numbers
      recorded per surface. No mechanical substitution
- [x] 4.2A Endorsement-truth migration done: fallback, Circle discovery/rating/counts/activity
      gate and global counts all read canonical review truth (visibility → canonical row →
      endorsement), Circle routines identity-enforced, new `get_entity_recommenders` RPC does
      canonical selection/filter/order/pagination in SQL, client service + circle-rating hook +
      stale threshold copy updated. Reviewer corrections all applied: (a) averages use **all**
      canonical visible ratings while counts filter to `is_recommended` — shared selection, not
      shared filtering; (b) recommender id/username/avatar arrays share one deterministic
      ordering (`username NULLS LAST, id`); (c) recommender pagination ends in `recommended_at
      DESC NULLS LAST, user_id ASC`; (d) `has_network_activity` frozen as **endorsement
      activities** with the comment corrected; (e) `OWNER TO postgres` on every touched/new
      routine, `PUBLIC` execute revoked, and the new `SECURITY INVOKER` RPC verified under real
      RLS as `anon` and as `authenticated`. Fixture proof (BEGIN…ROLLBACK, generated ids,
      deterministic limit, no external trigger side effects): raw recommending rows 3, people
      recommending 2, average 3.0. Whole-dataset parity unchanged (78 reviews / 58 recommended /
      same checksum). Evidence: `docs/verification/phase-4-2a-recommendation-truth.md`
- [ ] 4.2B Intelligence/scoring migration (trending, similarity, influence, reputation,
      collaborative + social client pipelines). Not started
- [ ] 4.2B.0 visible-number cutover: additive review-only entity stats; canonicalize before
      aggregating review/recommendation counts and average rating; switch every reader without
      double-counting; migrate public directory counts and feed polling; verify explicit owner,
      idempotent single refresh job, indexes, grants, manual refresh and before/after values; stop
- [ ] 4.2B.1 scoring contract + machine-readable fixtures (docs only); approval gate before
      4.2B.2 scoring routines or 4.2B.3 client pipelines


- [ ] 4.3 Remove the legacy application layer **and** its dummy data together (notifications point at
      `/recommendations/:id`, so route and rows go in one step). Clear `reviews.recommendation_id` and
      `reviews.is_converted` in the same statement. No permanent legacy viewer
- [ ] 4.4 Verify zero remaining dependencies in code, routines, policies, triggers and indexes
- [ ] 4.5 Separately approved schema migration: drop the recommendation tables, `recommendation_category`,
      `reviews.recommendation_id`, `reviews.is_converted`, and the obsolete routines/triggers/policies/indexes

## Phase 5 — the feed card (after Phase 4)

- [ ] 5.0 Prototype the hierarchy on the existing post card — post-type badge top-right in a defined
      trailing region, timestamp on its own line, real spacing between header / title / rating / body /
      chips / media / actions. No new shared architecture yet
- [ ] 5.1 Review across every case (text-only, media-heavy, all six types, long username, long title,
      many chips, narrow mobile, dark mode). **Gate: agree the card anatomy**
- [ ] 5.2 Extract `FeedCardShell` only if the prototype earned the abstraction; built fresh from the
      design notes, never refactored out of the legacy card
- [ ] 5.3 Per-type slots — `review` → connected rings from that post's own `structured_fields.rating`
      only (no review lookup, no entity aggregate, no inference, no timeline query); `comparison` →
      compared entities; `question` → question framing; `recommendation` / `tip` / `experience` → prose,
      no rating row
- [ ] 5.4 Responsive, accessibility, dark mode and full check-suite verification

## Deferred
- [ ] Phase 2.5B — optional wizard consolidation (semantic step ids, Subject → Review → Publish)
- [ ] Manual remediation of legacy unlinked reviews

