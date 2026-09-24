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
- [x] 4.2 Apply the per-consumer decisions: endorsement maths reads only `reviews.is_recommended`;
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
- [x] 4.2B Intelligence/scoring migration (trending, similarity, influence, reputation,
      collaborative + social client pipelines). Complete — every subphase 4.2B.0–4.2B.4B done and
      verified live. Deliberately open: `discoveryService.getNewThisWeek`'s `average >= 4.0`
      branch, awaiting its own impact measurement and approval

- [x] 4.2B.0 visible-number cutover: additive review-only entity stats materialized view
      (`entity_stats_v2`); canonicalize before aggregating; every reader switched without
      double-counting; directory counts and feed polling migrated; owner, idempotent single
      refresh job, indexes, grants verified live; zero active readers of old view and zero
      stats-readers of old records. Evidence: `docs/verification/phase-4-2b0-entity-stats-cutover.md`
      (49 canonical reviewers / 36 recommending; 633 tests, clean typecheck and build).
      Deliberately open: legacy record *listing* in search/entity pages, removed in 4.3.
- [x] 4.2B.1 scoring contract + machine-readable fixtures (docs only); contract v2 and 48 fixtures
      approved and frozen. Evidence: `docs/verification/phase-4-2b-scoring-contract.md`,
      `docs/verification/phase-4-2b-scoring-fixtures.json`
- [x] 4.2B.2 additive v2 scoring build: `trending_score_v2` column + pure scorer + candidate
      selector + orchestrator; `social_influence_scores_v2` + pure calculator + reconciling refresh
      orchestrator; similarity/reputation/who-to-follow/personalised v2 routines; secured unscheduled
      `refresh-social-influence-v2` Edge Function; one-time trending + influence bootstrap; no v1 or
      consumer changes. Evidence: `docs/verification/phase-4-2b-2-implementation-record.md`
- [x] 4.2B.3 schedule influence refresh via cron → protected Edge Function → Vault secret (no direct pg_cron call; guard needs service_role JWT)
- [x] 4.2B.3 consumer cutover: switch each pipeline atomically to v2 (trending thresholds rescaled,
      similarity NULL semantics, influence read-only v2 table), schedule the influence function,
      remove the browser `setInterval` updater in `backgroundService.ts`
- [x] 4.2B.4A proof gate only — evidence recorded in
      `docs/verification/phase-4-2b4a-proof-gate.md`; `calculate_trending_hashtags` confirmed a
      name-match false positive (no dependency); two open decisions: nothing schedules the trending
      v2 orchestrator (all `trending_score_v2` values are 0), and the zero-impact 3.5 filter
- [x] 4.2B.4A-bis activate the Trending producer and settle Decision 2: hourly Supabase cron job
      `refresh-trending-scores-v2-hourly` → protected `update-trending-scores` (Vault-backed secret,
      admin bearer or `x-cron-secret`, incremental mode only) → `update_all_trending_scores_v2(false)`;
      rejection matrix and two idempotent 200 runs recorded, B3's inaccurate workflow claim corrected,
      and the 3.5 Circle eligibility filter removed so endorsement alone decides eligibility.
      Evidence: `docs/verification/phase-4-2b4a-proof-gate.md` §8
- [x] 4.2B.4B retirement executed: dropped the two `has_network_recommendations` overloads and the
      single `get_network_entity_recommendations` overload (signatures corrected from live `pg_proc`),
      the stale quality-score table with its dead writer, the three v1 trending routines, the five v1
      similarity/who-to-follow/personalized/reputation/influence routines, the empty v1 influence
      table, `entity_stats_view` + its hourly job, and `entities.trending_score` + its two indexes.
      No CASCADE, nothing stopped; the live circle-count and Circle-card routines untouched. Only
      threshold change applied: `getQualityNewThisWeek` no longer reads the quality table.
      `discoveryService.getNewThisWeek`'s `average >= 4.0` branch deferred for separate approval.
      Evidence: `docs/verification/phase-4-2b4a-proof-gate.md` §9


