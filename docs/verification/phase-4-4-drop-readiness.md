# Phase 4.4 — Drop-readiness proof (read-only)

Date: 2026-09-16. Scope: proof only. Nothing was dropped, altered, re-granted or regenerated;
no data changed. All evidence below is from the live catalogues, the live routine/view/policy
text, and the repository.

Proof method (three layers, because `pg_depend` alone misses routine bodies and dynamic SQL):
structural (`pg_depend`-family catalogues, constraints, triggers, policies, defaults, indexes,
types), textual (every routine body via `pg_get_functiondef`, every view definition, every
policy expression, check constraints, column defaults), and operational (cron command text,
Realtime publication membership, storage policies, repo-wide sweep including CI/scripts).

## Invariants re-verified (Phase 4.3 still holds)

- `recommendations`, `recommendation_comments`, `recommendation_likes`,
  `recommendation_saves`: **0 rows** (combined count query).
- `reviews`: 0 rows with `recommendation_id` or `is_converted` set.
- `notifications`: 0 rows with a legacy `action_url`.
- Security linter: **436 issues, identical to the Phase 4.3 baseline** — no new category.

## Object-level results

| Object (exact identity) | Runtime refs | Schema refs | Operational refs | Data/size | Disposition | Phase 4.5 action |
|---|---|---|---|---|---|---|
| `public.recommendations` (table) | 0 | children CASCADE FKs; `reviews_recommendation_id_fkey` (restricting); 6 trigger instances; 3 SELECT policies; 2 indexes using `recommendation_visibility` | 0 | 0 rows / 114 KB | SAFE TO DROP IN 4.5 | Drop after children and after `reviews_recommendation_id_fkey` |
| `public.recommendation_comments` | 0 | self-FK `parent_id` (NO ACTION); FK to `recommendations` (CASCADE); 3 trigger instances; 1 SELECT policy | 0 | 0 rows / 80 KB | SAFE TO DROP IN 4.5 | Drop before parent |
| `public.recommendation_likes` | 0 | FK to `recommendations` (CASCADE); 2 trigger instances; 1 SELECT policy | 0 | 0 rows / 40 KB | SAFE TO DROP IN 4.5 | Drop before parent |
| `public.recommendation_saves` | 0 | FK to `recommendations` (CASCADE); 1 SELECT policy | 0 | 0 rows / 40 KB | SAFE TO DROP IN 4.5 | Drop before parent |
| `reviews.recommendation_id` + `reviews_recommendation_id_fkey` | 0 (only two type declarations remain in `src/types/entities.ts` and `reviewService.ts` — deprecated, never read or written; generated types regenerated in 4.5) | restricting FK (NO ACTION); **no view, index, policy, check, default or routine reads it** (fail-safe sweep empty) | 0 | — | SAFE TO DROP IN 4.5 | Drop FK first, then the column |
| `reviews.is_converted` | 0 (deprecated, deliberately absent from the live type) | default `false`, NOT NULL; **no readers found in any layer** | 0 | — | SAFE TO DROP IN 4.5 | Drop after `recommendation_id` |
| `recommendation_category` (enum) | 0 | used only by `recommendations.category` and `recommendations_backup.category` | 0 | — | SAFE TO DROP IN 4.5 | Drop last, only after both using tables are gone |
| `public.toggle_recommendation_like(p_recommendation_id uuid, p_user_id uuid)` → boolean | 0 | none | 0 | — | SAFE TO DROP IN 4.5 | Drop by full signature |
| `public.increment_recommendation_view(rec_id uuid, viewer_id uuid)` → void | 0 | none | 0 | — | SAFE TO DROP IN 4.5 | Drop by full signature |
| `public.get_recommendation_likes_by_ids(p_recommendation_ids uuid[])` → TABLE | 0 | none | 0 | — | SAFE TO DROP IN 4.5 | Drop by full signature |
| `public.get_user_recommendation_likes(p_recommendation_ids uuid[], p_user_id uuid)` → TABLE | 0 | none | 0 | — | SAFE TO DROP IN 4.5 | Drop by full signature |
| `public.create_recommendation_comment_notification()` → trigger | 0 | owned by trigger `on_new_recommendation_comment` on `recommendation_comments` | 0 | — | SAFE TO DROP IN 4.5 | Drops with its trigger/table, or by full signature first |
| `public.create_recommendation_like_notification()` → trigger | 0 | owned by `on_new_recommendation_like` on `recommendation_likes` | 0 | — | SAFE TO DROP IN 4.5 | Same |
| `public.retract_recommendation_like_notification()` → trigger | 0 | owned by `on_delete_recommendation_like` on `recommendation_likes` (its only instance) | 0 | — | SAFE TO DROP IN 4.5 | Same. Note: holds stale app-role EXECUTE grants — dropping removes them |
| Trigger instances: `on_new_recommendation_comment`, `on_soft_delete_recommendation_comment`, `recommendation_comments_updated_at` (on `recommendation_comments`); `on_new_recommendation_like`, `on_delete_recommendation_like` (on `recommendation_likes`); `update_recommendations_updated_at` (on `recommendations`) | 0 | instances only | 0 | — | SAFE TO DROP IN 4.5 | Owned by their table drops |
| `public.update_updated_at_column()` → trigger function | live | **shared**: same function drives 11 triggers — entities, entity_products, mux_upload_mappings, mux_uploads, post_comments, posts, review_updates, user_routines, user_stuff (+ the 2 retired ones) | cron (indirect) | — | KEEP | None — only its two retired trigger instances go |
| `retract_comment_notifications()` → trigger function | live | shared with `post_comments` | 0 | — | KEEP | None |
| `recommendation_visibility` (enum) | live | types `posts.visibility`, `reviews.visibility`, `reviews_backup.visibility`, `recommendations.visibility`, `recommendations_backup.visibility`, + 2 indexes on `recommendations`; `entity_stats_v2` reads `reviews.visibility` with this type | cron (view refresh) | — | KEEP / EXCLUDE FROM 4.5 | None |
| `entity_stats_v2` (materialized view) | live | its only "recommendation" references are `reviews.is_recommended` and `recommendation_visibility` — both KEEP | hourly refresh job (:05) | — | KEEP | None |
| `recommendations_backup` (table) | 0 | none; deny-all policy; `anon`/`authenticated`/`service_role` have table privileges from creation (policy blocks reads) | 0 | 14 rows / 16 KB | KEEP / EXCLUDE FROM 4.5 (retention decision: retain through the Phase 4.5 close-out as the pre-cleanup snapshot; the owner-only `audit` manifest already supersedes it for rollback investigation; revisit retention after 4.5 verification — dropping is irreversible and needs an explicit owner decision at that point) | None in 4.5 |
| `entities_backup` (120 rows), `reviews_backup` (39), `post_entities_backup` (2) | 0 | none related to the retired layer | 0 | 8–114 KB | KEEP — **out of scope**: migration backups from earlier phases, not part of this retirement | None |
| `audit.phase_4_3_legacy_manifest` (71 rows) + `phase_4_3_manifest_captures` (1) + `phase_4_3_legacy_manifest_counts` (8) | 0 | owner-only | 0 | — | KEEP — retention basis documented below | None |
| 6 SELECT policies on the retired tables + deny-all on `recommendations_backup` | app roles | owned by their tables | 0 | — | SAFE TO DROP IN 4.5 | Owned by table drops |
| Indexes on the retired tables (incl. `idx_recommendations_entity_rating_visibility`, `idx_recommendations_user_rating_visibility`) | 0 | owned by `recommendations` | 0 | — | SAFE TO DROP IN 4.5 | Owned by table drops |
| `recommendation_images` storage bucket + its 4 policies (`Public can view`, `Authenticated users can upload`, `Users can update/delete their own`) | **live** — composer/entity image uploads (`uploadRecommendationImage` → `use-recommendation-uploads`) | — | — | — | KEEP | None |
| `src/integrations/supabase/types.ts` | generated | mirrors live schema | — | — | artifact, not a drop candidate | Regenerate once, after 4.5 succeeds |
| `src/types/entities.ts:59` `recommendation_id?: string`, `reviewService.ts` deprecated type note | compile-time only | — | — | — | Clean with 4.5 type regeneration | Remove the two deprecated type fields in 4.5 |
| `src/config/authConfig.ts` comment naming the retired tables | — | — | historical doc comment | — | Documentation (harmless) | Optional tidy in 4.5 |

