# Phase 2.4 — Realtime notifications (final)

Both reviewers approve the architecture. Codex's four corrections and ChatGPT's five safeguards are all valid — I verified each against the code rather than accepting them on trust:

- **Validation was too narrow.** `Notification` has 14 fields (`type` union, `entity_type` union, `is_read`, `updated_at`, `sender_id`, `entity_id`, `metadata`, …). Validating only `id`/`user_id`/`created_at` would let a malformed row reach grouping, copy formatting, and destination resolution. Corrected: full runtime boundary.
- **`loadedRows` is not the pagination boundary.** `useNotificationLane` already owns `serverCursorRef` — the real boundary, set only by successful server pages. Rendered rows are polluted by realtime merges, read reconciliation, and sticky unread rows. Corrected: classify against `serverCursorRef`.
- **`placeholderData` would activate realtime early.** `useAppConfig` passes `placeholderData: DEFAULTS`, so `data.notifications.realtime_enabled` reads `true` during the very first load. Corrected: gate on query *status*, never on `data` alone.
- **The dev footer needs real plumbing.** Status must travel hook → `UseNotificationsResult` → context → drawer. Those files are now in scope, and the channel counter is token-aware so Strict Mode and HMR can't produce false warnings.

Everything below is the complete, final spec. No further planning round.

---

## Step 0 — Real test harness (hard blocker)

- devDependency: **`vitest` only**. No `jsdom`, no `@testing-library/*` — every suite in this phase is pure TypeScript. Fake timers are built into Vitest.
- `vitest.config.ts` (separate file, so Vite's config typing can't silently swallow a `test` key): `globals: true`, `environment: 'node'`, explicit `include` list — `notificationGrouping`, `notificationDestination`, `notificationRealtime` (new), `brandTextHelpers`, `renderBranching`, `useMuxStatus`. A comment records why the broad `src/**/*.test.ts` glob isn't used yet (non-test scratch files would break the run) and that it should be broadened once those are cleaned up.
- `"test": "vitest run"` in `package.json`.
- Delete the `typeof describe === 'function'` guards from `notificationGrouping.test.ts` and `notificationDestination.test.ts`; import from `vitest` directly so a missing runner fails loudly instead of passing silently.
- **Gate:** the run must report non-zero test counts per included file. Any failure exposed by the runner finally executing is fixed *before* a single line of realtime code is written.

## Step 1 — Pure realtime layer (before any socket code)

New `src/utils/notificationRealtime.ts` — no React, no Supabase imports, fully unit-testable.

### Full payload validation

`validateRealtimePayload(raw, expectedUserId): Notification | null` — returns `null` (dropped, counted in a dev warning) unless **all** hold:

- `id` and `user_id` are valid UUIDs; `user_id === expectedUserId`.
- `type` is in the `NotificationType` union; `entity_type`, when present, is in the `EntityType` union.
- `created_at` and `updated_at` both pass `tryCursorKey` (microsecond-safe, no `Date` round-trip).
- `is_read` is a boolean.
- `title` and `message` are strings.
- `sender_id` / `entity_id`, when present, are valid UUIDs; `image_url` / `action_url` are string-or-null; `metadata` is a plain object or absent.

Unknown extra keys are stripped rather than passed through, so nothing untyped reaches the UI.

### Cursor-boundary classification

`classifyInsert(row, { serverCursor, hasMore, knownIds })` → `'above-head' | 'within-window' | 'below-window' | 'duplicate'`:

- `duplicate` if the id is already loaded.
- `below-window` if `hasMore` and the row is older than `serverCursor` — the row belongs to an unfetched page, so **no insert**; set `countDirty` only.
- Otherwise `within-window` / `above-head` via `compareCursorKeys`.
- If `serverCursor` is `null` and `hasMore` is true, classification is *unknown* → no merge, queue a reconcile. Never guess.
- The lane's `serverCursorRef` is passed **in**; this module can neither read nor write it. No realtime row ever moves a cursor.

### Merge helpers

`mergeRealtimeInsert` / `mergeRealtimeUpdate` are pure updaters delegating to the existing `mergeNotifications`, so the monotonic-`is_read` rule and `compareNotifications` ordering stay in exactly one place. UPDATE patches only already-loaded rows; an UPDATE for an unloaded row patches nothing but still sets `countDirty`.

### Tests

Field-by-field validation rejection, user mismatch, microsecond timestamps, all four classification outcomes, the unknown-boundary case, duplicates, monotonic read merge, and unloaded-row UPDATE.

## Step 2 — Migration (schema-qualified, guarded) + flag row

```sql
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c       ON c.oid  = pr.prrelid
    JOIN pg_namespace n   ON n.oid  = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
```

No RLS, grant, or trigger changes — the existing `auth.uid() = user_id` SELECT policy already scopes realtime rows server-side. The same migration extends the two flag functions (Step 3).

## Step 3 — Kill switch, end to end

1. `app_config` row `notifications.realtime_enabled` = `{"enabled": true}`.
2. `set_app_flag`: add the key to the allowlist **and** a validation branch requiring exactly `{ enabled: boolean }` — matching the strictness of every existing branch, rejecting any other shape.
3. `get_public_flags()`: return `notifications: { realtime_enabled }`, defaulting `true` when the row is absent. It is `SECURITY DEFINER`, so ordinary clients read it without any `app_config` grant.
4. `useAppConfig`: add `notifications` to `PublicFlags`, `DEFAULTS`, and the `fetchPublicFlags` parse.
5. `useAppFlagsAdmin` `ALLOWED_KEYS` + `AdminFeatureFlagsPanel` `PendingChange` union and a toggle row, matching existing flag rows.

