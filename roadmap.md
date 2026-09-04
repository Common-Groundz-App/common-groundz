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

- [ ] Regenerate Supabase types




### Stage 2 — questionnaire UI + persistence (in progress)
- [ ] Registry entries for all 15 canonical types + `CuratedTagSelector`; Food Tags untouched
- [ ] Curated vocabularies live in one module; registry lint test proves parity with the approved matrix doc
- [ ] Envelope written as `metadata.questionnaire` with numeric `version: 1`, `type` = `reviews.category` (never a display resolver)
- [ ] Field-level dirty patching: only answered fields are written; clearing the last answer removes the envelope
- [ ] Over-cap stored tags are grandfathered on read (caps govern creation/modification, not passive viewing)
- [ ] Reset answers and subject-specific metadata on any `entity_id` change
- [ ] Render-vs-persist separation with forward-compatibility tests (unknown field ids / future versions preserved, never rendered)
- [ ] End-to-end materialization test: envelope built by the real TS builder → stored row → `is_recommended` resolved by the Stage 1 SQL resolver


### Stage 3 — timeline intent + cleanup (not started)
- [ ] "Would you still recommend it?" with `auto` reset and honest source copy
- [ ] "Undo latest update" on the newest entry only, with conflict handling
- [ ] Retire the Convert action and its wiring

## Phase 3D — cleanup (not started)
- [ ] Remove `questionnaireKind`, five-bucket branches, `foodName`/`contentName`, versioning scaffolding
- [ ] Audit and decide on `reviews.is_converted`

## Deferred
- [ ] Phase 2.5B — optional wizard consolidation (semantic step ids, Subject → Review → Publish)
- [ ] Manual remediation of legacy unlinked reviews
