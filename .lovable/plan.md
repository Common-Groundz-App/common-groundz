# Phase 2.4 — Realtime, final

Both reviews approved the architecture. Codex's four corrections are all valid — I verified each against the live project rather than taking them on trust:

- **Flag system genuinely does not support new keys.** `set_app_flag` hardcodes an 11-key allowlist (`mux.*`, `entity_extraction.*`, `search_to_draft.*`) and raises `unknown_key` for anything else. `get_public_flags()` builds its JSON literally from three `mux.*` rows — a new `app_config` row would be invisible to clients. `useAppConfig`'s `PublicFlags`/`DEFAULTS` only model `mux`, and `useAppFlagsAdmin` filters on its own `ALLOWED_KEYS`. So a kill switch is five coordinated edits, not one row.
- **The publication guard was unqualified.** Corrected to check `n.nspname = 'public'`.
- **Browser test deps were unnecessary.** Every suite in this phase is pure TypeScript. Dropped `jsdom` and both Testing Library packages.
- **Hook ownership was split.** Corrected to `NotificationsProvider → useNotifications → useNotificationsRealtime`.

I'm also taking ChatGPT's note on the Vitest `include` list, and Codex's flag-loading lifecycle clarification. Two things of my own at the end.

**Decision on the kill switch:** implement it fully. Codex is right that a half-wired flag is worse than none, and this is a change to how notifications are *delivered* — exactly the case where an instant rollback is worth the five edits.

---

## Step 0 — Real test harness (blocking)

- devDependencies: **`vitest` only**. No `jsdom`, no `@testing-library/*` — nothing in this phase renders a component or touches the DOM. If hook-level tests are added in a later phase, that phase adds a DOM environment then.
- `vitest.config.ts` (separate from `vite.config.ts`, so Vite's config typing can't hide a `test` key): `globals: true`, `environment: 'node'`, and an explicit `include` list of the suites that are real today — `notificationGrouping`, `notificationDestination`, `notificationRealtime` (new), plus `brandTextHelpers`, `renderBranching`, `useMuxStatus`. A comment records **why** the broad `src/**/*.test.ts` glob isn't used yet (placeholder/`.ts` scratch files would break the run) and that it should be broadened once those are cleaned up.
- `"test": "vitest run"` in `package.json`.
- Delete the `typeof describe === 'function'` guards from `notificationGrouping.test.ts` and `notificationDestination.test.ts`; import from `vitest` directly so a missing runner fails loudly instead of silently passing.
- Gate: the run must report **non-zero** test counts for each included file. Anything that fails once the runner actually executes is fixed before realtime work starts.

## Step 2 — Pure payload layer (before any socket code)

New `src/utils/notificationRealtime.ts` — no React, no Supabase imports:

- `validateRealtimePayload(raw, expectedUserId)` → `Notification | null`. Rejects an invalid/missing `id`, a `user_id` mismatch, and any `created_at` that `tryCursorKey` cannot key (Phase 2.1 refuses malformed timestamps into sort logic).
- `classifyInsert(row, loadedRows)` → `'above-head' | 'within-window' | 'below-window' | 'duplicate'`, via the existing `compareCursorKeys` / `isNewerOrEqual` / `isOlderThan` — never `Date` round-trips.
- `mergeRealtimeInsert` / `mergeRealtimeUpdate`: pure updaters delegating to `mergeNotifications` so the monotonic-`is_read` rule and `compareNotifications` ordering stay in one place.
  - Above head or within window → merge by id. Below window or unclassifiable → **no insert**, queue one reconcile. Duplicate → no-op.
  - The pagination cursor is **never** derived or moved from a realtime row.
  - UPDATE patches only already-loaded rows; an UPDATE for an unloaded row patches nothing but still sets the count dirty.
- Unit tests: classification, duplicates, monotonic read merge, user mismatch, unparseable timestamps, and the coalescing reducer.

## Step 1 — Migration (schema-qualified, guarded)

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

Same migration also extends the flag plumbing (Step 3a). No RLS, grant, or trigger changes — the existing `auth.uid() = user_id` SELECT policy already scopes realtime rows server-side.

## Step 3a — Kill switch, end to end

