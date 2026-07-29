## What changed and why (final)

Six corrections folded in. Two were real bugs:

**Retry deadlock (Codex #1).** I wrote "`loadMore()` no-ops when `pageError` is set" *and* "Retry calls `loadMore` on the same cursor" — the Retry button would have been permanently inert. Fixed with an explicit `force` path: `loadMore({ force: true })` clears `pageError` first, then runs. The observer always calls the unforced variant, so it can never retry-loop on a broken cursor; only the button can.

**Cursor precision loss (Codex #3).** `new Date('...T10:00:00.123456Z').toISOString()` → `.123Z`. Truncating the boundary either re-returns or skips rows sharing that millisecond. Fixed: the cursor stores the **exact string Supabase returned**, byte for byte, never re-serialized. Validation is shape-only (regex + a strict calendar check on the date part), never a canonicalizing round-trip.

Also accepted: `markingAsRead` in the Mark-all disabled condition (Codex #2 — the hook already refuses, but the UI shouldn't offer a button that only produces a toast); `refreshHead()` / `refreshUnreadCount()` as separate functions so post-mutation reconciliation can't fire two count RPCs (Codex #4); and the strict authoritative-only guard on the mismatch banner (ChatGPT) so a count failure never renders a scary "some notifications may not be shown".

**One addition of my own:** the mismatch banner also requires `countStatus === 'ready'` *and* no gates held at render time, otherwise it can flash mid-mark-all when `unreadCount` is optimistically 0.

---

## Phase 2.1 — Global count, server mark-all, cursor pagination

### 1. Migration (runs first, alone, before any calling code)

**Index**
`idx_notifications_user_created` on `public.notifications (user_id, created_at DESC, id DESC)` — serves both the head query and every keyset page.

**`public.get_unread_notification_count()` → `bigint`**
`SECURITY INVOKER`, `STABLE`, `SET search_path = ''`, fully-qualified `public.notifications`, predicate `user_id = auth.uid() and is_read = false`. No caller-supplied user id.

**`public.mark_all_notifications_as_read()` → `bigint`**
`SECURITY INVOKER`, `VOLATILE`, `SET search_path = ''`, sets `is_read = true, updated_at = now()` where `user_id = auth.uid() and is_read = false`, returns the affected row count.

Both: `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` then `GRANT EXECUTE ... TO authenticated;`

Invoker rights are correct here — `notifications` already has owner-scoped `SELECT` and `UPDATE USING (auth.uid() = user_id)` policies, so no definer escalation is needed or wanted.

After it applies, `src/integrations/supabase/types.ts` regenerates automatically; I verify both RPCs are present before writing any code that calls them. That file is never hand-edited.

### 2. `src/services/notificationService.ts`

```ts
export type NotificationCursor = { created_at: string; id: string };
export class InvalidCursorError extends Error {}
```

**`isValidCursor(c)`** — shape validation only, **non-mutating**:
- `id`: UUID v4 regex
- `created_at`: ISO-8601 regex allowing 0–9 fractional digits and `Z`/offset, plus a strict calendar check on the `YYYY-MM-DD` part (reconstruct and compare components, so `2026-02-30` is rejected without `Date` normalizing it)
- **Returns a boolean. It never reformats, never round-trips through `Date`.** The string handed to Postgres is the exact string Postgres gave us.

**`fetchNotifications({ limit = 20, cursor })`**
- `.order('created_at', { ascending: false }).order('id', { ascending: false })`
- cursor present and invalid ⇒ **throw `InvalidCursorError`** (never silently drop it)
- cursor present and valid ⇒ a single `.or('created_at.lt.<ts>,and(created_at.eq.<ts>,id.lt.<id>)')` — one `.or()` call; two chained `.lt()` filters would AND and silently drop tie rows
- requests `limit + 1`; returns `{ rows: raw.slice(0, limit), hasMore: raw.length > limit, nextCursor: <last row of rows, or null> }`

**`fetchUnreadCount()`** → `Number(data ?? 0)` (RPC returns `bigint`, arrives as string/number).
**`markAllNotificationsAsRead()`** → RPC wrapper.
`markNotificationsAsRead` unchanged.

### 3. `src/hooks/useNotifications.ts`

**Three independent request lanes**, each also checking `userGenerationRef`:

| Lane | Function | Guard |
|---|---|---|
| Head | `refreshHead()` | `requestSeqRef` — newest wins |
| Count | `refreshUnreadCount()` | `countSeqRef` + `mutationEpochRef` + pending gate |
| Page | `loadMore()` | `pageReqRef` + per-request cursor identity |

`refreshHead()` **does not** trigger a count request. `fetchAll()` becomes a thin orchestrator calling both, used only by the poller and the drawer's manual Retry. Mutation settlement calls the two functions directly — so exactly one count RPC per settlement, never two.

**Count state**
```ts
unreadCount: number | null          // starts null, never 0-by-default
countStatus: 'idle' | 'loading' | 'ready' | 'error'
```
- failure **preserves the last valid number** and sets `countStatus = 'error'`; it never writes `0` and never writes `fetchError`
- badge hidden entirely while `null`; a stale value with `'error'` still renders

**Count commit rule.** A count response commits only if: generation current **and** `countSeqRef` newest **and** `mutationEpochRef` unchanged **and** `pendingReadIdsRef.size === 0` **and** `!markAllPendingRef.current`. Otherwise it's dropped and `countRefetchQueuedRef` is set. (Without this, a count request issued after an optimistic decrement but before the DB write commits returns the pre-mutation value and bounces the badge back up.)

**Release-before-reconcile invariant.** Every mutation path — individual success, individual failure, mark-all success, mark-all failure — in its `finally`, in this exact order: (1) release its ids from `pendingReadIdsRef` / clear `markAllPendingRef`; (2) **only if no gate remains held**, fire exactly one `refreshHead()` and one `refreshUnreadCount()`. Reconciling before release would fail the hook's own commit rule and discard the result. A burst of five row-reads produces **one** trailing reconciliation, not five.

**`markAsRead(ids)`** — returns early if `markAllPendingRef.current`. Otherwise unchanged Phase-1.5 semantics: per-id eligibility, per-id prior-value capture, per-id rollback against the *current* list, toast on failure, never `fetchError`. Optimistic count decrement by `eligibleIds.length` only, clamped at 0; rollback re-adds exactly that delta and only if the count is still non-null.

**`markAllAsRead()` — bidirectionally exclusive.**
- returns early with a `"Finishing previous action…"` toast if `pendingReadIdsRef.size > 0`
- otherwise sets `markAllPendingRef` (which makes `markAsRead` return early and disables `loadMore`), captures **the map of ids it flipped with their prior `is_read` values** (never an array snapshot), flips them, sets count to `0`, bumps `mutationEpochRef`
- on failure restores **only those ids, by id, against the current list**, so rows a concurrent head refresh inserted survive; the count is restored **only if it still equals the `0` this call wrote**
- then the release-before-reconcile invariant

**`mergeNotifications(accumulated, incoming)`** — one shared helper for head and page:
- head data wins per-id for server fields (title, message, metadata, image_url)
- `is_read: true` is **monotonic** — no merge ever returns a row to unread (valid only because no mark-as-unread action exists; if one is ever added, this becomes row versioning)
- rows present only in older accumulated pages are preserved
- de-dupe by `id`, then sort `created_at DESC, id DESC` — the id tiebreak matters, timestamps collide
- `nextCursor` tracks the **oldest successfully loaded row**; head refreshes never move it

**`loadMore(opts?: { force?: boolean })`**
- no-ops when `!hasMore`, already loading, `markAllPendingRef` is held, or (`pageError` set **and** `!opts.force`)
- `force: true` clears `pageError` first, then proceeds on the same cursor — this is what the Retry button calls
- keys its in-flight check on `(cursor, pageReqRef)` per request, so a duplicate fire on an in-flight cursor is dropped while a *failed* cursor stays retryable
- `InvalidCursorError` ⇒ `pageError = 'invalid-cursor'`, does **not** touch `hasMore`, does **not** fall back to an uncursored fetch
- network failure ⇒ generic `pageError`
- neither ever writes `fetchError`

**Reset on user change** additionally clears cursor, `hasMore`, `pageError`, `unreadCount`, `countStatus`, `markAllPendingRef`, `countRefetchQueuedRef`, and bumps all sequence refs.

**Result type gains:** `unreadCount: number | null`, `countStatus`, `loadedUnreadCount`, `hasMore`, `isLoadingMore`, `pageError`, `loadMore`, `markAllAsRead`, `markAllPending`.

### 4. `src/contexts/NotificationsContext.tsx`
Widen the `Pick<>` union and the memo dependency array with the new fields. No behavioural change.

### 5. UI

**`NotificationDrawer.tsx`**
- Mark-all button label → **"Mark all as read"**; enabled when
  `!markAllPending && !markingAsRead && (loadedUnreadCount > 0 || (unreadCount ?? 0) > 0)`
  — `markingAsRead` included so the button is never offered when the hook would only reply with a toast; the `unreadCount` arm is what lets users clear older unloaded unread rows
- header and **Unread tab label use the global `unreadCount`**; both hide the number while `null`

**`NotificationList.tsx`**
- a real focusable `<button>` **"Load more"** with `"Loading more…"` and `"Couldn't load more — Retry"` states; Retry calls `loadMore({ force: true })`
- an `IntersectionObserver` sentinel calls **the same `loadMore()` callback** (never a synthetic `.click()`), unforced, and is inert whenever `pageError` is set
- **"You're all caught up"** only when `hasMore === false`, rows exist, and the mismatch condition below is false
- **mismatch banner** ("Some notifications may not be shown" + Refresh) only when *all* hold: `hasMore === false`, `rows.length > 0`, `countStatus === 'ready'`, `unreadCount !== null`, no mutation gate held, and `unreadCount > loadedUnreadCount`. Anything less than fully authoritative renders nothing rather than alarming copy.
- Unread tab with `loadedUnreadCount === 0` but global `unreadCount > 0`: **"You have N unread notifications in total. Load more to find older unread ones."** plus the Load more control — never a bare "No unread notifications"

**`NotificationBell.tsx`** — untouched; its count simply becomes truthful.

### Manual verification
- \>20 notifications: badge shows the true total, not 20.
- Load more by click **and** by scroll: appends in order, no dupes, no scroll jump, Tab reaches the button.
- **Precision boundary:** two rows sharing a `created_at` to the microsecond, straddling a page edge → each appears exactly once, in order.
- **Retry:** kill network mid-Load-more → "Couldn't load more — Retry"; the Retry button **works** and succeeds on the same cursor.
- Mark a row read on page 3 → stays read across polls and further pages; badge −1, no bounce.
- **Count race:** mark read, force a poll while the write is in flight → badge holds the lower value and settles there.
- **Burst:** mark five rows quickly → exactly one head refresh and one count RPC after the last settles.
- **Bidirectional gate:** start a row mark-read, immediately try Mark all → button is disabled, no toast needed; no row ends read-on-server but unread-locally.
- Block the count RPC → badge keeps its last value or hides; list still refreshes; no "Couldn't refresh" strip; **no mismatch banner**; Mark all still usable.
- Mark all with zero unread loaded but global unread > 0 → enabled, clears, badge → 0.
- Kill network mid-mark-all → only affected rows roll back; concurrently-polled rows survive; toast only.
- Temporarily corrupt the cursor → pagination error surfaces; page 1 is *not* refetched; no "all caught up".
- Sign out with 3 pages loaded → cursor, rows, count, errors all reset.
- Signed-out public routes render with no RPC errors.

### Technical notes
Strict order: migration → verify regenerated `types.ts` → `notificationService.ts` → `useNotifications.ts` → `NotificationsContext.tsx` → `NotificationDrawer.tsx` → `NotificationList.tsx`. No new dependencies. No RPC-calling code lands before the types exist.

**Deferred:** 2.2 independent Unread pagination + destination routing/target-availability; 2.3 page-scoped aggregation; 2.4 single realtime channel with merge-by-id and reconnect reconciliation. Explicitly out of scope for Phase 2: filters, per-row actions, a `/notifications` route, rich previews, preferences, date sections, virtualization, web push.
