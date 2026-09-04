# Phase 3C — Stage 1 functional self-test evidence

Harness: temporary `public._stage1_selftest()` + `public._stage1_test_results`
(postgres-owned SECURITY DEFINER, service_role only). **Dropped immediately after this
evidence was captured** — no permanent privileged mutation surface remains.

Result: **41 PASS, 0 FAIL, 1 UNVERIFIED** (run 2026-09-04).

## Scope note
This is a functional self-test only. It does NOT verify:
- real role-level table/function privileges (no `SET ROLE` inside a definer function);
- advisory-lock concurrency — explicitly recorded as **UNVERIFIED**; needs independent
  parallel sessions for insert-vs-undo, undo-vs-undo, maintenance-vs-undo, two reviews.

## Corrections applied before acceptance
1. Chronology assertion compares the stored value to `transaction_timestamp()`, because the
   production trigger uses `now()` (transaction start). Comparing against a later
   `clock_timestamp()` captured inside the harness produced false failures. Production was
   NOT changed to `clock_timestamp()`.
2. Fixture ids verified before execution: entity `9f1997f1…` exists, is not deleted and is
   type `brand` (matching the review category the subject trigger enforces); both fixture
   users exist. The fixture review is created and deleted within the same transaction.
3. LIFO fixture rows are restamped (test-only) to distinct `created_at` values. All rows
   inserted inside one transaction share `now()`, so ordering fell back to `id DESC` over
   random UUIDs — not insertion order. This was a harness artifact, but it documents a real
   property: two updates written in the same transaction tie-break by UUID, not arrival
   order. In production each update is its own transaction.

## Checks (all PASS unless noted)
- Resolver truth table, 17 cases: timeline intent beats envelope; `maybe` -> false; `auto`
  discards earlier explicit intent and falls back to rating; wrong version, type mismatch,
  non-object answers, junk answer, array envelope and null category all resolve as *absent*
  (never false); rating 4 -> true, 3.9 -> false, null -> false.
- reviews trigger: envelope "no" beats rating 5.
- Chronology: client `created_at` 2001-01-01 discarded; stored value equals
  `transaction_timestamp()`.
- `would_recommend` writable through the ordinary insert path.
- Recompute on insert: count/latest_rating/has_timeline correct; timeline "yes" overrides
  envelope "no".
- Tie-break: identical `created_at` resolved by `id DESC`; the LIFO RPC uses the same
  ordering.
- LIFO: latest "auto" falls back to rating; undoing the 3rd of 5 -> conflict, nothing
  deleted; stale id -> conflict with `latestUpdateId`; undoing the newest deletes exactly
  one row; undoing "auto" restores the previous explicit intent; `latest_rating` falls back
  to the previous rated update; emptying the timeline clears `has_timeline`,
  `timeline_count` and `latest_rating`; empty timeline restores envelope authority; further
  undo -> `not_found`.
- Authorization: non-owner undo and unauthenticated undo both raise real database errors.
- Maintenance RPC: unknown id -> not_found; deletes and recomputes; already-removed row ->
  not_found (never a false `deleted`).
- No trigger recursion on an unrelated `reviews` column update.
- RLS enabled on `review_updates`.
- Fixture cleaned up.
- **UNVERIFIED:** advisory-lock concurrency.

# Phase 3C — Stage 1 close-out verification (supplemental)

Run: 2026-09-04 after reviewer corrections.

Harness: temporary `public._stage1_closeout_results` table with RLS and a restrictive
policy, created by the migration runner, read back, then dropped. No permanent privileged
surface remains.

## Corrections applied before this close-out
1. Strict envelope `version`: only the JSON number `1` is valid. `"version": "1"` is now
   treated as malformed and resolves as *absent* (falls back to rating inference), in both
   the SQL resolver and the TypeScript resolver.
2. Shared fixture is the single file
   `src/services/review/__fixtures__/recommendationTruthTable.json`. The SQL harness payload
   is generated at run time by `scripts/build-recommendation-parity-sql.mjs`; a lock file
   `recommendationTruthTable.lock.json` records the fixture SHA-256 so drift can be detected.
3. Role checks are explicitly labelled as *database-role privilege* tests (`SET LOCAL ROLE`
   at the top level of a migration session), not genuine Supabase authenticated sessions with
   JWT claims and `auth.uid()`. The latter are reported as **UNVERIFIED** below.

## Results

### SQL/TS shared truth table parity
- Fixture SHA-256: `ba7594aa05f6ccd53c19a8b9078b4dcad42716f8bc56c937b14e5ca140ad935c`
- Cases executed: 24, declared: 24
- Mismatches: 0
- Status: **PASS**

### Database-role privilege matrix (direct table mutations)
All attempted from `anon`, `authenticated` and `service_role` via `SET LOCAL ROLE` against a
throwaway fixture row in `review_updates`:

| Check | Result |
|-------|--------|
| anon direct UPDATE | denied (42501) |
| anon direct DELETE | denied (42501) |
| anon TRUNCATE | denied (42501) |
| authenticated direct UPDATE | denied (42501) |
| authenticated direct DELETE | denied (42501) |
| authenticated TRUNCATE | denied (42501) |
| service_role direct UPDATE | denied (42501) |
| service_role direct DELETE | denied (42501) |
| fixture row survived all denied statements | PASS |
| service_role maintenance RPC (`admin_delete_review_update`) | deleted |
| maintenance RPC removed exactly the fixture row | PASS |
| authenticated maintenance RPC | denied (42501) |
| fixture cleaned up | PASS |

### Remaining UNVERIFIED
- Authenticated owner INSERT into `review_updates` via a real Supabase session (`auth.uid()`
  present).
- Authenticated owner "undo latest update" via a real Supabase session.
- Authenticated non-owner INSERT denial via a real Supabase session.
- Advisory-lock concurrency races (insert-vs-undo, undo-vs-undo, maintenance-vs-undo,
  two different reviews) with independent parallel sessions.

These require genuine authenticated Supabase client sessions or parallel database sessions
and are not covered by the single-session migration harness.

