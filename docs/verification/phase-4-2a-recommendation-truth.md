# Phase 4.2A — recommendation truth migration (evidence)

## Frozen semantics (implemented)

1. **Visibility before canonical selection.** Every surface filters to `status = 'published'`
   and `visibility = 'public'` *before* choosing a canonical row. Circle scope is public-only
   this phase because no stable `circle_only` viewer-authorisation rule exists yet.
2. **Canonical row per person/item:** `DISTINCT ON (user_id, entity_id)` ordered
   `created_at DESC NULLS LAST, id DESC`.
3. **Shared selection, NOT shared filtering.** Averages are computed over *all* canonical
   visible rows (people who answered "no" included). Endorsement counts and recommender
   lists filter to `is_recommended = true` on the canonical row.
4. **Identity enforcement.** Circle routines require `auth.uid()` and reject
   `p_user_id <> auth.uid()` with `42501`, so nobody can request another person's Circle data.
5. **`has_network_activity` frozen meaning:** endorsement **activities** — canonical
   `(person, entity)` pairs whose latest public review recommends. One person recommending
   five entities contributes 5. This preserves the pre-migration meaning of the gate; the
   SQL comment states this explicitly.
6. **Array alignment.** `recommender_user_ids` / `recommender_usernames` /
   `recommender_avatars` are produced from one shared deterministic ordering
   (`ROW_NUMBER() OVER (ORDER BY username NULLS LAST, id)`), so index-based pairing on the
   client can never mismatch a profile.
7. **Deterministic pagination.** `get_entity_recommenders` orders
   `is_following DESC, is_mutual DESC, recommended_at DESC NULLS LAST, user_id ASC`.

## Routines migrated

| Routine | Change |
| --- | --- |
| `get_fallback_entity_recommendations` | body now reads `reviews`; signature + 8 columns preserved; `p_current_user_id` accepted-but-ignored until 4.5 |
| `get_aggregated_network_recommendations_discovery(uuid, uuid, integer)` | identity-enforced, public-only, canonical rows, effective ratings, circle average over all canonical rows, aligned arrays |
| `get_circle_rating` | canonical + public + identity-enforced; **no** endorsement filter |
| `get_circle_recommendation_count`, `get_circle_recommendation_counts_batch` | people, not rows; public-only; identity-enforced |
| `has_network_activity` | canonical endorsement activities; public-only; identity-enforced |
| `get_recommendation_count`, `get_recommendation_counts_batch` | people, not rows; public-visibility filter added |
| `get_entity_recommenders` (new) | `SECURITY INVOKER`; canonical selection, search, relationship filter, ordering and pagination in SQL |

Ownership and privileges: every touched/new routine is `OWNER TO postgres`; `PUBLIC` execute
revoked; identity-scoped routines are `authenticated`-only, public read surfaces are
`anon, authenticated`. Verified from `pg_proc.proacl` / `proowner`.

The dead `(uuid, uuid[], integer)` overload of
`get_aggregated_network_recommendations_discovery` was intentionally left untouched (no
callers) and is retired in 4.5, so it still carries its old grants.

## Evidence

- **Whole-dataset parity:** review data unchanged — 78 reviews, 58 recommended, checksum
  `6e6191192a6480716505ef018cdfc2ba` before and after the migration.
- **RLS reachability of the new `SECURITY INVOKER` RPC:** exercised as a real `anon` role and
  as an `authenticated` role with `request.jwt.claims.sub` set.
  Result: `same_people = t`, `following_filter_smaller_or_equal = t`,
  `had_follower_fixture = t`. Live entity spot check: 6 raw recommending rows,
  6 people recommending, 6 anon recommender rows, 6 fallback rows.
- **Controlled fixture (BEGIN … ROLLBACK, generated UUIDs, collision assertion, deterministic
  limit larger than the entity count, no external/non-transactional trigger side effects —
  confirmed no `pg_net`/`http_post` in any `reviews`/`entities` trigger):**

  | person | rating | recommends | created_at |
  | --- | --- | --- | --- |
  | U1 | 5 | yes | -5d |
  | U2 | 4 | yes | -4d |
  | U3 | 1 | no | -3d |
  | U4 | 5 | yes | -2d |
  | U4 | 2 | no | -1d |

  Observed: `stored_recommended_rows = 3`, `people_recommending = 2`,
  `avg_all_canonical = 3.0` → `PASS = true`. Post-run check: 0 leftover fixture entities,
  0 leftover fixture reviews, `reviews` still 78 rows.
- **Suite:** 38 files / 633 tests passed; `tsgo --noEmit` clean.

## Client changes

- `src/services/entityRecommendationService.ts` — now a thin wrapper over
  `get_entity_recommenders`; exported interface unchanged; viewer derived from the session,
  so relationship flags cannot be spoofed.
- `src/hooks/use-circle-rating.ts` — contributor display mirrors the canonical rule
  (public only, newest row per person) and keeps non-recommending ratings.
- Stale threshold copy replaced in `EntityHeader.tsx`, `TrustSummaryCard.tsx` and
  `PostDetailSidebar.tsx` with provenance-safe wording covering deliberate rating-based reset.

Phase 4.2B (trending, similarity, influence, reputation, collaborative/social pipelines) is
**not** started.