- [x] 4.3 Remove the legacy application layer **and** its dummy data together, in six gates
      (revision 5 plan). Nothing is removed for having "recommendation" in its name — only for
      reading the legacy tables. `posts.post_type = 'recommendation'` untouched throughout
  - [x] 4.3 Gate 1 complete write freeze: revoke `anon`/`authenticated` INSERT/UPDATE/DELETE/
        TRUNCATE/REFERENCES/TRIGGER (SELECT stays, nothing new granted) + drop write policies on
        the four legacy tables; narrow `service_role` to SELECT/DELETE only (Gate 4 never UPDATEs
        the legacy tables — review markers live on `reviews`); shared comment/interaction routines
        become post-only with identical identity signatures/return shapes/owner/grants and pinned
        `search_path`; legacy-only routines lose EXECUTE from PUBLIC/anon/authenticated AND
        `service_role` (Gate 4 uses direct audited DML); migration executes atomically
  - [x] 4.3 Gate 2 client + Edge Function cutover (feed/search/entity surfaces are post- and
        endorsement-backed; legacy services, hooks, feed card, search item and interaction cache
        deleted; `RecommendationCard` kept presentational without the broken legacy delete;
        `RecommendationView` is a static no-read tombstone; evidence
        `docs/verification/phase-4-3-gate-2-client-cutover.md`);
        `/recommendations/:id` deliberately stays alive as a controlled tombstone
  - [x] 4.3 Gate 3 prove deployed consumers no longer touch the legacy layer, then capture the
        secured audit manifest (stored in the owner-only `audit` schema, never in the repo; repo
        document carries counts, queries and the capture id only). Reviewer corrections applied:
        per-capture `capture_id` created atomically in the same statement as the snapshot;
        counts scoped to that capture with zero-count kinds recorded; notification cohort
        selected by exact audited ids and exact enumerated legacy route forms (never substring
        matching); whole capture is one statement under REPEATABLE READ so all source tables
        share one snapshot without locking live `notifications`/`reviews`; audit schema, tables
        and sequences hard-denied to `anon`, `authenticated`, `service_role`, `authenticator`
        and `dashboard_user` (existence of the last two verified live); Gate 4 execution
        identity documented as administrative/owner, not `service_role`
        (evidence `docs/verification/phase-4-3-gate-3-manifest.md`)
  - [x] 4.3 Gate 4 one audited transactional cleanup, executed in the administrative/owner
        context (not `service_role`): hardened per both review rounds — all 8 count kinds
        asserted non-null, bidirectional exact-identity cohort checks on every legacy table,
        audited review rows locked `FOR UPDATE`, exact two-form `?commentId=` URLs (no
        wildcards), full polymorphic-children and notification zero assertions; completed with
        zero aborts, all four legacy tables empty, markers cleared
        (evidence `docs/verification/phase-4-3-gate-4-cleanup.md`)
  - [x] 4.3 Gate 5 removed the route, `RecommendationView`, `RecommendationContentViewer`, the
        `/recommendations/*` redirect line and the legacy notification destination mappings
        (retired `entity_type='recommendation'` rows resolve to no destination instead of falling
        through to their stored legacy `action_url`); content routes, thumbnails, grouping and
        `commentsService` are post-only; `recommendations.image_url` dropped from both
        orphan-media reference sets (last live readers). No schema changes.
        Closure audit second pass: `RecommendationCard`'s three retired-route navigations
        removed — linked endorsements now open their canonical entity page (subject `slug`
        added to the review subject lookup), unlinked ones are inert, and the dead
        comment-count controls are gone; stale `supabase/functions/add_comment.sql` deleted
        (authoritative post-only routines live in the Gate 1 migration).
        RECORD CORRECTION: the profile Recs tab is RETAINED as a review-endorsement surface
        (`reviews.is_recommended`) with zero legacy-table dependency — do not remove it in 4.4/4.5
        (evidence `docs/verification/phase-4-3-gate-5-surface-removal.md`)
  - [x] 4.3 Gate 6 preservation + live zero-dependency verification: recommendation posts,
        `reviews.is_recommended` (58 endorsements), v4 recommending count (6 on the reference
        entity), Circle card, who-to-follow, fallback/network services, chat + journey cards all
        preserved; both retired routes render 404; legacy tables empty, app roles SELECT-only,
        legacy-only RPCs `postgres=X` only, exactly 5 cron jobs. Two defects fixed: the share
        no-op (`shareUrl` helper, share hidden without a canonical destination) and Gate 5's
        replacement navigation, which used non-existent type-prefixed paths — now
        `getEntityUrlWithParent` (`/entity/:slug`). Two dead pre-freeze snapshot files deleted
        (`supabase/functions/get_comments_with_profiles.sql`, `increment_comment_count.sql`).
        Signed-in checks closed by owner manual observation on 2026-09-16 (external Supabase,
        no mintable session): Recs tab + card click-through + Share, Entity V4
        recommending/from-circle counts + Circle card, recommendation-post create/comment/
        like/notification — all verified working as expected. Gate 6 and Phase 4.3 are
        fully complete, every gate PASS, no leftovers, no defects
        (evidence `docs/verification/phase-4-3-gate-6-preservation.md`)

