## Verdict

Both corrections accepted. The error-channel one is a real defect in my plan — `markAsRead`'s catch currently calls `setError(e)`, so a failed mark would light up the refresh strip *and* mispoint its Retry. It also already contaminates the existing `hasError` empty-state path, so this is a pre-existing bug, not just a new-UI one. The `networkStatusService` guard is the same omission as the state setters, one layer out.

## Phase 1.5 — final

Logic in `src/hooks/useNotifications.ts`; strip + label in `src/components/notifications/NotificationDrawer.tsx`.

**A. Account generation guards fetches *and* mutations**

One `userGenerationRef`, bumped on `user?.id` change, captured at the start of every `fetchAll` and every `markAsRead`. A previous session's mutation commits nothing on return: no counter decrement, no rollback, no error, no toast, no pending-ID release. Safe precisely because of H.

**B. Per-ID rollback with exact prior values + ownership**

Capture `Map<id, boolean>` of each affected row's real prior `is_read` before the optimistic write. On failure (generation permitting), map over the *current* array and restore only those IDs to their captured values.

Eligibility filter first: submit an ID only if it is **locally unread** and **not already owned** by a pending mutation (`pendingReadIdsRef: Set<string>`). Normal same-user completions always release their IDs in `finally`.

**C. Pending count as state, clamped**

```text
if (eligibleIds.length === 0) return;         // no work, no increment
setPendingReadOps(n => n + 1);
...
setPendingReadOps(n => Math.max(0, n - 1));
const markingAsRead = pendingReadOps > 0;
```

**D. Separate error channels** *(new)*

- `fetchError` — set only by `fetchAll`; cleared on every successful fetch. This is what the drawer reads.
- Mutation failures set **no** shared error state. They roll back per-ID and show the existing destructive toast, which is already the right surface for a user-initiated action per project policy.

Drawer consequences: `hasError` (empty + failed) and `hasStaleData` (cached + failed) both derive from `fetchError`, so a failed mark can never render a refresh failure or aim Retry at the wrong operation.

**E. Monotonic poll reconciliation**

```text
locallyRead = ids of current rows with is_read === true  ∪  pendingReadIdsRef
merged = fetched.map(r => locallyRead.has(r.id) ? { ...r, is_read: true } : r)
```

Code comment: **valid only because the app has no mark-as-unread action** — Phase 2 must replace this with versioning if that changes.

**F. Dual fetch guards, covering side effects too**

- `userGenerationRef` — account changes.
- `requestSeqRef` — only the newest same-user response commits.

Both checks gate every state commit, the `finally` loading-flag updates, **and** `networkStatusService.reportSuccess()` / `reportFailure(e)`. An obsolete request never touches app-wide network health.

**G. Stale-refresh strip + label**

Above the tabs, mutually exclusive with the offline banner (which stays `!isOnline`-only):

```text
Couldn't refresh                     Retry
```

Retry calls `fetchAll`, disabled while `isRefreshing` — putting the currently-unused `isRefreshing` export to work. Button copy becomes **"Mark these as read."** `unreadCount` keeps its name plus a comment noting loaded-page scope.

**H. Reset on user change**

The reset effect additionally clears `pendingReadIdsRef` and sets `pendingReadOps` to 0, so nothing can be stranded by a skipped old-generation release.

## Verification I'll run after implementing

Codex's nine scenarios, plus the destination sweep:

1. Two overlapping row clicks
2. Row click overlapping "Mark these as read"
3. Mark-read failure during a successful background refresh — toast only, no refresh strip
4. Background-refresh failure with cached rows — rows stay, strip appears
5. Retry after refresh failure
6. Account switch mid-fetch
7. Account switch mid-mutation
8. Older poll landing after a newer Retry
9. Poll landing after a successful optimistic read

Then: query the distinct `type` / `entity_type` combinations present in your `notifications` rows, trace each through `handleNotificationClick`, and report which destination each opens — flagging fall-throughs to the "no associated content" toast or deleted targets.

## Out of scope

Pagination, global unread count, server-side mark-all, deleted-content handling, grouping, realtime, filters, per-row actions, `/notifications` route.

## Phase 2 order

Cursor pagination / Load more → global unread count → server-side mark-all → destination and deleted-content reliability → aggregation → realtime with polling fallback.

## Technical notes

- Two files. No service, schema, or query changes.
- Renaming `error` → `fetchError` is an internal hook change; the drawer is the only consumer, updated in the same pass.
- `markAsRead` stays fire-and-forget-safe; the drawer's `void markAsRead([...])` call site is unchanged.
- All guards live in refs, so `fetchAll`'s `useCallback` deps are untouched and the poller is never torn down.
