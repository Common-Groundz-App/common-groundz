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


## Phase 2.3 — Aggregation and grouping (v1: likes only)

Render-time only. `src/utils/notificationGrouping.ts` is a pure transform over the rows a lane has already loaded — no schema change, no new fetches, no new state.

- **Eligibility:** top-level `like` rows on `post` / `recommendation` with a valid uuid `entity_id` and **no** `metadata.comment_id`. Comments, replies, mentions, comment likes, follows and system rows always render as singletons, because each has its own `?commentId` destination.
- **Bounding:** children must be **contiguous** in the loaded list AND within a 24h window anchored on the group's newest child (no transitive chaining). A non-matching row breaks the run, so the feed is never reordered. Unparseable timestamps never aggregate.
- **Copy (shipped):** grouped rows read as personal sentences built from resolved **display names** — "Linda Williams and Hana Li liked your post", collapsing to "… and N others" past two named actors. Event-aware singleton copy; no numeric event chip. Names come from the same React Query profile keys `ProfileAvatar` already uses, so there are no extra requests and no flicker.
- **Identity:** group key is `${type}|${entity_type}|${entity_id}|${representativeId}`, unique even if the same target appears twice in one page.
- **Interaction:** `NotificationList` passes the whole group to `onNotificationClick` (singletons arrive as 1-event groups). The drawer marks every unread child in a single `markAsRead(ids)` call and navigates via the representative's destination — valid because a group shares one target by construction.
- **Visuals:** up to 3 stacked `ProfileAvatar`s (existing cache, no extra requests). No event-count chip. Singleton rendering is unchanged.
- **Invariant:** unread counts, the mismatch banner and pagination stay **event-based** over flat server rows. Group counts are presentation only.
- **Tests:** `src/utils/notificationGrouping.test.ts` — 43 cases covering eligibility, adjacency, the window anchor, name resolution/copy, and total/unread event-count preservation.

## Phase 2.4 — Realtime with polling reconciliation (done)

Realtime is a **delivery hint**, never a source of truth. The unread count RPC and each lane's own fetches stay authoritative, so a dropped, duplicated or out-of-order event costs latency only — never correctness.

- **Step 0 — Test harness:** `vitest.config.ts` (node env, explicit include list) plus `npm test`. Suites previously "passed" without running; the no-op `describe` guards are gone, so a missing runner now fails loudly. 138 tests.
- **Step 1 — Pure layer:** `src/utils/notificationRealtime.ts` — `validateRealtimePayload` (all 14 columns, rejects other users' rows and unkeyable timestamps), `classifyInsert` (merge vs out-of-window, judged against the lane's **server cursor**, not its rendered rows), `mergeRealtimeRow` / `applyRealtimeUpdate` (delegating order and de-dup to `mergeNotifications`), and `createTrailingScheduler`.
- **Step 2 — Migration:** `REPLICA IDENTITY FULL` and a guarded, schema-qualified `supabase_realtime` publication add. No RLS/grant change — the existing `auth.uid() = user_id` SELECT policy already scopes the stream.
- **Step 3 — Kill switch, end to end:** `notifications.realtime_enabled` in `app_config`, allowlisted in `set_app_flag` with a strict `{ enabled: boolean }` shape, surfaced by `get_public_flags()`, read via `useNotificationsRealtimeEnabled()` (which ignores placeholder data and treats a failed fetch as OFF), and toggleable from the admin Feature Flags panel.
- **Step 4 — Transport:** `useNotificationsRealtime.ts` owns exactly one channel, `notifications:<userId>`, filtered server-side to `user_id=eq.<uid>`, INSERT + UPDATE only (DELETE carries no usable payload and the app never hard-deletes).
- **Step 5 — State machine:** `disabled → disconnected → reconciling → ready`. Joining *and* rejoining reconcile before any event is trusted; events outside `ready` are dropped because the gating reconcile is a superset of them.
- **Step 6 — Coalescing:** trailing 250ms scheduler, so a like storm produces one reconcile at the end of the burst rather than one per event. Backstop polling never stops — it slows to 60s while `ready`, so a silently dead socket still self-heals.
- **Step 7 — Dev tools:** token-keyed duplicate-channel assertion (a second provider is a bug, not a second user) and a DEV-only `realtime: <status>` footer in the drawer.
- **Invariant:** realtime never writes rows while a read mutation holds them, never merges into a lane that hasn't loaded or is recovering, and never adds a row to the unread lane that is already read.

