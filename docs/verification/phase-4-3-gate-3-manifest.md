# Phase 4.3 — Gate 3: legacy-traffic proof and audit manifest capture

Date: 2026-09-15. Capture id: `9d2d21bd-bd34-4e97-a78f-6be7685973ab`.

No user-linked identifiers are recorded in this document. The row-level manifest lives only in
the owner-only `audit` schema in the database; it is deliberately not committed to the repo.

## 1. Deployed consumers no longer touch the legacy layer

Repo-wide sweep (all paths, not only `src/` and `supabase/functions/`) for reads of
`recommendations`, `recommendation_comments`, `recommendation_likes`, `recommendation_saves`:

| Surface | Result |
| --- | --- |
| Client code (`src/`) | No legacy table reads. `commentsService` keeps the `'recommendation'` type in its union only so the unmounted tombstone compiles; every code path is posts-only and the shared RPCs reject legacy input server-side (Gate 1). |
| Feed / search / entity surfaces | Posts- and endorsement-backed only (Gate 2). Both search functions return `recommendations: []` with the legacy branch removed. |
| Edge Functions | Only `cleanup-orphan-media` and `cleanup-orphan-media-execute` still read `recommendations.image_url`; both are scheduled Gate 5 changes and read only that column. |
| Route `/recommendations/:id` | Static no-read tombstone, `noindex`; removed in Gate 5. |
| Notification destinations | `notificationDestination.ts` still maps the legacy route to the tombstone; removed in Gate 5. |
| Migration history / older SQL files | Historical only — not live definitions. |

Privilege-level proof (Gate 1, re-verified): the four legacy tables grant `anon`/`authenticated`
read only and `service_role` SELECT + DELETE only; the six legacy-only RPCs are `postgres=X`
only; all nine write policies are gone; the seven shared routines reject legacy input.

Corroborating write statistics (`pg_stat_user_tables`, cumulative since the last statistics
reset): `n_tup_ins`, `n_tup_upd` and `n_tup_del` are `0` for all four legacy tables. Treated as
supporting evidence only — the counters are clearly post-reset (`n_live_tup` also reads `0`).

## 2. Manifest capture

Single-statement capture under `REPEATABLE READ`, with `SHARE MODE` locks on the four legacy
cohort tables. `capture_id` is created in the same statement (`INSERT ... RETURNING` inside a
CTE), so the manifest rows and the count rows can never attach to another capture.

Cohort selection rules:

- Parents, comments (including replies), likes and saves: full table contents.
- Polymorphic `comment_likes` and `comment_mentions`: exact legacy comment ids only.
- Notifications: exact audited ids (`entity_id` matching a legacy recommendation or comment) or
  an exact enumerated legacy route form. No substring matching. Live audit of every
  `action_url` containing "recommendation" found exactly one shape present —
  `/recommendations/<legacy recommendation id>` (16 rows, each with `entity_id` equal to that
  id). The singular `/recommendation/<id>` and `?commentId=` forms are enumerated from audited
  ids for completeness and currently match nothing. Recommendation *posts* are never captured:
  nothing enters the manifest because a name or URL contains the word "recommendation".
- Reviews: rows carrying `recommendation_id` or `is_converted = true` (markers cleared in Gate
  4, columns dropped in Phase 4.5).

### Captured counts (capture `9d2d21bd…`)

| Kind | Rows | Live table check |
| --- | --- | --- |
| recommendation | 9 | 9 |
| recommendation_comment | 17 (0 replies) | 17 |
| recommendation_like | 20 | 20 |
| recommendation_save | 3 | 3 |
| legacy_comment_like | 0 | 0 |
| legacy_comment_mention | 0 | 0 |
| legacy_notification | 16 | 16 |
| review_marker | 6 | 6 |
| **total manifest rows** | **71** | — |

Exactly one capture row exists.

## 3. Dependency and trigger facts confirmed live

- `recommendation_comments`, `recommendation_likes`, `recommendation_saves` → `recommendations`
  are `ON DELETE CASCADE`; `recommendation_comments.parent_id` is self-referencing `NO ACTION`;
  `reviews_recommendation_id_fkey` is `NO ACTION` (restricting), so review references must be
  cleared before the parents are deleted.
- `notifications` has no foreign key to legacy records; the 16 rows are matched by exact id.
- Triggers on the legacy tables: `recommendations` (updated_at only);
  `recommendation_comments` (new comment, soft delete, updated_at — no AFTER DELETE);
  `recommendation_likes` (new like, delete-retraction). Notifications are deleted first in
  Gate 4, so the retraction trigger's bare `UPDATE … SET retracted_at WHERE retracted_at IS
  NULL` is a safe no-op.

## 4. Access model (Option A, documented consistently)

The `audit` schema, its tables and its sequences are hard-denied to `anon`, `authenticated`,
`service_role`, `authenticator` and `dashboard_user` (the last two confirmed to exist in
`pg_roles`), plus `PUBLIC` and future default privileges. Verified after the migration with
`has_schema_privilege` / `has_table_privilege`: all `false`.

Gate 4 therefore executes in the administrative/owner (migration) context and reads the
manifest as owner — **not** as `service_role`. The earlier plan wording naming `service_role`
as the validating authority is superseded by this model.

Security linter after the capture: 436 issues, identical to the pre-capture baseline; no new
category and no exposure of the `audit` schema.

## 5. Next gate

Gate 4 — one audited transactional cleanup scoped to capture `9d2d21bd…`, validating the
manifest is the complete cohort at transaction time, deleting in the approved order with
per-step and final zero-reference assertions, aborting on any mismatch.
