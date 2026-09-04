# Phase 3C — Stage 1: recommendation & timeline database foundation

Stage 0 is complete and frozen (vocabulary doc corrected, roadmap ticked, docs only).
Stage 1 is strictly database, security and resolver work — no questionnaire UI.

## Current state (verified against the live database)

- `review_updates` has: `id`, `review_id`, `user_id`, `rating`, `comment`, `created_at`,
  `updated_at`, `media`. There is **no** `would_recommend` column.
- Policies are all `TO public` and permissive: insert/update/delete gated only on
  `auth.uid() = user_id` — a user can insert an update onto **any** review as long as
  they put their own id in `user_id`, and can delete or edit any of their own updates
  anywhere in the timeline (no LIFO, no ownership-of-parent check).
- Three triggers fire on `review_updates`: `update_updated_at_column` (BEFORE UPDATE),
  `update_review_timeline_stats` (AFTER INSERT OR DELETE), and
  `update_review_timeline_stats_enhanced` (AFTER INSERT only).
- Two confirmed defects in the existing stats triggers:
  1. `update_review_timeline_stats` reads `NEW.review_id` but is also attached to
     `DELETE`, where `NEW` is null — the delete path raises instead of recomputing.
  2. Both set `has_timeline = true` unconditionally, so deleting the last update
     leaves the review permanently flagged as having a timeline, and
     `latest_rating` is only recomputed on INSERT, never after a delete.
- `reviews` recomputes `is_recommended` on every write from
  `COALESCE(latest_rating, rating) >= 4` via two BEFORE triggers
  (`auto_recommend_review` on rating changes, `auto_recommend_review_timeline_aware`
  on all writes). `calculate_trust_score` = 1.0 + 0.1/update (max +0.5) +0.3 if
  verified, capped at 2.0.

## What Stage 1 delivers

### 1. Migration — schema
- `review_updates.would_recommend text NULL` with
  `CHECK (would_recommend IN ('yes','maybe','no','auto'))`.
- Partial index on `(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`
  for the latest-intent lookup.

### 2. Migration — authorization
- Drop the three permissive write policies. Replace with a single INSERT policy
  `TO authenticated`: `user_id = auth.uid()` **and** the parent review is owned by
  `auth.uid()`. No ordinary UPDATE or DELETE policy exists at all — the only delete
  path is the owner RPC below, the only maintenance path is `service_role`.
- SELECT stays as-is (timelines are publicly readable, matching reviews).
- A guard trigger blocks any UPDATE/DELETE that is not performed by the sanctioned
  RPCs (session-level flag set inside those definer functions), so a future policy
  mistake cannot silently reopen mid-timeline edits.

### 3. Migration — server-owned chronology
- `BEFORE INSERT` trigger overwrites `created_at` and `updated_at` with `now()`.
  Client-supplied timestamps are silently replaced, not rejected; a test asserts the
  persisted value is server-generated.

### 4. Migration — shared lock + atomic LIFO undo
- One shared lock-key helper deriving a `bigint` from the review UUID (same
  convention already used by `create_entity_subject`), taken with
  `pg_advisory_xact_lock`. Insert trigger, undo RPC and maintenance RPC all call it
  **before** any timeline read or mutation.
- `delete_latest_review_update(p_review_id uuid, p_expected_update_id uuid)`:
  authenticate from `auth.uid()`, require review ownership, take the lock, resolve the
  newest update (`created_at DESC, id DESC`), require it to equal
  `p_expected_update_id`, delete that one row, recompute, return
  `{ status: 'deleted' | 'conflict' | 'not_found', deletedUpdateId?, latestUpdateId? }`.
  Authorization failures are raised as real database errors, never a soft status.
- A `service_role`-only maintenance removal function for cleanup, with no
  `current_user` checks inside the definer body (privilege enforced by GRANT).

### 5. Migration — recompute correctness
- One shared recompute function taking `p_review_id`, recomputing `latest_rating`,
  `timeline_count`, `has_timeline` (**false when the count is zero**), `trust_score`
  and the resolved `is_recommended`, called after every insert and after the row is
  actually deleted. Recursion-safe via trigger column gating.
- Consolidate the two overlapping stats triggers into this one path, fixing the
  DELETE `NEW`-null defect and the sticky `has_timeline`. Trust-score values are
  preserved exactly (same formula).

### 6. Recommendation resolver (SQL + TypeScript, one shared fixture)
Precedence, unchanged from the frozen contract:
1. latest timeline intent (`review_updates.would_recommend`, `created_at DESC, id DESC`)
2. the review's own envelope answer
3. `COALESCE(latest_rating, rating) >= 4`

`maybe` → `false`; `auto` discards all earlier explicit intent and falls through to
the rating rule; strict envelope validation (a malformed envelope is treated as
absent, never as `false`). A pure resolver plus a review-aware wrapper
(`lookupLatestRecommendationIntent`) on both sides, driven by the **same** truth-table
fixture so SQL and TS cannot drift. Source is derived on demand, never cached.

### 7. Privilege hardening (blocks Stage 1 completion)
- `REVOKE ALL ... FROM PUBLIC` on every function created or replaced here.
- Undo RPC → `authenticated` only. Maintenance RPC → `service_role` only. Lock
  helper, recompute function and resolver internals → no caller-facing role.
- Privilege tests assert `anon` and `authenticated` cannot call the internals or the
  maintenance path.

### 8. Verification before Stage 2 starts
- Whole-dataset drift check: resolved `is_recommended` matches the stored column for
  every existing review (expected: 0 deviations, since no `would_recommend` data
  exists yet).
- Authorization: insert onto someone else's review fails; direct UPDATE/DELETE fails.
- LIFO: undoing the newest succeeds; undoing the 3rd of 5 returns `conflict`;
  stale `p_expected_update_id` returns `conflict`.
- Recompute: deleting the only update sets `has_timeline = false`, `timeline_count = 0`,
  `latest_rating = null`, and `is_recommended` back to the rating rule.
- Chronology: a client-supplied `created_at` does not survive.
- Privilege: internals unreachable from `anon`/`authenticated`.
- Regenerate `src/integrations/supabase/types.ts` after the migration.

## Out of scope for Stage 1

No `would_recommend` UI, no `CuratedTagSelector`, no registry entries, no Convert-button
removal (Stage 3), no `is_converted` decision (Phase 3D). No writes to
`metadata.questionnaire` yet.
