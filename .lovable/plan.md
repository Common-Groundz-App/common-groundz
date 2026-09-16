# Phase 4.5 — Remove the retired recommendation layer (destructive, approval-gated)

Phase 4.4 proved every candidate is safe to remove. Phase 4.5 executes exactly that
removal — nothing more. Scope comes verbatim from `docs/verification/phase-4-4-drop-readiness.md`.

## What the user will notice

Nothing. The retired tables are empty, the routines are unreachable from the app, and
every live surface (profile Recs tab, entity page "recommending"/"from circle" counts,
"Recommended by Your Circle", recommendation-type posts) is untouched.

## Must be preserved (explicit non-goals)

- `recommendation_visibility` enum — used by `posts.visibility`, `reviews.visibility`,
  `reviews_backup.visibility`. Never dropped.
- `reviews.is_recommended` (endorsement truth), `posts.post_type='recommendation'`.
- `update_updated_at_column()`, `retract_comment_notifications()` — shared functions; only
  their retired trigger instances disappear (with their tables).
- `recommendation_images` storage bucket and its 4 policies — live upload path.
- `entity_stats_v2` and its hourly refresh job; all 5 cron jobs.
- `recommendations_backup` (14 rows) and the other `*_backup` tables — retained; retention
  revisited at the 4.5 close-out, not dropped here.
- `audit.phase_4_3_*` manifest tables — owner-only, retained.

## Execution order (no CASCADE at any step)

Step 0 — re-verify invariants (read-only, abort on any non-zero):
- `recommendations`, `recommendation_comments`, `recommendation_likes`,
  `recommendation_saves` all 0 rows.
- 0 reviews with `recommendation_id IS NOT NULL` or `is_converted = true`.
- 0 notifications with a legacy `action_url`.
- Security linter baseline captured (expected 436).

Step 1 — code-side deprecated fields (no behaviour change):
- `src/types/entities.ts` — remove `recommendation_id?: string` from `CommentWithUser`.
- `src/services/reviewService.ts` — remove the deprecated `recommendation_id` /
  `is_converted` type note/fields.
- `src/config/authConfig.ts` — tidy the historical comment naming the retired tables.

Step 2 — migration A: drop the 7 retired routines by full signature.
`toggle_recommendation_like(uuid, uuid)`, `increment_recommendation_view(uuid, uuid)`,
`get_recommendation_likes_by_ids(uuid[])`, `get_user_recommendation_likes(uuid[], uuid)`,
`create_recommendation_comment_notification()`,
`create_recommendation_like_notification()`,
`retract_recommendation_like_notification()`.

Step 3 — migration B: the reviews marker columns.
1. `ALTER TABLE public.reviews DROP CONSTRAINT reviews_recommendation_id_fkey;`
2. `ALTER TABLE public.reviews DROP COLUMN recommendation_id;`
3. `ALTER TABLE public.reviews DROP COLUMN is_converted;`
Guard in the same transaction: re-assert 0 marker rows before dropping.

Step 4 — migration C: the tables, children first, no CASCADE.
`recommendation_comments`, `recommendation_likes`, `recommendation_saves`, then
`recommendations`. Their triggers, read policies and indexes are owned by the drops.

Step 5 — migration D: `DROP TYPE public.recommendation_category;`
(proven used only by `recommendations` and `recommendations_backup` — the latter's column
type must be re-checked first; if `recommendations_backup.category` still uses it, keep the
enum and record it as BLOCKED-BY-RETAINED-BACKUP instead of forcing a change).

Step 6 — regenerate the database types once (single regeneration, after all DDL).

Step 7 — verification and evidence:
- Retired tables/routines/columns/type absent from the live catalogues.
- Preservation checks: `recommendation_visibility` intact with its 3 columns;
  `reviews.is_recommended` and endorsement counts unchanged (58 endorsements);
  5 cron jobs unchanged; `recommendation_images` bucket + 4 policies intact;
  `entity_stats_v2` refreshes; shared functions and their remaining triggers intact.
- Security linter delta vs the captured baseline; explain any change.
- Repo-wide sweep: zero references to the dropped identifiers outside historical
  migrations, docs and archived plans.
- Full test suite, typecheck, build.
- Write `docs/verification/phase-4-5-removal.md` (object, action, proof, reversibility) and
  tick `roadmap.md`.

## Halt rule

Any unexpected dependant, non-zero invariant, or failed guard halts **that candidate only**;
the remaining independent steps continue, and the halted item is recorded as BLOCKED with
its exact dependant. No CASCADE is ever used to force a drop.

## Reversibility

Routines, policies, triggers, constraints and the two reviews columns are re-creatable from
migration history. The four table drops are irreversible, but all four are empty, so no data
is at risk. `recommendations_backup` remains as the pre-cleanup snapshot.

## Technical notes

- One `supabase--migration` call per step (A–D) so a failure isolates cleanly; each is a
  single transaction with its own guards.
- Migration D is the only step that can be skipped without affecting the rest.
- No data-changing SQL, no re-clearing of review markers (Gate 4 already did that), no
  changes to grants on surviving objects.
