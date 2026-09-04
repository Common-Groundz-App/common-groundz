# Roadmap

## Phase 3B — questionnaire specification (spec only, no code)
- [x] Recommendation-intent contract frozen (v4 + reviewer amendments)
- [x] Deterministic "latest timeline intent" ordering (`created_at DESC, id DESC`)
- [x] DB-boundary authorization contract for timeline intent writes (verified gap)
- [x] Executable shared-fixture parity contract (Vitest + Deno/SQL harness)
- [x] Whole-dataset + controlled-fixture trust-score verification contract
- [x] Curated tag vocabularies for the 14 non-food types (ids, labels, emojis, sentiment)

## Phase 3C — implementation

### Stage 0 — freeze the data contract (docs only)
- [x] Evaluative tag ids/labels; preference-dependent traits stay neutral
- [x] Tag identity is composite `(type, field id, tag id)`; no global ontology
- [x] Food excluded from generic `stood_out` (Food Tags already fill that role)
- [x] `FoodTagSelector` is regression-identical in behaviour, not byte-identical source
- [x] Timeline history is append-only; owner may undo only the newest entry, via an atomic RPC
- [x] Forward-compatibility: unknown questionnaire data is never rendered and never destroyed
- [x] Legacy category-mismatch reviews stay in compatibility mode until the subject is reselected

### Stage 1 — database foundation (not started)
- [ ] `would_recommend` column, check constraint, partial index on `review_updates`
- [ ] INSERT authorization requires review ownership; drop ordinary UPDATE/DELETE
- [ ] Server-owned chronology (client `created_at` overwritten, not rejected)
- [ ] Shared per-review advisory lock helper; insert path locks before mutating
- [ ] Atomic owner LIFO undo RPC with expected-update conflict result
- [ ] `service_role`-only maintenance removal path
- [ ] Function privilege hardening: REVOKE PUBLIC, explicit GRANTs, privilege tests
- [ ] Shared post-mutation recompute function; recursion-safe trigger gating
- [ ] Pure SQL/TS recommendation resolver + review-aware wrapper, one shared fixture
- [ ] Trigger consolidation with whole-dataset and concurrency regression checks
- [ ] Regenerate Supabase types

### Stage 2 — questionnaire UI + persistence (not started)
- [ ] Registry entries + `CuratedTagSelector`; Food Tags untouched
- [ ] Version-selection and legacy category-mismatch policy
- [ ] Reset answers and subject-specific metadata on any `entity_id` change
- [ ] Render-vs-persist separation with forward-compatibility tests

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
