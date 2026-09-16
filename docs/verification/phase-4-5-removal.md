# Phase 4.5 — Removal of the retired recommendation layer

Date: 2026-09-16. Executed per the approved plan (revision 2,
`.lovable/plan/phase-4-5-remove-the-retired-recommendation-layer-destructiv-2026-09-16.md`),
following the Phase 4.4 drop-readiness proof (`phase-4-4-drop-readiness.md`).
No CASCADE at any step. Two of the three destructive migrations were hardened in review
before running (B: table-lock-before-check after a `FOR UPDATE`-with-aggregate flaw; C:
same lock-ordering correction for the table drops).

## Preflight (Step 0) — all passed

- All four retired tables: 0 rows. Zero reviews with `recommendation_id` / `is_converted`.
  Zero notifications with a legacy `action_url`.
- `recommendations_backup.category` confirmed typed `recommendation_category` → the enum
  was classified KEEP (required by the retained backup) and removed from the drop list
  **before** execution.
- Three of the seven routines confirmed as trigger functions → their drops moved after the
  table drops (migration D). Security linter baseline: 436.

## What was removed

| Object | Migration | Result |
|---|---|---|
| `toggle_recommendation_like(uuid, uuid)` | A | dropped (guard: exact signature, zero trigger dependants) |
| `increment_recommendation_view(uuid, uuid)` | A | dropped |
| `get_recommendation_likes_by_ids(uuid[])` | A | dropped |
| `get_user_recommendation_likes(uuid[], uuid)` | A | dropped |
| `reviews_recommendation_id_fkey` | B | dropped after existence + marker invariant under ACCESS EXCLUSIVE lock |
| `reviews.recommendation_id` | B | dropped (0 marker rows re-proven inside the lock) |
| `reviews.is_converted` | B | dropped |
| `recommendation_comments` | C | dropped (child; triggers/policies/indexes owned by the drop) |
| `recommendation_likes` | C | dropped |
| `recommendation_saves` | C | dropped |
| `recommendations` | C | dropped last (guards: empty under lock, no view deps, no surviving-table FKs) |
| `create_recommendation_comment_notification()` | D | dropped (guard: no remaining trigger references) |
| `create_recommendation_like_notification()` | D | dropped |
| `retract_recommendation_like_notification()` | D | dropped |

Code cleanup (Step 1, before any DDL): removed the two deprecated type fields
(`src/types/entities.ts` `CommentWithUser.recommendation_id`, `reviewService.ts` note +
field) and tidied the historical policy list in `src/config/authConfig.ts`. Typecheck clean.

## Post-removal verification

- Live catalogues: all four tables, all seven routines, both reviews columns and the FK are
  absent (0 rows in every drop-check query).
- Preservation: 58 endorsements (`reviews.is_recommended`) unchanged; shared functions
  `update_updated_at_column`, `retract_comment_notifications`, `reviews_apply_recommendation`
  (+ its reviews trigger) intact; 5 cron jobs unchanged; `recommendation_images` bucket's
  4 policies intact; `entity_stats_v2` present; both enums intact
  (`recommendation_visibility` required by posts/reviews/backups, `recommendation_category`
  required by the retained backup).
- Generated types regenerated once: retired tables/routines absent from
  `src/integrations/supabase/types.ts`; the `is_converted`/`recommendation_id` entries that
  remain there belong to `reviews_backup` (retained snapshot, expected).
- Repo sweep: no live code references to any dropped identifier outside historical
  migrations, docs and archived plans.
- Security linter: 436 → 428 (four dropped tables left the GraphQL-exposure lists) → 426
  (two dropped SECURITY DEFINER functions left the exposure lists). **Zero new issues;
  every delta is explained by the removals.**
- Tests: 633/633 pass. Typecheck: clean. Build: OK.

## Kept / deferred (recorded scope decisions, not defects)

- `recommendations_backup` (14 rows) retained as the pre-cleanup snapshot;
  `recommendation_category` retained because the backup depends on it. Retention of both is
  revisited at a future close-out with an explicit owner decision (dropping is irreversible).
- `audit.phase_4_3_*` manifest retained (owner-only, sole rollback-investigation record).
- `entities_backup`, `reviews_backup`, `post_entities_backup` — earlier-phase migration
  backups, out of scope for this retirement.

## Completion status

Every in-scope candidate from the approved plan was removed; every verification check
passed; zero unexpected blocked candidates. **Phase 4.5 is fully complete.**

## Reversibility

Routines, policies, triggers, constraints and the two reviews columns are re-creatable from
migration history. The four table drops are irreversible, but all four were empty — no data
was at risk, and `recommendations_backup` remains as the snapshot.
