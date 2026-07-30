## Verdict

Implement it as written, with Codex's type refinement. Verified before planning:
- `ContentViewerContext` has exactly four importers: `App.tsx`, `contentViewerRoutes.ts`, `ContentViewerModal.tsx`, `NotificationDrawer.tsx`. No other feature consumes it — safe to delete.
- `isInModal` is declared and destructured in `PostContentViewer` / `RecommendationContentViewer` but never read (already dead). The `isInModal` in `LightboxPreview.tsx:165` is an unrelated local Radix-portal check — leave it.
- `isViewableContentType` in the route helper has no callers outside that file.

## Final plan

**1. Route helper: `src/utils/contentViewerRoutes.ts` → `src/utils/contentRoutes.ts`**
- Define the union locally and narrow it to what is actually routable: `export type RoutableContentType = 'post' | 'recommendation'`. No `review`, no `null` — unroutable cases are the caller's business, not the type's.
- `buildContentPath(type: RoutableContentType, id: string, commentId?: string | null): string | null` — drops the `opts.modal` parameter and all `modal=true` generation.
- Keep: UUID guard on `commentId`, and the rule that `focus=comment` is never synthesized.
- Drop `isViewableContentType` (unused once the resolver owns type validation), replacing it with an internal type-guard the resolver uses to decide `route` vs `none`.

**2. Resolver: `src/utils/notificationDestination.ts`**
- Collapse `{ kind: 'viewer', contentType, id, commentId }` into `{ kind: 'route', path }`; post → `/post/:id`, recommendation → `/recommendations/:id`, with `?commentId=<uuid>` when valid.
- If `buildContentPath` returns null (unroutable type or bad id), fall through to the existing `kind: 'none'` reasons rather than emitting a partial route.
- Follow/profile and safe `action_url` branches already return `kind: 'route'` — untouched. All three `none` reasons untouched.

**3. Drawer: `src/components/notifications/NotificationDrawer.tsx`**
- Remove the `useContentViewer` import and the `kind === 'viewer'` branch (lines 9, 50, 76-79); every resolvable destination becomes one `navigate(destination.path)`.
- Unchanged: optimistic fire-and-forget `markAsRead`, `closeNotifications()` before navigation, and the three reason-specific toasts.

**4. Delete the modal surface**
- Delete `src/components/content/ContentViewerModal.tsx` and `src/contexts/ContentViewerContext.tsx`.
- `src/App.tsx`: remove the `ContentViewerModal` mount, the `ContentViewerProvider` wrapper, and both imports.

**5. Page bodies stay**
- `PostContentViewer` / `RecommendationContentViewer` remain the bodies rendered by `PostView` / `RecommendationView`.
- Remove only the dead `isInModal` prop (type + destructure) from both. `highlightCommentId`, the `not-found` vs `transient` split, and Retry are untouched.

**6. Tests + docs**
- `src/utils/notificationDestination.test.ts`: the nine `kind: 'viewer'` expectations become `{ kind: 'route', path: '/post/<id>' }` / `'/recommendations/<id>?commentId=<id>'`. Hostile-URL and `none`-reason cases are unaffected.
- `docs/NOTIFICATION_CENTER_ROADMAP.md`: record that Phase 2.2B's modal viewer was superseded — notification destinations are full-page routes.

**7. Verification (post-implementation audit, not another planning cycle)**
- `rg "useContentViewer|ContentViewerProvider|ContentViewerContext|ContentViewerModal|openContent|modal=true|contentViewerRoutes" src` → zero hits.
- `rg "isInModal" src` → only `LightboxPreview.tsx`.
- Typecheck + `notificationDestination` tests.
- Manual: post like, recommendation like, plain comment, mention, reply, comment like, follow → profile, deleted target ("no longer available"), network failure ("Couldn't load" + Retry), browser Back, mobile width.

### Technical note
Old shared links carrying `?modal=true` keep loading as normal full pages — `PostView` / `RecommendationView` read only `commentId` from search params and ignore everything else, so no legacy-param handling is needed.
