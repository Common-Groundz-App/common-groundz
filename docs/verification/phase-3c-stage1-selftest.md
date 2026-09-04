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
