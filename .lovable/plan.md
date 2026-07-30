## Verdict

Both reviews agree with the root cause, and Codex's additions are correct — I verified the two that mattered:

- `PostContentViewer.tsx:43` reads `focus=comment` as **autofocus the comment composer**, not "reveal the comment". So my earlier plan's "add `focus=comment`" was wrong for mention/reply notifications: it would steal focus from the highlighted comment. `commentId` alone is what highlights. Dropped from the plan.
- `ContentViewerModal.tsx:135` puts `onClick={handleViewFullPage}` on the whole card. Mounting it as-is means every like, save, retry, comment control and text selection inside the viewer navigates away. Must be fixed in the same change.

Everything else in both reviews is folded in below.

## Root cause

`ContentViewerModal` is never rendered anywhere (`rg ContentViewerModal src` matches only its own file). Click → mark read → drawer closes → `openContent()` sets context state → no consumer renders. Route destinations (follow) work; every post/recommendation notification is dead.

## Plan

**1. Mount one app-wide viewer**
Render `<ContentViewerModal />` exactly once in `App.tsx`, inside `<Router>` and `ContentViewerProvider`, adjacent to `<NotificationDrawer />`. No per-row or per-drawer instances.

**2. Canonical route builder**
Add a single helper (colocated with the viewer) mapping content type → path: `post → /post/:id`, `recommendation → /recommendations/:id`, `review → null` (unsupported, never pushed). Both the modal's URL sync and "View full page" use it, so they can't drift. Append `commentId` when it's a valid UUID. Never append `focus=comment`.

**3. Explicit history ownership**
Delete the current effect that calls `window.history.back()` whenever `isOpen` is false — that fires on first mount today.
Replace with a ref holding the entry this instance pushed:
- On open (and on content change while open): if we don't own an entry, `pushState` and record ownership; if we already own one, `replaceState` (no stacking).
- On close from button / backdrop / Escape / full-page transition: if we own the entry, `history.back()` once and release ownership; otherwise no history call at all.
- On `popstate`: release ownership first, then `closeContent()` — so the close path can't push a second `back()` and loop.
- On unmount and on account/route change: release ownership without navigating.

**4. Remove whole-modal click navigation**
Drop `onClick={handleViewFullPage}` from the content card and the `cursor-pointer` class. Add an explicit "View full page" control in the modal header next to Close. Backdrop click still closes.

**5. Baseline dialog accessibility**
Escape closes. Focus moves into the dialog on open and returns to the previously focused element on close. Keep `role="dialog"`/`aria-modal` and the described-by wiring. Keep the existing body `overflow` / `pointer-events` cleanup, including on unmount.

**6. No resolver changes**
`notificationDestination.ts`, the drawer wiring, and Phase 2.1 / 2.2A invariants stay untouched. The `focus=comment` param stays supported in the resolver for `action_url` values that legitimately carry it — we simply never synthesize it.

## Verification

Typecheck + existing resolver tests, then manual: post like, recommendation like, plain comment, mention, reply, comment-like (comment highlighted, composer **not** focused), follow → `/profile/:id`, close button, backdrop, Escape, browser Back, View full page, deleted target → "no longer available", network failure → "Couldn't load" + Retry, and confirm closing never leaves the underlying page.
