# Phase 4.5 — Remove the retired recommendation layer (destructive, approval-gated)

Revision 2. Both reviewers were right on all points, and two of their concerns are now
settled with live catalogue evidence rather than deferred into execution:

- **`recommendation_category` must be KEPT.** `recommendations_backup.category` is still
  typed `recommendation_category` (verified live). Since the backup is intentionally
  retained, the enum is retained with it. The former "migration D" is removed from Phase 4.5
  and the enum is classified **KEEP — required by retained backup**. No known-to-fail drop
  is attempted, and the backup is not altered merely to free the enum.
- **Three of the seven routines are trigger functions** (verified live): 
  `create_recommendation_comment_notification()` → `on_new_recommendation_comment` on
  `recommendation_comments`; `create_recommendation_like_notification()` →
  `on_new_recommendation_like`; `retract_recommendation_like_notification()` →
  `on_delete_recommendation_like`, both on `recommendation_likes`. They cannot be dropped
  before their tables, so routine removal is split into two migrations around the table drops.

Also **not in scope, KEEP**: `reviews_apply_recommendation()` and its trigger
`reviews_apply_recommendation_trigger` on `reviews` — live Phase 3C endorsement logic,
merely shares the word "recommendation".

## What the user will notice

Nothing. The retired tables are empty, the routines are unreachable from the app, and every
live surface (profile Recs tab, entity "recommending"/"from circle" counts, "Recommended by
Your Circle", recommendation-type posts) behaves exactly as today.

## Must be preserved (explicit non-goals)

- `recommendation_visibility` enum — used by `posts.visibility`, `reviews.visibility`,
  `reviews_backup.visibility`, plus the retained backup. Never dropped.
- `recommendation_category` enum — KEEP (retained backup depends on it).
- `reviews.is_recommended`, `posts.post_type='recommendation'`,
  `reviews_apply_recommendation()` + its trigger.
- Shared functions `update_updated_at_column()` and `retract_comment_notifications()` — only
  their retired trigger instances disappear, with their tables.
- `recommendation_images` storage bucket + its 4 policies (live upload path).
- `entity_stats_v2` and all 5 cron jobs.
- `recommendations_backup` (14 rows) and the other `*_backup` tables; `audit.phase_4_3_*`.

## Final candidate list

| Object | Action in 4.5 |
|---|---|
| `toggle_recommendation_like(uuid, uuid)` | DROP (migration A) |
| `increment_recommendation_view(uuid, uuid)` | DROP (migration A) |
| `get_recommendation_likes_by_ids(uuid[])` | DROP (migration A) |
| `get_user_recommendation_likes(uuid[], uuid)` | DROP (migration A) |
| `reviews_recommendation_id_fkey` | DROP (migration B) |
| `reviews.recommendation_id` | DROP (migration B) |
| `reviews.is_converted` | DROP (migration B) |
| `recommendation_comments`, `recommendation_likes`, `recommendation_saves` | DROP (migration C, children first) |
| `recommendations` | DROP (migration C, last) |
| `create_recommendation_comment_notification()` | DROP (migration D, after its table) |
| `create_recommendation_like_notification()` | DROP (migration D) |
| `retract_recommendation_like_notification()` | DROP (migration D) |
| `recommendation_category` | KEEP — required by retained backup |
| Triggers, read policies, indexes on the retired tables | removed by their table drops |

## Execution order

**Step 0 — preflight (read-only, abort on any failure).** Retired tables all 0 rows;
0 reviews with `recommendation_id` or `is_converted = true`; 0 notifications with a legacy
`action_url`; zero application/runtime references (repo sweep); re-confirm the enum and
trigger-function dependencies above; freeze this candidate list; capture the security-linter
baseline (expected 436).

**Step 1 — code cleanup, then typecheck before any DDL.**
- `src/types/entities.ts` — remove `recommendation_id?: string` from `CommentWithUser`.
- `src/services/reviewService.ts` — remove the deprecated `recommendation_id` /
  `is_converted` type fields and note.
- `src/config/authConfig.ts` — tidy the historical comment naming the retired tables.

**Migration A — standalone RPCs** (zero trigger dependants). Guard: each routine exists with
the expected signature and has no dependant beyond itself; then `DROP FUNCTION` by full
signature.

**Migration B — reviews marker columns.** Guard: 0 marker rows (re-asserted inside the
transaction) and no policy/index/check/view/routine reads either column; then drop the FK,
then `recommendation_id`, then `is_converted`.

**Migration C — retired tables.** Guard: each table empty and no external dependant besides
the known children/FKs; then drop `recommendation_comments`, `recommendation_likes`,
`recommendation_saves`, then `recommendations`. Their triggers, read policies and indexes are
owned by the drops.

**Migration D — retired trigger functions**, now dependency-free. Guard: no trigger
references them; then drop the three by full signature.

**Step 2 — regenerate the database types once**, after the final schema state is known.

**Step 3 — verify and record.** Dropped objects absent from the live catalogues; preservation
checks (both enums intact with their remaining columns, `reviews.is_recommended` and the 58
endorsements unchanged, 5 cron jobs, storage bucket + 4 policies, `entity_stats_v2` refresh,
shared functions and their remaining triggers, `reviews_apply_recommendation` intact);
security-linter delta vs baseline with any change explained; repo-wide sweep showing no
references outside historical migrations, docs and archived plans; full test suite, typecheck,
build. Evidence in `docs/verification/phase-4-5-removal.md`; `roadmap.md` updated with the
accurate status.

## Halt rule (dependency-aware)

No CASCADE, ever. An unexpected dependant halts that candidate **and every later step whose
safety depended on it** — e.g. if a table cannot be dropped, migration D is skipped rather
than forced. Independent steps continue. Each blocked item is recorded with its exact
dependant.

## Completion status

- An approved **KEEP** disposition (the enum) does not block completion — it is a recorded
  scope decision.
- Any **unexpected blocked in-scope candidate** means Phase 4.5 is **partially complete**;
  the roadmap records partial completion with the exact blocked objects, not a full tick.
- Phase 4.5 is fully complete only when every in-scope candidate in the table above is
  removed and all verification checks pass.

## Reversibility

Routines, policies, triggers, constraints and the two reviews columns are re-creatable from
migration history. The four table drops are irreversible, but all four are empty, so no data
is at risk; `recommendations_backup` remains the pre-cleanup snapshot. Backup retention is
revisited at the 4.5 close-out, together with the enum that depends on it.
