# Roadmap

## Phase 3B — questionnaire specification (spec only, no code)
- [x] Recommendation-intent contract frozen (v4 + reviewer amendments)
- [x] Deterministic "latest timeline intent" ordering (`created_at DESC, id DESC`)
- [x] DB-boundary authorization contract for timeline intent writes (verified gap)
- [x] Executable shared-fixture parity contract (Vitest + Deno/SQL harness)
- [x] Whole-dataset + controlled-fixture trust-score verification contract
- [x] Curated tag vocabularies for the 14 non-food types (ids, labels, emojis, sentiment)

## Phase 3C — implementation (not started)
- [ ] `would_recommend` column + partial index on `review_updates`
- [ ] Harden `review_updates` INSERT/UPDATE policies (review ownership, immutable intent rows)
- [ ] SQL + TypeScript recommendation resolver, one executable truth-table fixture
- [ ] Trigger consolidation with full-dataset and controlled-fixture regression checks
- [ ] `CuratedTagSelector` primitive; `FoodTagSelector` preserved byte-identically
- [ ] Registry entries + questionnaire UI for all 15 types; retire Convert action

## Phase 3D — cleanup (not started)
- [ ] Audit and decide on `reviews.is_converted`

## Deferred
- [ ] Phase 2.5B — optional manual remediation of legacy unlinked reviews
