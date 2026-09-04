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

### 2. Migration — authorization (corrected: no session flag anywhere)

- Drop the three permissive write policies. Replace with a single INSERT policy
  `TO authenticated`: `user_id = auth.uid()` **and** the parent review is owned by
  `auth.uid()`. No ordinary UPDATE or DELETE policy exists at all.
- **Table-level privilege boundary, not a flag.** `REVOKE UPDATE, DELETE ON
  public.review_updates FROM anon, authenticated` (and PUBLIC). Ordinary roles then
  lack the SQL privilege entirely, so a direct `UPDATE`/`DELETE` fails on privileges
  before RLS is even consulted. The `SECURITY DEFINER` RPCs run as the function owner,
  which retains the privilege — that is the capability boundary, and it cannot be
  manufactured by a client under any session state.
- **The session-level/GUC guard flag is removed from the design.** A client-settable
  custom setting is not a capability and must never authorize a privileged mutation.
  The owner RPC (`authenticated` grant) and the maintenance RPC (`service_role` grant)
  are the only reachable mutation surfaces; there is no bypass path to guard.
  Defense-in-depth comes from privileges + absent policies, both of which are
  enforced by the database and unaffected by session variables.
- SELECT stays as-is (timelines are publicly readable, matching reviews).


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

### 8. Verification before Stage 2 starts (v5 coverage restored)

**Whole-dataset before/after parity.** Snapshot every existing review
(`review_id, is_recommended, trust_score, latest_rating, timeline_count,
has_timeline`) immediately before the migration and again after, and prove **zero**
differences. Deploying the migration must not touch a single existing row.

**Stage 1 is not a backfill.** The known sticky `has_timeline` rows are repaired only
when a later timeline mutation recomputes that review. Any pre-existing inconsistency
found by the snapshot is **reported, not silently corrected**; repairing historical
data would be a separate, explicit decision.

**Resolver parity.** Resolved `is_recommended` matches the stored column for every
existing review (expected 0 deviations — no `would_recommend` data exists yet), and
the shared truth-table fixture is green in both Vitest and the SQL/Deno runner.

**Deterministic ordering.** A fixture with two timeline rows sharing an identical
`created_at` proves the SQL resolver, the TypeScript resolver and the LIFO undo all
select the same row under `created_at DESC, id DESC`.

**Authorization.**
- Insert onto another user's review is denied.
- Direct `UPDATE` is denied; direct single-row `DELETE` is denied; bulk
  `DELETE ... WHERE review_id = ...` is denied.
- A test sets plausible guessed guard settings (e.g. `set_config` of any
  timeline-looking custom GUC) and proves it still cannot perform a direct
  `UPDATE`/`DELETE` — the privilege boundary is unaffected by session state.

**LIFO.** Undoing the newest returns `deleted` and rolls derived state back exactly one
step; undoing the 3rd of 5 returns `conflict`; a stale `p_expected_update_id` returns
`conflict` with the current `latestUpdateId` and deletes nothing; undoing an `auto` row
restores the previous explicit intent; undoing the last remaining update makes the
original envelope answer authoritative again.

**Concurrency** (the reason the advisory lock exists):
- insert vs undo on the same review — serialized, aggregates consistent;
- two simultaneous undos on the same review — one `deleted`, one `conflict`;
- maintenance removal vs owner undo on the same review — serialized, consistent;
- mutations on two different reviews — proceed in parallel, no cross-blocking.

**Recompute.** Deleting the only update sets `has_timeline = false`,
`timeline_count = 0`, `latest_rating = null` and `is_recommended` back to the rating
rule; deleting the latest *rated* update falls `latest_rating` back to the previous
rated update (or null); an unrelated-column update on `reviews` produces exactly one
recomputation (no recursion).

**Chronology.** A client-supplied `created_at` does not survive; the persisted value is
server-generated. Old clients omitting `would_recommend` still insert successfully.

**Privilege.** `anon` and `authenticated` cannot execute the recompute function, the
lock helper, the resolver internals or the maintenance RPC; only `authenticated`
reaches the undo RPC and only `service_role` reaches maintenance.

Finally: regenerate `src/integrations/supabase/types.ts`, then **stop** and report the
migration, parity, authorization, privilege, resolver, recompute and concurrency
results before Stage 2 begins.

### 9. Three additions of my own

- **Insert-path privilege check for the new column.** `would_recommend` must be
  writable by the ordinary insert path (Stage 3 sends it), so the column-level grant is
  verified explicitly — a table-level `REVOKE UPDATE` must not accidentally break
  inserts that include it.
- **Client callers left untouched but audited.** `addReviewUpdate` in
  `src/services/review/timeline.ts` is the only insert path in the app; Stage 1 changes
  no signature, but a test asserts it still succeeds for the review owner and now fails
  for a non-owner. No other `src/` code writes `review_updates`.
- **Roadmap bookkeeping.** `roadmap.md` Stage 1 checkboxes are updated to name the
  privilege-boundary decision (table-level REVOKE, no GUC guard) and the
  parity/concurrency acceptance set, so the frozen contract is recorded where the next
  session will read it.


## Out of scope for Stage 1

No `would_recommend` UI, no `CuratedTagSelector`, no registry entries, no Convert-button
removal (Stage 3), no `is_converted` decision (Phase 3D). No writes to
`metadata.questionnaire` yet.
