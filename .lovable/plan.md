## My take

Codex found a real bug and I'm folding it in. Both reviews are otherwise aligned with the plan.

**The dead-event finding is confirmed.** I grepped for it:

```
Feed.tsx:557          dispatchEvent(new CustomEvent('open-notifications'))
PostView.tsx:205      dispatchEvent(new CustomEvent('open-notifications'))
MyStuffPage.tsx:35    dispatchEvent(new CustomEvent('open-notifications'))
→ addEventListener('open-notifications', …)   ZERO matches in src/
```

For contrast, the sibling `open-search-dialog` event *does* have a listener in `NavBarComponent.tsx:44`. So the mobile bells on those three pages are currently inert — they render an unread badge and do nothing on tap. Swapping only the `unreadCount` source would have left three dead buttons behind. They'll call `openNotifications()` directly, and the `open-notifications` event disappears from the codebase entirely.

**Codex's wording correction is right and I'm dropping the overclaim.** `Pick<UseNotificationsResult, …>` guarantees the selected fields stay type-accurate; it does *not* prevent a future field from being left out. That's fine — the context should expose a deliberate public surface — but I won't describe it as automatic protection.

**One thing to add:** `NotificationBell` currently early-returns `null` when there's no user. The provider must not do that — it has to render children unconditionally, or every page inside it unmounts on signed-out routes. It renders children always; only the hook internals stay dormant without a user.

## Phase 2.0 — One notification surface, one state owner

**1. `src/contexts/NotificationsContext.tsx` (new)**

- Calls `useNotifications()` exactly once. Imports the hook; does **not** import `NotificationDrawer`.
- Owns drawer visibility: `isNotificationsOpen`, `openNotifications()`, `closeNotifications()`, `setNotificationsOpen(open)`.
- Forces the drawer closed when `user?.id` changes (sign-out / account switch).
- **Always renders children**, signed in or out.
- Explicit typed contract, no `ReturnType<>` passthrough. Data fields via `Pick<UseNotificationsResult, …>`: `notifications`, `unreadNotifications`, `unreadCount`, `loading`, `isRefreshing`, `markingAsRead`, `fetchError`, `isOnline`, `lastRefresh`, `markAsRead`, `fetchAll` — plus the four drawer controls. No raw setters. Adding a field later is a deliberate edit here, by design.
- `useNotificationsContext()` throws outside the provider.

**2. `App.tsx` — provider wraps, App renders the one drawer**

```
<AuthPromptProvider>
  <NotificationsProvider>
    <OfflineBanner />
    <Routes>…</Routes>
    <NotificationDrawer />
  </NotificationsProvider>
</AuthPromptProvider>
```

Every route lives inside `<Routes>`, so all seven consumers are provably within the provider — nothing can throw. Nested inside `Router`, `AuthInitializer`, `ContentViewerProvider`, `QueryClientProvider`, and `AuthProvider` (from `main.tsx`), giving the drawer navigation, content-viewer, auth, and toast access.

**3. Migrate all seven consumers**

| File | Change |
|---|---|
| `Feed.tsx` | badge from context; mobile bell → `openNotifications()` |
| `PostView.tsx` | badge from context; mobile bell → `openNotifications()` |
| `MyStuffPage.tsx` | badge from context; mobile bell → `openNotifications()` |
| `vertical-tubelight-navbar.tsx` | drop hook + local `showNotifications`; remove its `<NotificationDrawer/>` (line 255); trigger → `openNotifications()` |
| `NotificationBell.tsx` | badge from context; → `openNotifications()`; renders no popover; dynamic `aria-label`, **no `aria-live`** |
| `NotificationDrawer.tsx` | drops props; open state + data + actions from context |
| `NotificationPopover.tsx` | deleted |

`open-search-dialog` is untouched — different feature, working listener.

Drawer row click keeps today's exact order: `void markAsRead([id])` → `closeNotifications()` → navigate/`openContent`.

**4. `useNotifications.ts` logic untouched.** Only addition: exported `UseNotificationsResult` interface. All Phase 1.5 guards byte-for-byte — `userGenerationRef`, `requestSeqRef`, per-ID rollback, `pendingReadIdsRef`, clamped `pendingReadOps`, `fetchError` channel, monotonic merge.

**5. ESLint guard.** `no-restricted-imports` on `@/hooks/useNotifications` **and** relative forms (`../hooks/useNotifications`, `../../hooks/useNotifications`), with overrides allowing `src/contexts/NotificationsContext.tsx` and `**/*.test.*`.

## Verification

- `rg "open-notifications"` → zero matches. `rg NotificationPopover` → zero. `rg "hooks/useNotifications"` outside the context file and tests → zero.
- Tap the mobile bell on `/home`, `/post/:id`, `/my-stuff` → shared drawer opens (currently: nothing happens).
- `/u/:username` bell → same drawer; mark a row read → navbar badge decrements in the same frame.
- Count notification requests over ~25s on `/home`: **one** per interval, not three.
- Exactly one `[role="dialog"]` when open, desktop (1305px) and mobile.
- Open from navbar, close from drawer, reopen from bell → consistent.
- Focus returns to the opening trigger; if it unmounted during navigation, focus lands on a stable element, not `document.body`.
- Sign out with drawer open → closes, state clears. Signed-out public routes (`/`, `/entity/:slug`) render normally.
- Lint + typecheck clean, no console errors.

## Deferred (unchanged)

**2.1** global unread RPC + server mark-all + cursor pagination (`created_at` + `id`) together; `security definer`, `search_path = public`, `auth.uid()`-scoped, `EXECUTE` to `authenticated`. **2.2** destination routing vs target availability. **2.3** page-scoped aggregation. **2.4** single realtime channel, merge-by-ID on INSERT + UPDATE, reconcile on reconnect.

Out of scope for all of Phase 2: filters, per-row actions, `/notifications` route, rich previews, preferences, date sections, virtualization, web push.

## Technical notes

New: `src/contexts/NotificationsContext.tsx`. Edited: `App.tsx`, `Feed.tsx`, `PostView.tsx`, `MyStuffPage.tsx`, `vertical-tubelight-navbar.tsx`, `NotificationBell.tsx`, `NotificationDrawer.tsx`, `useNotifications.ts` (type export only), `eslint.config.js`. Deleted: `NotificationPopover.tsx`. No database changes.
