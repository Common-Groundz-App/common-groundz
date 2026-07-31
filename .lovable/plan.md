# Phase 2.4 — Realtime, revised

Both reviews are right and I'm folding all of their corrections in. Two of their claims I verified directly:

- **Vitest is genuinely not installed.** `package.json` has no `vitest`/`jsdom` devDependency and no `test` script — my earlier run only worked because `npx` fetched vitest on the fly. So Step 0 is a real install, not a config tweak.
- **RLS on `notifications` is correct for realtime.** The SELECT policy is `auth.uid() = user_id`, so Postgres Changes will filter server-side; the client `user_id=eq.<uid>` filter is an optimisation, not the boundary. Confirmed the `supabase_realtime` publication is currently empty.

I agree with every refinement raised: idempotent publication migration, payload validation + generation guard, a three-state readiness machine instead of a bare `isSubscribed`, precise INSERT window semantics, and burst coalescing. Two additions of my own are at the end.

---

## Step 0 — A real, failing-capable test harness (blocking)

- Add devDependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
- Add `vitest.config.ts` (separate from `vite.config.ts`, so Vite typing doesn't hide the `test` key) with `globals: true`, `environment: 'node'`, and `include` scoped to the notification suites plus the other real suites already in the repo — not a blanket `src/**/*.test.ts`, to avoid dragging in unrelated placeholder files.
- Add `"test": "vitest run"` to `package.json`.
- Delete the `declare const describe: undefined` / `typeof describe === 'function'` guards from `notificationGrouping.test.ts` and `notificationDestination.test.ts` and import from `vitest` directly, so a missing runner fails loudly instead of silently passing.
- Assert the suites actually register: the run must report non-zero test counts for both files. Any failure surfaced here is fixed before realtime work starts.

## Step 1 — Migration (guarded)

```sql
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
```

No schema, RLS, or grant changes.

## Step 2 — Pure, tested payload layer (before any socket code)

New `src/utils/notificationRealtime.ts`, no React and no Supabase imports:

- `validateRealtimePayload(raw, expectedUserId)` → `Notification | null`. Rejects a missing/invalid `id`, a `user_id` mismatch, a missing or unparseable `created_at` (Phase 2.1 refuses malformed timestamps into sort logic), and anything failing the lane's own field expectations.
- `classifyInsert(row, loadedRows)` → `'above-head' | 'within-window' | 'below-window' | 'duplicate'`, using the existing precision-safe `compareCursorKeys` — never `Date` round-trips.
- `mergeRealtimeInsert` / `mergeRealtimeUpdate`: pure updaters.
  - INSERT above head or within the loaded window → merge by id, sorted with the comparator. Below the window or unclassifiable → **no direct insert**, queue one reconcile. Duplicate id → no-op.
  - The server pagination cursor is **never** derived or moved from a realtime row.
  - UPDATE patches only already-loaded rows; `is_read: true` stays monotonic. An UPDATE for an unloaded row patches nothing but still marks the count dirty.
- Unit tests for all of the above, plus the coalescing reducer below.

## Step 3 — Subscription hook with channel ownership

New `src/hooks/notifications/useNotificationsRealtime.ts`, mounted **only** from `NotificationsProvider` (never the drawer, never a tab). One channel per signed-in user, filtered `user_id=eq.<uid>`, `INSERT` and `UPDATE` only — no `DELETE` (RLS is not applied to DELETE events). Subscribe inside `useEffect`, cleanup with `supabase.removeChannel`. Every payload carries the channel's generation token; a payload from a replaced or removed channel is discarded before it reaches any updater. The existing `realtimeService` singleton is deliberately not used — it keys channels by `Date.now()` and offers no generation guard.

## Step 4 — Readiness state machine

`realtimeState: 'disconnected' | 'reconciling' | 'ready'`, owned by `useNotifications`:

- Every `SUBSCRIBED` event (initial or rejoin) enters **reconciling**.
- In reconciling, payloads are not merged — they set the dirty flags and collapse into one trailing reconcile.
- Enter **ready** only if reconciliation succeeds *and* the same user + channel generation still owns the subscription.
- `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` → **disconnected**, fast poll resumes immediately.
- The 60s poll interval applies only in **ready**; reconciling and disconnected keep the current fast interval.

## Step 5 — Burst coalescing

A single trailing scheduler with two dirty flags (`headDirty`, `countDirty`) and one short debounce window (~250ms). A server mark-all that emits 50 UPDATE rows produces **one** head refresh and **one** count RPC. Reconcile only fires after the existing mutation/pagination/recovery gates release (release-before-reconcile), and while a gate is held the payload is dropped into the flags rather than merged.

## Two additions of my own

1. **Dev-only single-channel assertion.** A module-level counter that warns in development if a second notifications channel is ever created for the same user — the same spirit as the existing ESLint rule that keeps `useNotifications` single-instance. Cheap, and it makes the "exactly one channel" invariant self-policing instead of manual-test-only.
2. **A kill switch.** Gate the subscription behind the existing app-flag mechanism (`useAppConfig` / `AdminFeatureFlagsPanel`), defaulting on. If realtime misbehaves in production, you turn it off and fall straight back to the polling path that is shipping today — no redeploy.

## Step 6 — Docs

Append Phase 2.4 to `docs/NOTIFICATION_CENTER_ROADMAP.md`, including the readiness state machine and the invariant that realtime is a hint layer and the RPC count stays authoritative.

## Manual verification matrix (yours to run)

1. Two browsers, two accounts: B likes A's post → A's bell and drawer update without refresh.
2. A never receives an event belonging only to B (RLS boundary).
3. Mark-all in one tab clears badge and list in another — check the Network panel shows **one** count RPC, not a storm.
4. Disconnect 30s, generate 2 events, reconnect → both appear after the reconcile, no duplicates, count matches.
5. Load 3 pages deep, receive a new event → it lands at the top; the loaded window is not reordered, blanked, or re-cursored.
6. Sign out and in as another account → old channel gone, exactly one new channel in the WS frames, no cross-account rows.
7. Toggle the kill switch off → behaviour returns to the current polling baseline.

## Out of scope

DELETE events, server-side grouping, per-type preferences (2.3b), the `/notifications` route, rich previews, date sections, web push.

## Order of work

Step 0 → Step 2 (pure + tests) → Step 1 (migration) → Step 3 → Step 4 → Step 5 → additions → tests + manual matrix → docs.
