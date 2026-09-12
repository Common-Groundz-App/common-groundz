# Phase 4.2B.1 audit result, then 4.2B.2 — scoring routines on contract v2

## 4.2B.1 audit

Contract v2 and fixtures are complete and consistent — verified by reading both files:

- `docs/verification/phase-4-2b-scoring-contract.md` (330 lines) covers shared rules, verified field
  table, saturation constants, trending, influence, reputation, who-to-follow, personalised items,
  similarity, deployment cutover, and a v1→v2 change log.
- `docs/verification/phase-4-2b-scoring-fixtures.json` — `contractVersion: 2`, pointing at that
  document; 48 scenarios: trending 15, influence 9, personalised 7, similarity 7, reputation 4,
  who-to-follow 3, cross-cutting 3. Every branch the reviews demanded is present, including
  who-to-follow multi-source reason priority and id tie-break.
- No code, SQL or routine was touched by 4.2B.1, as intended.

One leftover, bookkeeping only: `roadmap.md` still shows 4.2B.1 unchecked. It gets marked complete
as the first step below.

## 4.2B.2 — migrate the scoring routines

Every routine below still reads the old standalone records (confirmed by reading the live function
bodies). This step rewrites all six to contract v2 and removes the legacy reads, in one migration.

| Routine | What it does today | v2 |
|---|---|---|
| `calculate_enhanced_trending_score` | uncapped views + old-record likes + old-record counts, unnormalised | normalised views/engagement/contributions from reviews, timeline updates and entity-linked posts; caps; clamped boosts |
| `calculate_trending_score` | duplicate legacy trending | dropped; enhanced routine is the only trending calculation |
| `calculate_social_influence_score` | includes `avg rating / 5`; counts old records | reach 0.35 / volume 0.35 / engagement 0.30 over the single credited set; canonical 15 types |
| `calculate_user_reputation` | counts old records; counts every published review row | credited reviews canonicalised per item; old-record term removed |
| `calculate_user_similarity` | ratings from old records; `< 3` overlap returns a shrunken number | public published canonical review ratings; `< 3` shared → NULL; zero-variance branch; overlap confidence |
| `get_personalized_entities` | raw interest + old-record activity + raw trending | normalised, clamped terms; excludes reviewed/saved items; deterministic tie-break |
| `get_who_to_follow` | mutual/activity components collapse to 1 for anyone non-zero; activity counts old records | one candidate pool, global max-mutual normalisation, activity from posts + public published canonical reviews, frozen reason priority |

Cutover, as the contract froze it:

- Trending: install the routine and recompute every stored `entities.trending_score` in the **same
  transaction**; a new candidate-selection helper replaces full-table scans.
- Influence: delete `social_influence_scores` rows on the legacy category domain in the same
  transaction, then recompute on canonical types.
- `geographic_boost` / `seasonal_boost` stay unwritten (contribute 0). `popularity_score` stays NULL,
  so `base_popularity_n` is 0.
- Each routine body carries a `-- scoring contract v2` comment.

## Verification before this phase is called done

- Re-run each fixture group as SQL against transaction-scoped fixture rows (rolled back; no
  production row created, updated or deleted) and record actual vs expected intermediates.
- Confirm zero remaining references to the legacy records inside any scoring routine.
- Full test suite, typecheck, production build.
- Write `docs/verification/phase-4-2b2-scoring-routines.md` and mark 4.2B.2 in `roadmap.md`.

## Out of scope here

Client pipelines (`socialIntelligenceService`, `collaborativeFilteringService`,
`enhancedExploreService`, `userRecommendationService`, `calculate-lifestyle-similarity`) are 4.2B.3 —
including the NULL-preservation rule that forbids `?? 0` on similarity. Legacy record *listing* in
search and entity pages stays until 4.3. Consensus calibration remains a separate future experiment.

## Technical notes

One migration containing: `DROP FUNCTION calculate_trending_score`, `CREATE OR REPLACE` for the six
remaining routines, the trending recompute, the influence-row reset, and the shared post↔entity
linkage as `post_entities UNION posts.entity_id`. Review eligibility uses `status`/`visibility`
(there is no `reviews.is_deleted`); posts and entities use `is_deleted = false`. No client code and
no schema changes in this step.