## Phase 2.5 — Reversible notification lifecycle / retraction (done)

A notification for a reversible action is **live state**, not an event log entry. Undoing the source action retracts the notification; redoing it produces a fresh one.

- **Tombstone, not delete:** `notifications.retracted_at`. Every read path filters `retracted_at IS NULL` server-side (`fetchNotifications`, both membership probes, `get_unread_notification_count`, `mark_all_notifications_as_read`), so no client path can render or count one. Soft, because a hard `DELETE` carries no usable realtime payload.
- **Identity:** partial unique indexes on ACTIVE rows only — `(user_id, sender_id, entity_type, entity_id)` for top-level likes (excludes comment likes via `metadata->>'comment_id' IS NULL`, which share the parent `entity_id`) and `(user_id, sender_id)` for follows. Insert triggers use **targeted** `ON CONFLICT (cols) WHERE <predicate> DO NOTHING`, so a primary-key or future unique violation still raises instead of being swallowed. This is what stops the badge climbing on every re-like.
- **Re-like creates a NEW row** rather than un-retracting the old one: `is_read` is monotonic app-wide, and resurrecting a read row would either lie about read state or break that invariant.
- **Retraction triggers** (`SECURITY DEFINER`, `search_path = public`): `AFTER DELETE` on `post_likes`, `recommendation_likes`, `follows`; `AFTER UPDATE ... WHEN (is_deleted false → true)` on both comment tables. Comment deletion retracts the comment, reply, mention and comment-like rows pointing at it (`type IN ('comment','like')` — `mention` is not a type, it is `metadata.event` on `comment`); system and moderation rows referencing the same comment are deliberately left alone.
- **Backfill + gate:** 76 pre-existing orphaned like/follow rows retracted, older duplicates per identity retracted keeping the newest, then a `RAISE EXCEPTION` gate — the migration refuses to create the unique indexes if any duplicate identity survives.
- **Client removal:** realtime UPDATE with a non-null `retracted_at` removes the row from **both** lanes immediately, unconditionally (a retraction is not an optimistic conflict — the row no longer exists). The id is remembered in a bounded `retractedIdsRef` so a fetch already in flight cannot merge it back; every server payload passes through `applyServerRows` (optimistic reads re-applied, tombstones stripped). The badge is never adjusted locally — the coalesced reconcile re-reads the count RPC.
- **Older pages:** a head refresh only sees the newest window, so it can never notice a retraction on page 2+. `fetchActiveMembership` + an All-lane `onHeadCommitted` pass covers those, with its own sequence token, all-or-nothing commit, and a gate-release drain. The manual Refresh runs **one owner, one coordinated pass over both lanes** — two independently owned passes would compete and flap `historyStale`.
- **Retention:** `prune_retracted_notifications(limit)` (`service_role` only, `ORDER BY retracted_at, id` so batches always progress) on a nightly `pg_cron` job, deleting tombstones older than 60 days.
- **Verified in DB:** 5 retraction triggers, 5 indexes, 5 `SECURITY DEFINER` functions, both RPCs filtered, `REPLICA IDENTITY FULL`, table in `supabase_realtime`, cron job scheduled, and a live `ON CONFLICT` inference probe that inserted 0 rows without erroring. 143 unit tests pass.

## Phase 2.5A — Comment lifecycle sync (done)

Phase 2.5 covered post likes, recommendation likes, follows and comment deletion. 2.5A closes the two remaining reversible paths: **comment likes** and **comment edits**. Zero client changes — retraction is an `UPDATE`, so the existing realtime channel and coalesced count reconcile deliver it.