### Readiness gate — status, not data

```ts
const { data, status, isPlaceholderData } = useAppConfig();
const realtimeAllowed =
  status === 'success' && !isPlaceholderData && data.notifications.realtime_enabled === true;
```

- Loading, error, or placeholder → **no channel**, current fast polling. A default value can never open a socket that must immediately be torn down.
- A *background refetch failure* after a successful resolve keeps the last confirmed value (React Query retains `data`); realtime stays up rather than flapping on a transient network blip.
- Flag flipping to `false` closes the channel and resumes fast polling within one render — no reload.

## Step 4 — Transport hook

New `src/hooks/notifications/useNotificationsRealtime.ts`, **transport only**, called from `useNotifications` — never from the provider:

```text
NotificationsProvider
└── useNotifications              (owns commit / drop / reconcile / count / poll decisions)
    └── useNotificationsRealtime  (owns the socket, nothing else)
```

One channel, because there is exactly one `useNotifications` instance (already ESLint-enforced). Channel keyed per signed-in user, filtered `user_id=eq.<uid>`, `INSERT` + `UPDATE` only — no `DELETE` (RLS is not applied to DELETE payloads). Subscribe inside `useEffect`, tear down with `supabase.removeChannel`. Every callback checks a generation token and drops payloads from a superseded channel or user. Teardown on sign-out, account switch, flag-off, and unmount. The existing `realtimeService` singleton is deliberately unused — it keys channels by `Date.now()` and has no generation guard.

## Step 5 — Readiness state machine

```text
flag loading / error / placeholder / off → no channel, 10s poll
flag confirmed on → connect → SUBSCRIBED → reconciling → ready → 60s safety poll
CHANNEL_ERROR / TIMED_OUT / CLOSED       → disconnected, 10s poll
```

- Every `SUBSCRIBED` — initial *and* rejoin — enters **reconciling**; payloads there set dirty flags instead of merging.
- **ready** only after reconciliation succeeds *and* the same user + generation still owns the channel.
- Visibility regain reconciles before payloads are trusted again.
- 60s polling applies only in **ready**.

## Step 6 — Burst coalescing

One trailing scheduler, two dirty flags (`headDirty`, `countDirty`), ~250ms debounce. A mark-all emitting 50 UPDATEs produces **one** head refresh and **one** count RPC. Reconcile fires only after the existing mutation / pagination / recovery gates release; while a gate is held, payloads accumulate in the flags. Channel, timer, and in-flight callbacks all cancel on sign-out, account switch, flag-off, and unmount.

### Scheduler tests with fake timers

Not just the reducer — the integrated scheduler, using `vi.useFakeTimers()`:

- 50 UPDATE callbacks → exactly one scheduled flush.
- Both flags dirty → exactly one head fetch and one count RPC.
- Gate held → zero calls, flags still pending.
- Gate releases → exactly one trailing flush.
- Account switch / flag-off / unmount → timer cancelled, zero calls.
- Events arriving *during* a running reconcile → exactly one later trailing reconcile.

Still pure — no DOM needed.

## Step 7 — Development diagnostics

1. **Token-aware single-channel assertion.** A module-level registry keyed by user id storing the current generation token. It warns only when a *second live* channel exists for the same user with a different token — so Strict Mode double-mount, HMR, and legitimate channel replacement stay silent. Registry entry cleared in the same cleanup that removes the channel.
2. **Dev-only status line in the drawer footer** — `ready / reconciling / disconnected / off`. Explicitly plumbed: `useNotifications` returns `realtimeStatus`, added to `UseNotificationsResult`, to the `NotificationsData` `Pick` in `NotificationsContext`, and consumed by `NotificationDrawer` behind `import.meta.env.DEV`. Production users never see it. Without this, "realtime is broken" and "realtime works and you're watching the poll" are indistinguishable during your two-browser testing.

## Step 8 — Docs

Append Phase 2.4 to `docs/NOTIFICATION_CENTER_ROADMAP.md`: the readiness state machine, the flag-readiness lifecycle, and the standing invariants — **realtime is a hint layer, the RPC unread count is authoritative, and pagination cursors move only on successful server pages.**

## Manual verification matrix (yours to run)

1. Two browsers, two accounts: B likes A's post → A's bell and drawer update with no refresh.
2. A never receives an event belonging only to B.
3. Mark-all in one tab clears badge and list in the other — Network panel shows **one** count RPC, not a storm.
4. Disconnect 30s, generate 2 events, reconnect → both appear after reconcile, no duplicates, count matches.
5. Load 3 pages deep, receive a new event → lands at top; loaded window not reordered, blanked, or re-cursored.
6. Sign out, sign in as a different account → exactly one channel in the WS frames, no cross-account rows, no duplicate-channel warning.
7. Toggle the flag off in the admin panel → channel closes, polling baseline resumes, **no reload**.
8. Hard-reload with a throttled network → no channel opens until the flag query resolves.

## Out of scope

DELETE events, server-side grouping, per-type preferences (2.3b), the `/notifications` route, rich previews, date sections, web push.

## Order of work

Step 0 → Step 1 (pure + tests) → Step 2 + 3 (migration + flag) → Step 4 → Step 5 → Step 6 (+ fake-timer tests) → Step 7 → full test run + manual matrix → Step 8.