## Proof-layer details (reproducible)

1. **Structural** — constraint list above from `pg_constraint` (children `ON DELETE CASCADE` to
   `recommendations`; `recommendation_comments.parent_id` self-NO ACTION;
   `reviews_recommendation_id_fkey` NO ACTION/restricting). Trigger instances and their
   function sharing from `pg_trigger`/`pg_proc`. Type usage from
   `pg_type`/`pg_attribute` (both enums enumerated above). Realtime: `pg_publication_rel`
   contains no retired table.
2. **Textual** — `pg_get_functiondef` across every `public` routine for the retired table
   names, `recommendation_category`, `recommendation_id`, `is_converted`: the only matches are
   the seven retired routines listed above. View definitions: only `entity_stats_v2` matches
   the word "recommendation", and only via `is_recommended` / `recommendation_visibility`.
   Policies, checks, defaults, indexes: zero matches for the review marker columns outside the
   retired tables themselves.
3. **Operational** — cron: exactly 5 jobs (orphan-media weekly dry run, retracted-notification
   prune, entity-stats-v2 hourly :05, social-influence-v2 daily 04:12, trending-v2 hourly :20);
   none references the retired layer. Storage policies: only the live `recommendation_images`
   bucket (KEPT). Repo sweep: no `.from('recommendations…')` or `.table('recommendations…')`
   anywhere; remaining identifier hits are the two deprecated type fields, the historical
   comment in `authConfig.ts`, generated types, historical migrations, tests and docs.

