## Verified in code before planning

- `NotificationDrawer.tsx:111` — tabs wrapper is a plain `div.px-4.pb-2`: no `flex-1`, no `min-h-0`, no overflow. This is the scroll bug.
- `sheet.tsx:104` — Radix already renders an accessible `SheetPrimitive.Close` with `sr-only` "Close". `NotificationDrawer.tsx:89` adds a second raw `<X onClick>` in the same corner. Confirmed duplicate; the raw one has no button semantics or keyboard access.
- `useNotifications.ts:42-47` — `await markNotificationsAsRead(ids)` runs **before** `setNotifications`. **Not optimistic.** Codex is right; my previous plan was wrong.
- `useNotifications.ts:30` — `setError(e)` on failure, never cleared on success.
- `useNotifications.ts:23` — `setLoading(true)` fires on every 10s poll.
- `NotificationDrawer.tsx:31` — click `await`s `markAsRead` before closing/navigating.
- `dateUtils.ts` — `formatRelativeDate` is day-granular (`Today` / `Yesterday` / `N days ago` / `MMM d, yyyy`).

## Adopted corrections

Both reviews approve. I'm taking all three Codex corrections and ChatGPT's centralization note.

---

## Phase 1

Files: `NotificationDrawer.tsx`, `NotificationList.tsx`, `useNotifications.ts`, `dateUtils.ts`.

**1. Bounded scroll region**

```text
SheetContent (p-0)
└── div.flex.h-full.flex-col
    ├── SheetHeader          shrink-0
    ├── OfflineInlineState   shrink-0 (drawer-level)
    └── Tabs                 flex min-h-0 flex-1 flex-col
        ├── TabsList         shrink-0
        └── TabsContent      min-h-0 flex-1 overflow-y-auto overscroll-contain
```

Horizontal padding moves to header and list, never to an unbounded wrapper.

**2. Remove the duplicate close icon.** Delete the raw `<X>`; rely on the Sheet's built-in accessible close.

**3. Header layout.** Drop `absolute top-4 right-8`:

```text
Notifications                              [×]
Updated just now          Mark all as read
```

Per ChatGPT: visibility is driven by the **global** `unreadCount`, not the active tab's rows, so it doesn't vanish while on the Unread tab. Keeps its existing `markingAsRead` spinner.

**4. Offline banner rendered once above `TabsList`**, so All and Unread behave identically.

**5. Genuinely optimistic read state + immediate navigation** (Codex correction 1). In `markAsRead`: snapshot the affected rows, `setNotifications` **before** the RPC, and on failure restore the snapshot alongside the existing toast. Then in `handleNotificationClick`, drop the `await` — fire, close, navigate. Rows go read instantly, the unread badge stays consistent, and a failed write visibly rolls back rather than silently diverging.

**6. Error state with proper reset** (Codex correction 2). `setError(null)` on every successful `fetchAll`, and reset `error`/`notifications` when `user?.id` changes so a previous session's state can't leak. The drawer then consumes `error`: if a fetch fails **and** there are no cached rows, show "Couldn't load notifications" + Retry calling `fetchAll`, visually distinct from the empty state. If cached rows exist, keep them visible (stale-while-revalidate, per project policy).

**7. Initial load vs background refresh** (Codex correction 3). Track "has ever loaded" with a **ref**, not `notifications.length` — keeping it out of `fetchAll`'s `useCallback` deps so the poller isn't torn down and rescheduled on every response. Expose `isInitialLoad` and `isRefreshing`. `NotificationList` then renders 4 row skeletons **only** on initial load; polls never replace visible rows.

**8. Timestamps.** Replace `toLocaleString()`. Adding one helper to `dateUtils.ts` (not inline in the row, per ChatGPT), with the boundaries Codex asked to pin down decided here:

- Under 60s → `Just now`
- Under 24h (rolling, not calendar day) → `formatDistanceToNowStrict(date, { addSuffix: true })` → "3 minutes ago", "2 hours ago". Not compact "3m" — that would mean a custom unit mapper, which is the "new date system" both reviews warned against.
- 24h and older → existing `formatRelativeDate`
- Invalid date → render nothing rather than "Invalid Date"
- Future timestamps (clock skew) → clamp to `Just now`
- No live ticking while the drawer is open (Phase 2 if it matters)

## Out of scope

No service, database, realtime, pagination, grouping, filters, per-row actions, or `/notifications` route.

## Manual verification after implementation

Per Codex's note that destination reliability should be checked now even though fallback design is Phase 2: I'll list the notification types currently present in your data, and you confirm each one opens a valid destination. Also worth testing: scroll with 19+ rows, keyboard Tab/Esc to close, offline banner on both tabs, and a throttled-network row tap (should navigate instantly).

## Phase 2 — priority order

1. **Pagination + global unread count + server-side mark-all.** The 20-row cap makes older activity unreachable, and today's "Mark all as read" only touches loaded rows. Acceptable for Phase 1; the first real Phase 2 project.
2. **Destination reliability** — graceful handling of deleted/inaccessible targets.
3. **Grouping** ("hana.li liked 3 of your posts") — designed at query level so pagination and read state stay coherent.
4. **Realtime**, with polling as fallback.
5. Date sections, preferences/mute, rich previews, `/notifications` route, virtualisation, push.

On the bell: Codex is right that I can't clear a "new activity" dot on open without a distinct `unseen` concept — the count derives from unread rows, so clearing locally would desync the bell from the Unread tab. That needs a schema decision, so it moves to Phase 2. Phase 1 keeps: rows unread until clicked, plus explicit Mark all as read. No auto-mark on open or close.

Confirm and I'll implement items 1–8.