- **State repair (one-off):** active comment-like rows were validated against their *full* canonical identity (recipient = comment author, `entity_id` = parent post/recommendation, `entity_type` agreement, sender still holds a like) and orphans retracted; duplicates per identity retracted keeping the **newest** (`created_at DESC, id DESC` — `retracted_at` cannot order active rows, they are all NULL); then a `RAISE EXCEPTION` gate before the index is created.
- **Identity:** `uniq_active_comment_like_notifications` on `(user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id'))` `WHERE retracted_at IS NULL AND type='comment' AND metadata->>'event'='like'`. The `comment_id` expression is required — two likes on different comments of the same post share `entity_id`. `toggle_comment_like` uses the **exact** same column list and predicate in its targeted `ON CONFLICT`, or Postgres cannot infer the index.
- **Unlike retracts, re-like inserts fresh:** the unlike branch retracts the active row (never touching `is_read`); the like branch's existence guard is filtered on `retracted_at IS NULL`, so a re-like is a new unread event rather than being permanently suppressed.
- **Single writer, DB-enforced:** all `comment_likes` mutation policies dropped and `INSERT/UPDATE/DELETE` revoked from `anon`/`authenticated` (verified beforehand: every mutation in the codebase already went through the RPC). `SELECT` stays for counts and liked-state; `EXECUTE` on `toggle_comment_like` stays for `authenticated`. No trigger needed — the RPC is now genuinely the only writer.
- **One mention-parsing authority:** internal `parse_comment_mentions(content, author_id)` reproduces the previous inline behaviour exactly (same regex, lower/trim normalization, dedupe on handle, 5-mention cap counted only for resolvable non-self profiles, `deleted_at IS NULL` filter). `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`; both `add_comment` and `update_comment` call it.
- **Edit reconciliation driven by membership changes, not a diff:** removals come from `DELETE ... RETURNING mentioned_user_id` and additions from `INSERT ... ON CONFLICT DO NOTHING RETURNING mentioned_user_id`, so overlapping edits can't both claim the same mention is new and retries stay idempotent. Removed mentions retract; genuinely inserted ones notify.
- **Preview refresh per row shape:** mention/reply rows update `message` (title untouched); plain "commented on …" rows update `metadata.comment_text` only — their `message` is the event sentence and must never be overwritten with raw comment text; comment-like rows have no body preview and are left alone. An edit is not a new event: no `is_read` reset, no `created_at` change, no reordering.
- **URLs:** stale singular `/recommendation/<id>` fixed to `/recommendations/<id>` in `toggle_comment_like`, `add_comment` and existing rows.
- **Verified in DB:** all four functions `SECURITY DEFINER` with pinned `search_path` (explicitly re-declared, not inherited — an accidental `SECURITY INVOKER` here would break liking entirely now that direct DML is revoked), `parse_comment_mentions` not executable by `anon`/`authenticated`, `toggle_comment_like` executable by `authenticated`, `comment_likes` down to `SELECT` with 0 mutation policies, unique index present, 0 stale URLs. 143 unit tests pass.

**Rollout rule for future notification schema changes:** expand → deploy → activate. Add the nullable column and read-path filters first, deploy, then activate writers. Phase 2.5 shipped stable and is deliberately not replayed.

## Phase 2.3b — Server-enforced notification preferences (done)

Preferences are now authoritative **at the database boundary**: a disabled category creates no row, so there is no unread count, no realtime event, and no retraction lifecycle to reconcile. Nothing in `notification_preferences` was enforced by producers before this phase — `journey_notifications_enabled` was stored and shown in Settings but ignored by `generate-smart-notifications`.