## Audit-manifest retention record (KEEP)

- **Purpose:** sole record of the Gate 4 deletion for rollback investigation.
- **Owner/grants:** owned by `postgres`; verified this phase that `anon`, `authenticated`,
  `service_role`, `authenticator` and `dashboard_user` have no schema USAGE and no table access.
- **Personal identifiers:** contains user-linked record ids (`user_id`, `record_id`,
  `entity_id` columns) — ids only, no names/emails.
- **Retention/review point:** retain through Phase 4.5; review for removal at the Phase 4.5
  post-verification close-out. Explicitly outside the Phase 4.5 removal list.

## Drift list

None. No `.sql` snapshots remain under `supabase/functions/` (the stale ones were removed in
Gates 5–6); deployed routines match the post-only Gate 1 definitions (verified in live
`pg_proc` bodies). Edge Functions deploy from this repository.

## Authoritative Phase 4.5 order (no CASCADE at any step)

1. Re-verify invariants (tables empty, markers clear, no retired links).
2. Remove the two deprecated type fields (`entities.ts`, `reviewService.ts`); tidy the
   `authConfig.ts` historical comment.
3. Drop the seven retired routines by full signature
   (`toggle_recommendation_like(uuid, uuid)`, `increment_recommendation_view(uuid, uuid)`,
   `get_recommendation_likes_by_ids(uuid[])`,
   `get_user_recommendation_likes(uuid[], uuid)`,
   `create_recommendation_comment_notification()`,
   `create_recommendation_like_notification()`,
   `retract_recommendation_like_notification()`).
4. Drop `reviews_recommendation_id_fkey`.
5. Drop `reviews.recommendation_id`.
6. Drop `reviews.is_converted`.
7. Drop `recommendation_comments`, `recommendation_likes`, `recommendation_saves`
   (children first; their triggers, policies and indexes are owned by the drop).
8. Drop `recommendations` (its triggers, policies, indexes owned by the drop).
9. Drop `recommendation_category` (proven unused by anything else).
10. Regenerate the database types once.
11. Re-run the zero-reference and preservation checks (tests, type check, build).

Reversibility: routines/policies/triggers/columns are re-creatable from migration history;
the table drops are irreversible but the tables are empty, so no data is at risk.
`recommendations_backup` is retained through 4.5 (decision above).

## Completion

Zero UNRESOLVED items. Everything is SAFE TO DROP IN 4.5, KEEP / EXCLUDE FROM 4.5, or
explicitly out of scope. Phase 4.4 is complete. Phase 4.5 removal requires separate approval.
