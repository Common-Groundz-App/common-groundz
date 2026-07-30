# Notification Center Roadmap

## Shipped

### Phase 1 / 1.5 — Functional cleanup
Scrollable drawer, optimistic reads with rollback, request guards, fetch-error retry strips.

### Phase 2.0 — Consolidation
`NotificationsContext` is the single state owner; `NotificationPopover` deleted; an ESLint rule keeps `useNotifications` from being mounted twice.

### Phase 2.1 — Pagination and mutation correctness
Composite index + unread-count/mark-all RPCs, string-based microsecond cursor validation (no `Date` round-trip), mutation exclusivity, release-before-reconcile, deterministic invalid-cursor recovery (`recoverPagination`), pure mutation updaters, `unreadCount ?? 0` at every badge site.

### Phase 2.2A — Independent Unread lane
Separate All/Unread lanes with their own cursors, errors and reconciliation; head-window authority plus membership revalidation for older rows; bounded visual-only sticky reads; global mutation ownership shared across lanes; Unread polling scoped to the open tab.

### Phase 2.2B / 2.2C — Destination resolution and unavailable targets
- DB: `add_comment`, `create_post_comment_notification`, `create_recommendation_comment_notification` now write `comment_id` into metadata and emit `/recommendations/:id` (plural).
- `src/utils/notificationDestination.ts`: pure, environment-free resolver with a strict route allowlist, UUID validation, username pattern validation, and approved query params only (`commentId`, `focus=comment`). Rejects external/protocol-relative URLs, `javascript:`, backslashes, control chars and unknown paths.
- `fetchCommentsResult` returns `{ status, comments }` so a network failure can never render "no longer available".
- Post/Recommendation page bodies distinguish confirmed-missing (`not-found`) from transport failure (`transient`, with Retry). Notifications mark read regardless of target availability.

### Phase 2.2D — Full-page routing (supersedes the 2.2B modal viewer)
The `ContentViewerModal` / `ContentViewerContext` surface is deleted. Notification destinations are now **full-page routes**, matching Instagram/Twitter behaviour: real browser history, shareable URLs, one rendering surface, no scroll-inside-scroll on mobile.
- `resolveNotificationDestination` returns only `{ kind: 'route', path }` or `{ kind: 'none', reason }`. The `viewer` kind no longer exists.
- `src/utils/contentRoutes.ts` (renamed from `contentViewerRoutes.ts`) is the single source of canonical content paths: `post → /post/:id`, `recommendation → /recommendations/:id`, plus `?commentId=<uuid>` when valid. Its `RoutableContentType` union excludes `review`, which has no page. No `modal=true`, and `focus=comment` is never synthesized.
- `NotificationDrawer` marks read (fire-and-forget), closes, then `navigate(destination.path)`.
- `PostContentViewer` / `RecommendationContentViewer` remain as the page bodies of `PostView` / `RecommendationView`.
- Legacy shared links carrying `?modal=true` still load as normal pages — the routed pages read only `commentId`.

## Behavior matrix (as implemented)

| Emitted notification | Destination | Missing id | Deleted target | Comment context |
| --- | --- | --- | --- | --- |
| Post like | `/post/:id` | falls back to safe `action_url`, else toast | "This content is no longer available" | n/a |
| Recommendation like | `/recommendations/:id` | same | same | n/a |
| Post comment (legacy, no `comment_id`) | `/post/:id` | same | same | opens thread, no false highlight |
| Post/recommendation comment (new) | route + `?commentId` | same | same | scrolls + highlights; "That comment is no longer available" if gone |
| Mention | route + `?commentId` | same | same | same |
| Reply | route + `?commentId` | same | same | same |
| Comment like | route + `?commentId` | same | same | same |
| Follow | `/profile/:id` (`entity_id`, else `sender_id`) | toast | profile unavailable state | n/a |
| Review (not currently emitted) | safe `action_url` only | `unsupported-type` toast | n/a | n/a |
| Unsafe `action_url` | none | `unsafe-url` toast | n/a | n/a |


## Next

- **Phase 2.3 — Grouping and digests:** collapse "X and 4 others liked your post"; per-type preferences.
- **Phase 2.4 — Realtime:** Supabase realtime inserts into the head window instead of polling.
- **Phase 2.5 — Coverage:** emit review and journey notifications once those surfaces exist, then extend the resolver's allowlist.