- [x] 4.4 Verify zero remaining dependencies in code, routines, policies, triggers and indexes
      (read-only proof gate, 2026-09-16: structural + textual + operational layers; exact
      routine signatures; trigger instances vs shared functions; backup retention decisions;
      zero UNRESOLVED; authoritative no-CASCADE 4.5 order; evidence
      `docs/verification/phase-4-4-drop-readiness.md`)
- [x] 4.5 Separately approved schema removal executed (2026-09-16): the four retired tables,
      the seven retired routines, `reviews.recommendation_id` (+ FK) and `reviews.is_converted` dropped —
      no CASCADE, guarded single-transaction migrations, typecheck before DDL, types regenerated once.
      KEPT: `recommendation_visibility` (types posts/reviews/backups) and `recommendation_category`
      (required by the retained `recommendations_backup`); backup/audit retention deferred to close-out.
      Preservation verified (58 endorsements, 5 cron jobs, bucket policies, entity_stats_v2); linter 436→426,
      all deltas explained; 633/633 tests, build OK. Evidence `docs/verification/phase-4-5-removal.md`

## Phase 5 — incremental feed-card polish (after Phase 4)

Boundary: editorial post type, a review post's own `structured_fields.rating`, and review endorsement
truth (`reviews.is_recommended`) are three separate concepts. Feed-card presentation must not infer or
cross-read between them.

- [x] 5.0A Badge placement only — moved the existing post-type badge from the metadata line to a
      collapsing trailing region beside the owner menu; preserve all typography, density, identity
      behavior, body ordering and actions; removed the duplicate detail-page badge. Verified on public
      post detail at desktop/mobile/dark widths, a simulated long identity, and an unbadged experience;
      633/633 tests, typecheck, and production build pass. Stopped for visual review
- [x] 5.0B Explicitly skipped after visual review — 5.0A already produced balanced, compact spacing;
      the title → body → media → entity chips → location tags → actions order remains unchanged
- [x] 5.0C Post-local Review rating — strict finite numeric `structured_fields.rating` from 1–5,
      compact connected rings, no endorsement/review/entity lookup, exactly once in shared feed/detail
      anatomy; verified on real public Review details at desktop/mobile/dark widths, including rating-only
      detail collapse; 654/654 tests, typecheck, and preview build pass. Stopped for visual approval
- [x] 5.1 Cross-card acceptance on real feed/detail surfaces — accepted with no design change; dispositions
      recorded as PASS / TEST-STATIC-COVERED / NOT APPLICABLE (no FAIL, no unresolved BLOCKED)
- [x] 5.2 Explicitly skipped — the small header and rating changes did not earn a `FeedCardShell` abstraction
- [x] 5.3 Deferred — type-specific Question/Comparison layouts are separate future product work
- [x] 5.4 Close-out verified — 654/654 tests, typecheck, production build, zero runtime page errors, one
      rating per eligible Review card, keyboard/responsive/dark/reduced-motion checks, post-local data
      boundary, and a baseline-aware sweep proving no new generic-star rating or legacy dependency.
      Evidence: `docs/verification/phase-5-feed-card.md`. PHASE 5 FULLY COMPLETE

## Post–Phase 5 follow-up — posted entity-pill polish

