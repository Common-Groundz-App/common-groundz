# Phase 4.2B.3 — Consumer cutover verification record

Date: 2026-09-13. Status: complete. Nothing was dropped; v1 retirement stays 4.2B.4.

## Frozen endorsement eligibility

Every endorsement-shaped read is `canonical eligible review AND reviews.is_recommended = true`.
Canonicalization happens **first** (one current review per person per item,
`created_at DESC NULLS LAST, id DESC`), then the stored flag is inspected, then the effective
rating (`COALESCE(latest_rating, rating)`), then any cap. Consumers never re-inspect
questionnaire answers or timeline intent; the stored flag already resolves
latest timeline intent → original questionnaire answer → rating inference.

| Old read meant | Frozen replacement |
|---|---|
| things similar people recommend | canonical eligible review with `is_recommended = true` |
| viewer-endorsed item seeds | viewer's canonical eligible review with `is_recommended = true` |
| co-endorsers of those items | canonical eligible review with `is_recommended = true` |
| influencer recommendations | canonical eligible review with `is_recommended = true` |
| extended-network recommendations (old `>= 4.5`) | `is_recommended = true`; higher effective rating ranks higher, never gates |
| community recommendations | canonical eligible review with `is_recommended = true` |
| taste overlap / similarity | canonical eligible reviews, all effective ratings |
| viewer exclusions | any review record by the viewer for that item (any status/visibility, drafts included) |
| a person's categories | canonical item types from their eligible reviews |

## Frozen visibility matrix

| Population | Visibility rule | Why |
|---|---|---|
| Similarity (`calculate_user_similarity_v2`) and its overlap sets | public published canonical reviews only | globally reusable/cacheable; private activity must never move it |
| Collaborative candidate discovery | public published canonical reviews only | candidate set must reproduce a cached similarity result |
| Viewer-specific social surfaces (influencer / extended-network / community / social discovery) | viewer-authorised: public + Circle-visible by followed authors + the viewer's own, enforced server-side by `get_canonical_endorsements_for_viewer` | rendered per-viewer, never cached globally |
| The viewer's own exclusion set | all of the viewer's own reviews, any status/visibility (drafts included) | their own data |

## Frozen influence eligibility

No absolute cutoff. Eligible influencers: stored v2 score `> 0`, ranked score DESC then id,
top N per surface. Measured distribution at cutover (21 rows): min 0.0039, max 0.0637,
mean 0.0135 — the old 0.3 cutoff would have emptied the surface; remeasure after scheduled
refreshes (a note, not a blocker).

## Frozen trending rules (surface vs bucket)

Rank by `trending_score_v2`, never gate a whole surface on it. The `>= 5` discovery cut is
removed in favour of ordering by v2 value, then recency/id. Only buckets explicitly labelled
"trending" use `> 0` for membership; other buckets fill the surface when trending is empty.
All blends use `value / 1.2` (contract bound) via `normalizeTrendingV2`.

## Defects fixed this phase

1. **Endorsement filtered before canonical selection.** Two paths filtered on the flag (and
   capped rows) before reducing to the current review per person/item — a stale "yes" could
   outlive a newer "no". Fixed by `get_canonical_endorsements_public` /
   `get_canonical_endorsements_for_viewer`: canonical-first, then flag, then effective rating,
   all in SQL. The client no longer filters or caps pre-reduction.
2. **Circle visibility enforced, not assumed.** Reviews RLS only grants public-or-own, so no
   browser query could honestly cover Circle-visible reviews. Viewer-specific social surfaces
   moved to the viewer-scoped routine (`auth.uid()` must equal `p_viewer_id`), which returns
   public + Circle-visible by followed authors + own.
3. **Lifestyle similarity zero-coercion.** The scheduled job called the v1 routine and coerced
   missing values to zero. Now calls `calculate_user_similarity_v2`; "not comparable" stays
   absent (dimension dropped, weights renormalized) and never becomes a zero score.
4. **Viewer in own social-proof sets.** The viewer is now filtered out of influencer /
   extended-network / community author sets before the RPC.

## Fixtures (run live, cleaned up, zero leftovers)

- Older "yes" + newer "no" on the same item → **0 rows** (stale endorsement is dead). ✔
- Low rating + explicit yes → verified at the boundary instead: the DB resolver recomputed
  `is_recommended` to `false` on both insert and a direct flag update, proving the flag is
  DB-owned and a client write cannot force an endorsement. The reader honours whatever the
  resolver stores. ✔ (fixture deleted; `count(*) = 0` leftovers confirmed)
- Anonymous call to both routines → `42501 permission denied`; `authenticated` and
  `service_role` hold EXECUTE. ✔

## Schedulers (measured)

- Trending: exactly one — GitHub Actions `daily-refresh.yml` (`0 0 * * *`) calling the
  `update-trending-scores` Edge Function, which invokes `update_all_trending_scores_v2`.
- Influence: exactly one — cron job `refresh-social-influence-v2-daily` (`12 4 * * *`) →
  `net.http_post` → Edge Function `refresh-social-influence-v2` (Vault-backed
  `x-cron-secret`, read via `vault.decrypted_secrets` by name; verified by three successful
  temporary runs, then the temp job was removed). Job list confirmed: 5 jobs total, one per
  schedule; no duplicate influence or trending cron entries.
- Browser: `backgroundService.ts` deleted; no `setInterval`-driven score refresh or influence
  write remains in `src/`.

## Secrets

No secret value appears in migrations, SQL, source or docs — only the Vault entry name
`influence_refresh_cron_secret` and the env var name `INFLUENCE_REFRESH_CRON_SECRET`.

## Verified no-ops

- `get_personalized_entities_v2` — zero live callers (no new caller introduced).
- `calculate_user_reputation_v2` — zero live callers.
- `user_interests.entity_type` (text) vs `entities.type` (enum): the `::text` cast is correct
  and stays.

## Switched surfaces exercised

- Who-to-follow → `get_who_to_follow_v2`, same output shape, UI unchanged.
- Social surfaces (influencer / extended / community / discovery) → viewer-scoped routine.
- Collaborative (user-based, item-based, enhanced) → public canonical routine + own-row seeds.
- Trending readers (discovery, explore, search ranking, personalization, fallback pool) →
  `trending_score_v2` ordering with deterministic tie-breaks; widened fallback pool fetched
  once and shared across buckets.
- Test suite 633/633 pass; typecheck clean; production build green.

## Deferred, deliberately

- v1 routines, the v1 `trending_score` column and the v1 influence table → 4.2B.4 proof gate
  and retirement (`calculate_trending_hashtags`'s reference to the v1 routine is inspected there).
- Legacy recommendation listing/display — profile service, entity page section, feed hook,
  notification targets, content viewer, `/recommendations/:id` route → 4.3 (removed with rows).
- `reviews.recommendation_id` / `reviews.is_converted` clearing → 4.3; schema drop → 4.5.
- v4 entity page's direct fallback RPC call with its own mapping — intentional, documented.
- Pre-existing security-scan findings, unchanged by this work, tracked separately.
