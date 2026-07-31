# Phase 2.4 audit + Phase 2.5 — Retraction integrity (undo)

## Part 1 — Phase 2.4 audit result

Verified against the code and the database, not assumed:

- `src/utils/notificationRealtime.ts` + 24 tests, `src/hooks/notifications/useNotificationsRealtime.ts` (state machine `disabled → disconnected → reconciling → ready`, one user-scoped channel, dev duplicate-channel guard, 250 ms trailing coalescer) are all present.
- `useNotifications.ts` wires `onInsert` / `onUpdate` / `onReconcile`, gates merges on mutation pending, lane `hasLoadedRef`, `isRecovering`, and the lane `serverCursorRef` boundary, and slows the backstop poll only while `ready`.
- `realtimeStatus` is plumbed hook → `UseNotificationsResult` → `NotificationsContext` → dev-only drawer footer.
- Kill switch is end to end: `app_config` row, `set_app_flag` allowlist, `get_public_flags()`, `useNotificationsRealtimeEnabled()` status-gated, admin toggle.
- DB: `notifications` is in `supabase_realtime` with `REPLICA IDENTITY FULL`.

No leftover or dead code from the phase. Phase 2.4 is complete. The behaviour you are seeing is not a 2.4 bug — it is a gap that predates it.

## Part 2 — Why the count keeps climbing

Confirmed from the database:

- `post_likes` has only `on_new_post_like` (AFTER INSERT). Same for `recommendation_likes` and `follows`. There is **no DELETE trigger anywhere**, so unliking removes the like but leaves the notification row.
- There is no uniqueness on notifications, so every re-like inserts a **brand new row**. 64 → 65 → 66 is real rows accumulating. You only see one item because the 2.3 grouping layer collapses them visually — the rows and the unread count are genuinely duplicated underneath.

So two distinct defects: retraction is not propagated, and repeat actions are not idempotent.

## Part 3 — How the big platforms handle it

Instagram/Twitter treat a like/follow notification as a **projection of a live relationship**, not an event log entry:

1. One notification row per (recipient, type, target, actor). Re-liking touches that row, it never creates a second one.
2. Undoing the action retracts the notification — it disappears from the list and stops counting.
3. Structural events (comments, mentions) are retracted when the comment is deleted; the parent content disappearing hides the row rather than leaving a dead link.

We can match all three.

## Part 4 — Design: soft retraction, not hard delete

Hard `DELETE` looks tempting but is the wrong tool here: Supabase realtime does not apply RLS to DELETE payloads, so we would have to subscribe to unfiltered deletes. Instead, retraction becomes an **UPDATE**, which our existing RLS-filtered UPDATE subscription already delivers safely and instantly.

```text
hana likes    -> upsert row, retracted_at = NULL, is_read = false, created_at = now()  (INSERT or UPDATE)
hana unlikes  -> UPDATE row SET retracted_at = now()      -> realtime UPDATE -> row vanishes, count drops
hana re-likes -> UPDATE same row, retracted_at = NULL      -> row reappears at top, count +1 (never +2)
```

### Step 1 — Migration

1. `notifications.retracted_at timestamptz NULL`, partial index `(user_id) WHERE retracted_at IS NULL AND is_read = false`.
2. Unique index on retractable identity: `(user_id, type, entity_type, entity_id, sender_id)` restricted to `type IN ('like','follow')` — the classes of event that are reversible and actor-scoped. Comments/mentions stay append-only (many per actor is legitimate).
3. Backfill: collapse existing duplicate like/follow rows to the newest per identity group and retract notifications whose underlying like/follow no longer exists, so your 66 settles to the truth before the index is created.
4. Rewrite `create_post_like_notification`, `create_recommendation_like_notification`, `create_follow_notification` as upserts: `ON CONFLICT ... DO UPDATE SET created_at = now(), updated_at = now(), is_read = false, retracted_at = NULL`.
5. New AFTER DELETE triggers on `post_likes`, `recommendation_likes`, `follows` that set `retracted_at = now()` on the matching row.
6. New AFTER DELETE trigger on `post_comments` / `recommendation_comments` retracting the notification whose `metadata->>'comment_id'` matches.
7. Update `get_unread_notification_count` and `mark_all_notifications_as_read` to ignore retracted rows.

### Step 2 — Read path

`fetchNotificationsPage` and `fetchUnreadMembership` add `.is('retracted_at', null)`. Retraction therefore also self-heals on the next poll even if the socket is down.

### Step 3 — Realtime path

- `validateRealtimePayload` accepts `retracted_at` (string or null).
- A validated UPDATE carrying `retracted_at != null` **removes** the row from both lanes instead of patching it, then schedules the coalesced reconcile that corrects the count.
- The monotonic `is_read` rule gets one narrow exception: an UPDATE whose `created_at` is strictly newer than the loaded row's (a re-trigger) may reset `is_read` to false. Without this, a re-like after you had read the original would stay silently read.
- Retracted rows are never merged by `applyRealtimeInsert`.
- A retraction arriving for a row a mutation currently owns is still dropped by the existing gate and picked up by the release-time reconcile — the invariant does not change.

### Step 4 — Other undo cases to cover

| Undo | Handling |
| --- | --- |
| Unlike post / recommendation | DELETE trigger retracts (Step 1.5) |
| Unfollow | DELETE trigger retracts |
| Delete own comment | DELETE trigger retracts via `metadata.comment_id` |
| Re-like / re-follow | Upsert, count moves by at most 1 |
| Author deletes the post/recommendation | Retract dependent notifications in the same delete path so the drawer never links to a dead target |
| Mention removed while editing a post | Retract the mention notification for actors no longer mentioned |
| Read state | Unchanged — read is not retraction, and mark-all still ignores retracted rows |

Review/comment likes have no notification trigger today, so nothing to retract there; out of scope.

### Step 5 — Tests

Extend `notificationRealtime.test.ts`: retraction UPDATE drops the row from a lane, retracted INSERT is refused, `created_at`-bump un-reads a row while an equal/older UPDATE cannot, and a retraction burst coalesces to one reconcile. Existing 138 tests must stay green.

### Step 6 — Docs

Append Phase 2.5 to `docs/NOTIFICATION_CENTER_ROADMAP.md` with the standing invariant: **like and follow notifications are relationship projections — one row per (recipient, type, target, actor), retracted rather than deleted.**

## Manual verification

1. Rishab at 64. Hana likes → 65 and the row appears. Hana unlikes → back to **64**, row gone from the drawer, no refresh.
2. Re-like → 65, not 66. Repeat five times → still 65, one row, timestamp refreshes to "just now".
3. Read the like, then have Hana unlike and re-like → row returns as unread.
4. Same cycle with the drawer closed → count is correct when you open it.
5. Follow / unfollow / re-follow → same single-row behaviour.
6. Hana comments, then deletes the comment → notification disappears.
7. Realtime flag off → all of the above still correct within one poll cycle.

## Out of scope

Hard deletion / retention pruning, DELETE realtime events, per-type preferences (2.3b), the `/notifications` route, web push.
