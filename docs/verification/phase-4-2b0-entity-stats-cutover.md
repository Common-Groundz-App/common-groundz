# Phase 4.2B.0 — entity statistics cutover: verification

Date: 2026-09-12. Verified against the live database and the code, not from notes.

## What was built

`public.entity_stats_v2` — a **materialized view** (retire it later with
`DROP MATERIALIZED VIEW`, not table DDL). Definition:

```
public + published reviews
  -> one canonical row per (user_id, entity_id): created_at DESC NULLS LAST, id DESC
  -> review_count         = count of canonical reviewers
  -> recommendation_count = canonical reviewers with is_recommended
  -> average_rating       = avg(COALESCE(latest timeline rating, original rating))
                            over ALL canonical reviewers, including "no"
```

Additive cutover: the old `entity_stats_view` was left in place, is read by nothing, and is
retired with the rest of the legacy cleanup.

## Database evidence (queried live)

- 329 rows in `entity_stats_v2`; 40 items with reviews.
- Canonical cross-check (recomputed by hand from `reviews` with the same canonical rule):
  **49 canonical reviewers, 36 recommending**. The view's sums match exactly
  (sum review_count = 49, sum recommendation_count = 36). The raw table has 78 review rows, so
  canonicalisation and the public/published filter are demonstrably applied before aggregation.
- Indexes present exactly once each: `idx_entity_stats_v2_entity_id` (unique),
  `idx_entity_stats_v2_avg_rating`.
- Owner set explicitly: `ALTER MATERIALIZED VIEW ... OWNER TO postgres`.
- Refresh job: exactly one cron job `refresh-entity-stats-v2-hourly`
  (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), created idempotently (existence-checked, so a
  retry cannot duplicate it).
- Grants: SELECT for `anon`, `authenticated`, `service_role` (public aggregate, no private data).
- `get_user_recommendation_counts_batch(uuid[])`: exactly one function, **SECURITY INVOKER**,
  executable by anon/authenticated/service_role; canonicalizes per user/entity before checking
  `is_recommended`, so an older Yes cannot survive a newer public No.

## Reader switch — every reader named

| Reader | Change |
|---|---|
| `src/services/entityService.ts` (`getEntityStats`, `calculateEntityRating`) | now read `entity_stats_v2`; old-record count and app-side timeline/rating re-derivation removed |
| `src/services/enhancedExploreService.ts` | reads `entity_stats_v2`; no longer adds a modern count on top of the cached count (double-count closed) |
| `src/services/enhancedDiscoveryService.ts` | same switch |
| `src/services/entityBatchService.ts` | reads `entity_stats_v2` |
| `src/components/explore/UserDirectoryList.tsx` | directory endorsement counts via `get_user_recommendation_counts_batch` instead of raw legacy rows |
| `src/services/feedContentService.ts` | legacy recommendation branch removed; polls only eligible posts (public, not deleted, following filter, last-check boundary, all post types) |
| `supabase/functions/unified-search-v2/index.ts` (deployed separately) | merges `average_rating`/`review_count` from `entity_stats_v2` into entity results; failure is non-blocking |

## Closure criteria

- **Active readers of the old statistics view = 0.** A full-codebase search for
  `entity_stats_view` outside generated type metadata and historical migration files finds no
  live query. The one remaining match was a stale comment in `use-unified-search.ts`, corrected
  to reference `entity_stats_v2`.
- **Active readers of old standalone records for visible item statistics = 0.** No stats,
  rating, count or polling path reads `public.recommendations`.
- Harmless remaining mentions, explicitly not leftovers: generated Supabase type metadata
  references both views; historical migration files define the old view; both are inert.
- Deliberately open (named, not forgotten): `unified-search-v2` and `entityService.
  fetchEntityRecommendations` still *list* old standalone records as content. That is legacy
  rendering, removed in 4.3; it feeds no count, rating or score.

## Checks

- Test suite: 38 files, 633 tests, all passing.
- Typecheck (`tsgo --noEmit`): clean.
- Production build: OK.

Roadmap: 4.2B.0 marked complete. Next: 4.2B.1 scoring contract (documents only), approval gate
before any scoring-routine or client-pipeline change.