- **Six new categories** on `notification_preferences`, all `NOT NULL DEFAULT true` so existing behaviour is preserved: `likes_enabled`, `comment_likes_enabled`, `comments_enabled`, `replies_enabled`, `mentions_enabled`, `follows_enabled`. `journey_notifications_enabled` (default true) and `weekly_digest_enabled` (default false) unchanged.
- **One authority:** `public.notification_allowed(_user_id, _category)` — `plpgsql` (not `sql`, because `RAISE WARNING` is a PL/pgSQL statement), `STABLE SECURITY DEFINER`, pinned `search_path`. Missing preference row = documented defaults. An unrecognised category returns `false` **and warns**, so a producer-side typo can neither silently allow nor silently mute a category. `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`, granted to `service_role` only — verified via `has_function_privilege`.
- **All 8 in-database producers guarded**, each patched from its live `pg_get_functiondef()` so Phase 2.5 / 2.5A retraction, targeted `ON CONFLICT` inference, auth guards and counters survive intact: both like triggers, both comment triggers, `create_follow_notification`, `add_comment` (mentions + replies), `update_comment` (mentions on edit), `toggle_comment_like`. Verified in DB: every function whose body inserts into `public.notifications` references `notification_allowed`.
- **Comment precedence is now enforced in the database, not just documented.** The two comment triggers previously fired on *every* comment insert, so one comment could produce up to three notifications for one recipient. They now skip when `parent_id IS NOT NULL` (replies belong to `add_comment`, which correctly targets the parent comment's author) and skip when the content owner appears in `parse_comment_mentions`. Result: **one category per recipient per source comment**, mention > reply > generic comment. This is a de-duplication fix independent of preferences.
- **Precedence survives edits:** adding `@owner` in `update_comment` inserts the mention row and **only then** retracts that recipient's active generic-comment row for the same source comment (insert-before-retract — if the insert is skipped or fails the user keeps what they had). With `mentions_enabled = false` no mention row is created and the existing generic row is left alone: a disabled category must never *remove* a notification already received. The reverse transition is deliberately asymmetric — removing a mention retracts the mention row and does **not** resurrect a generic comment notification, since re-notifying for an old comment is misleading and the user may already have read it.
- **`generate-smart-notifications` now honours `journey_notifications_enabled`** before its expensive per-item loop. Because there is no FK between `user_stuff` and `notification_preferences`, this is a bounded bulk lookup (**chunked at 200 ids**, sets merged) rather than an embedded join. **All-or-nothing:** any chunk error aborts the run with zero notifications created — cron retries, an unwanted notification cannot be taken back. `send-weekly-digest` unchanged (missing row = `false` there, by design).
- **Not disableable:** `system` notifications (moderation, security, account, admin). No control is exposed and no producer is gated.
- **Semantics:** disabling affects future events only — no retraction, no read-state change, no deletion. Re-enabling never backfills.
- **Client:** `notificationPreferencesService` no longer resolves the auth user *inside* a write; the caller passes a captured `userId`, so a queued mutation cannot land on another account's row. Writes are **update-then-insert**, never a full-row upsert — a full upsert would overwrite the user's other categories with defaults whenever two toggles race. Defaults are supplied only on the insert path, which also fixes the old bug where a user's *first* toggle left local state `null`.
- **Concurrency and account safety** (pure helpers in `src/utils/notificationPreferences.ts`, unit tested without a renderer): per-key monotonic sequences so a stale response can never clobber a newer value or touch another key; success merges **only** its key plus server-owned fields; failure reverts **only** its key; refetch is authoritative except for keys with a write in flight; an account-generation counter bumped on every `user.id` change **and sign-out** discards late resolutions silently (no state write, no toast) and resets state to defaults + skeletons rather than showing the prior account's toggles.
- **UI:** `ActivityNotificationsCard` replaces the "coming soon" placeholder in the Notifications tab — one switch per category, skeletons while loading, per-switch pending state, `htmlFor` labels wired to descriptions via `aria-describedby`. The two legacy journey toggles now go through the same single `setPreference` write path.
- **Verified:** 0 null preference values; `authenticated` and `anon` cannot execute `notification_allowed`; `service_role` can; all 8 producers guarded; 170 unit tests pass.

**Rollback order matters:** restore the prior producer bodies *first*, then drop the columns — dropping columns while the new bodies are live would break every like and comment.

## Next

- **Phase 2.6 — Coverage:** emit review and journey notifications once those surfaces exist, then extend the resolver's allowlist.
- **Deferred:** quiet hours, per-actor muting, push/email delivery, the full `/notifications` page, rich previews.



