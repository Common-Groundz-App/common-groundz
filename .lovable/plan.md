## Phase 2.3 — Aggregation & grouping (v1: likes only)

Verified first: Phase 2.2A/B/C are complete with no leftovers — two independent lanes in `useNotificationLane.ts`, sticky reads and unread revalidation in `useNotifications.ts`, `notificationDestination.ts` returning only `route | none`, and zero traces of the modal viewer (`ContentViewerContext`, `ContentViewerModal`, `useContentViewer`, `contentViewerRoutes`, `modal=true`). The one `isInModal` hit is an unrelated local in `LightboxPreview.tsx`.

Both reviews are correct and their corrections are adopted in full. Grouping stays a **pure, page-scoped, render-time transform**: the hook keeps storing flat rows, and pagination, cursors, unread count, sticky reads, recovery and mutation gates are untouched. No database or service changes.

### 1. Eligibility — top-level content likes only
A row is groupable only when **all** hold:
- `type === 'like'`
- `entity_type` is `post` or `recommendation`
- `entity_id` is a valid UUID
- `metadata.comment_id` is absent

Everything else renders exactly as it does today: comments (new and legacy), mentions, replies, comment likes, follows, journey and system rows. This removes the age-dependent inconsistency in comment grouping and guarantees every child of a group shares one identical destination.

### 2. Bounding — contiguity **and** a real time window
- Children must be **contiguous in the loaded row order** (a non-matching row between two likes breaks the group, so the feed never reorders).
- Children must fall inside a **24h window measured from the group's newest child**, not neighbour-to-neighbour — no transitive chaining across days. Rows outside the window start a new group.

### 3. Copy — no name parsing, no new fetches
`formatGroupSummary(group)` never parses titles or messages for identity:
- 1 event → the row's existing title/message, byte-identical to today.
- 2+ events → the **representative's existing title** plus a numeric remainder, e.g. `"… and 3 others liked your experience"`, or the fully safe form `"4 people liked your experience"` when the representative's title can't be reused verbatim.
- Zero new profile queries in this phase. Actor display names are deferred to a later presentational upgrade that reads the existing profile cache.

### 4. Count semantics — distinct actors vs events
- `actorIds`: distinct `sender_id`s, newest-first — this is what the "and N others" number is derived from.
- `eventIds`: every underlying notification id, retained in full for read mutation.
- If distinct actors collapse to 1 (unlike/re-like duplicates), the group renders as a single-actor row with the event count suppressed, never "Alice and 0 others".

### 5. Identity — unique group instance keys
Group key is `${type}|${entity_type}|${entity_id}|${representativeId}`. The representative's id makes each contiguous instance unique, so `Like A / Follow / Like A` produces two groups with distinct React keys and no row reuse bugs.

### 6. Click contract — groups, not smuggled representatives
`NotificationList`'s callback signature changes to `onGroupClick(group, event)`. The drawer then:
- calls `markAsRead(group.unreadEventIds)` once (array API already exists, mutation exclusivity untouched),
- resolves the destination from the representative — valid **only because eligibility guarantees identical targets** — and navigates,
- falls back to today's differentiated toasts for unsafe/missing/unsupported destinations.

### 7. Visuals
- Single-event groups render exactly the current markup — same avatar, same copy, same timestamp, same read check.
- Multi-event groups add a stacked secondary avatar and a `+N` chip, both rendered through the existing `ProfileAvatar` (same profile cache, no new avatar/loader path).
- Timestamp shows the newest child. A group is highlighted while any child is unread.
- `aria-label` states the aggregate ("4 people liked your experience") so screen readers don't get only the representative.

### 8. Counts stay event-based (documented invariant)
Global unread count, `loadedUnreadCount`, the mismatch banner, `hasMore` and every cursor remain **event** counts over flat server rows. Nothing compares against the rendered group count. This is written into the roadmap so future work can't quietly swap in group counts.

### 9. Tests — `src/utils/notificationGrouping.test.ts`
Adjacent likes group; non-adjacent likes don't; likes >24h apart don't; no transitive chaining; comments/mentions/replies/comment-likes/follows/system never group; rows with `comment_id` never group; rows without a valid `entity_id` never group; unread propagation; distinct-actor vs event-count; unique keys for repeated base keys; representative destination identity.

### Files touched
- `src/utils/notificationGrouping.ts` (new)
- `src/utils/notificationGrouping.test.ts` (new)
- `src/components/notifications/NotificationList.tsx`
- `src/components/notifications/NotificationDrawer.tsx`
- `docs/NOTIFICATION_CENTER_ROADMAP.md`

### Deferred
Comment/follow grouping, server-side or cross-page aggregation, digest rows, preference-driven grouping, actor display names, realtime group reconciliation beyond recomputing the transform.