1. Insert `app_config` key `notifications.realtime_enabled` = `{"enabled": true}`.
2. Add that key to `set_app_flag`'s allowlist **and** a validation branch requiring exactly `{ enabled: boolean }`.
3. Extend `get_public_flags()` to return a `notifications: { realtime_enabled }` object, defaulting `true` when the row is absent.
4. `useAppConfig`: add `notifications` to `PublicFlags` and `DEFAULTS`, and to the parse in `fetchPublicFlags`.
5. `useAppFlagsAdmin` `ALLOWED_KEYS` + `AdminFeatureFlagsPanel` `PendingChange` union and a toggle row, matching the existing flag rows.

Because `get_public_flags` is `SECURITY DEFINER`, ordinary signed-in clients can read the switch without any `app_config` SELECT grant.

## Step 3b — Transport hook

New `src/hooks/notifications/useNotificationsRealtime.ts`, **transport only**, called from `useNotifications` (never the provider directly), giving:

```text
NotificationsProvider
└── useNotifications          (owns commit/drop/reconcile/count/poll decisions)
    └── useNotificationsRealtime  (owns the socket, nothing else)
```

Exactly one channel, because there is exactly one `useNotifications` instance (already ESLint-enforced). Channel per signed-in user, filtered `user_id=eq.<uid>`, `INSERT` + `UPDATE` only — no `DELETE` (RLS is not applied to DELETE events). Subscribe inside `useEffect`, clean up with `supabase.removeChannel`. Every payload carries the channel's generation token and is discarded if the channel or user has been replaced. The existing `realtimeService` singleton is deliberately unused — it keys channels by `Date.now()` and has no generation guard.

## Step 4 — Readiness state machine, flag-aware

```text
flag loading / error / off  → no channel, current fast poll
flag on → connect → SUBSCRIBED → reconciling → ready → 60s safety poll
```

No channel is ever created while the flag value is unresolved, so a placeholder default can't open a socket that must immediately be torn down.

- Every `SUBSCRIBED` (initial or rejoin) enters **reconciling**; payloads there set dirty flags instead of merging.
- **ready** only after reconciliation succeeds *and* the same user + generation still owns the channel.
- `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` → **disconnected**, fast poll resumes immediately.
- Visibility regain reconciles before payloads are trusted again.
- 60s polling applies only in **ready**.

## Step 5 — Burst coalescing

One trailing scheduler, two dirty flags (`headDirty`, `countDirty`), ~250ms debounce. A server mark-all emitting 50 UPDATEs produces **one** head refresh and **one** count RPC. Reconcile fires only after the existing mutation / pagination / recovery gates release (release-before-reconcile); while a gate is held, payloads go into the flags rather than into state. Channel, debounce timer, and in-flight callbacks are all cancelled on sign-out, account switch, flag-off, and unmount.

## Two additions of my own

1. **Dev-only single-channel assertion.** A module-level counter that warns in development if a second notifications channel is ever created for the same user — same spirit as the ESLint rule keeping `useNotifications` single-instance. Makes the invariant self-policing instead of manual-test-only.
2. **A one-line realtime status in the drawer footer, dev-only.** `ready / reconciling / disconnected / off`. Without it, "realtime isn't working" and "realtime is working and the poll is what you're seeing" are indistinguishable during your two-browser testing.

## Step 6 — Docs

Append Phase 2.4 to `docs/NOTIFICATION_CENTER_ROADMAP.md`: the readiness state machine, the flag-loading lifecycle, and the invariant that **realtime is a hint layer and the RPC unread count stays authoritative**.

## Manual verification matrix (yours to run)

1. Two browsers, two accounts: B likes A's post → A's bell and drawer update with no refresh.
2. A never receives an event belonging only to B.
3. Mark-all in one tab clears badge and list in another — Network panel shows **one** count RPC, not a storm.
4. Disconnect 30s, generate 2 events, reconnect → both appear after reconcile, no duplicates, count matches.
5. Load 3 pages deep, receive a new event → lands at top; loaded window not reordered, blanked, or re-cursored.
6. Sign out, sign in as another account → exactly one channel in the WS frames, no cross-account rows.
7. Toggle the flag off in the admin panel → behaviour returns to today's polling baseline within one poll cycle, no reload needed.

## Out of scope

DELETE events, server-side grouping, per-type preferences (2.3b), the `/notifications` route, rich previews, date sections, web push.

## Order of work

Step 0 → Step 2 (pure + tests) → Step 1 + 3a (migration + flag) → Step 3b → Step 4 → Step 5 → additions → tests + manual matrix → Step 6.