- [x] Share one local missing/broken-image fallback between the composer and posted entity pills
- [x] Replace shared posted-card entity tags with read-only composer-style pills and remove only their category row
- [x] Verify long, multiple, missing/broken-image, responsive, and dark-mode states; stopped for visual approval
- [x] Refine the posted-only pill to a quieter stable 36px treatment with available-width truncation and measured-overflow tooltip; add interaction tests and refresh visual evidence
- [x] Final posted-only visual refinement — 34px pill, 24px thumbnail, soft semantic orange tint, unchanged fluid truncation and behavior; verified at desktop/mobile in light/dark
- [x] Posted-only type/scale pass — 13px label, 30px pill, 22px thumbnail; verified on real cards at desktop/mobile in light/dark and reduced motion
- [x] Step 5 inventory gate — app-wide entity-image fallback audit (read-only); matrix, helper classification and migration groups in docs/verification/entity-image-fallback-inventory.md; no surface migrated
- [x] Step 5 Groups 0A/0B/1 — canonical fallback contract, future-write stock-placeholder hygiene, and selected composer-chip proof; stopped before Group 2
- [x] Step 5 Groups 0A/0B/1 proof gate closed — direct write-path regression tests (explicit `image_url: null`, legitimate Unsplash preserved, reuse writes nothing) plus controlled selected-chip fixture (32px pill, 20×20 frame, missing/broken parity, source reset); authenticated runtime capture unavailable (`external_unmanaged`); stopped before Group 2A
- [x] Step 5 Group 2A — search/selection thumbnails (EntityResultItem, ProductSearch, SubjectSelectStep, UnifiedEntitySelector modal+inline entity rows) on the shared fallback contract; frames/sizes/crops preserved verbatim; entity initials replaced by canonical type icons while user avatar initials untouched (People branch verified in mixed-view test); 710 tests, typecheck, build OK; stopped before Group 2B (EntityChildrenCard parent-image source rule needs documentation and written approval first)
- [x] Step 5 Group 2B — child rows, sidebar parent/related rows, and recommendation entity thumbnails on the shared fallback contract; parent-image substitution removed as an approved fallback shortcut (thumbnail source only; parent relationship/description/navigation unchanged); all frames, crop modes, navigation, analytics, and user initials preserved; 724 tests, typecheck, and build pass; stopped before later groups
- [x] Step 5 Group 3A — Saved, chat, and review-preview card thumbnails on the shared fallback contract; local 6-type icon map, chat stock helpers and unknown→product coercion removed; EntityPreviewCard's "No image" text replaced by an accessibly labelled canonical icon (approved one-time content change); all frames/crops preserved; 738 tests, typecheck, and build pass; stopped before Group 3B

- [x] Group 3B — profile review/recommendation large subject-image area on the shared fallback contract (author media separated from subject image; hideEntityFallbacks and compact semantics preserved; 750 tests)

- [x] Group 4 — explore grids and entity collections (FeaturedEntities, all three CategoryHighlights branches, SiblingCarousel, RelatedEntitiesSection) on the shared fallback contract via EntityCollectionImage; per-surface real-image precedence preserved (optimal resolution on explore, raw image_url on siblings/related); hover zoom only where it exists; non-live EntityRelatedCard example and the loading skeleton excluded; 759 tests, typecheck, build clean
- [x] Group 5 — live Entity V4 header picture on the shared fallback contract via new EntityHeaderImage (stock substitution removed in EntityV4; entityImage now string|null; dead entityData.image removed; responsive 96px/192px frames, brand object-contain and refresh overlay preserved; overlay only after a genuine load failure and reset on entity id + source change); 776 tests, typecheck, build clean

## Deferred
- [x] Group 6A — outside-result search rows (SearchResultHandler) and Add to My Stuff picker rows (EntitySearch) on the shared fallback; picker preview never carries a stock address; 785 tests
- [ ] Group 6B — retire entity page v1/v2/v3 and the version switch (show deletion manifest first)
- [ ] Group 6C — retire unused ProductResultItem and RecommendationForm after zero-importer proof
- [ ] Group 6D — admin pictures: classify by role, approve, then migrate only entity-own-picture slots
- [ ] Group 6E — EntityTabsContent child cards: broken present picture → icon; missing stays omitted
- [ ] Post-group cleanup — ImageWithFallback simplification, legacy stock-helper deletion once zero active callers are proven, optional historical database cleanup of known stock placeholder rows, the getOptimalEntityImageUrl resolver decision, final inventory audit
- [ ] Phase 2.5B — optional wizard consolidation (semantic step ids, Subject → Review → Publish)
- [ ] Manual remediation of legacy unlinked reviews

- [x] Group 6B: retire legacy entity pages v1/v2/v3 (V4 untouched)
- [ ] Group 6C: remove proven-unused product row and old recommendation form
- [ ] Group 6D: admin pictures, decided row by row
- [ ] Group 6E: entity tab child cards
