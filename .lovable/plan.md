# Phase 2.5A — Comment lifecycle sync (then preferences)

## Verdict on Codex's answer

I agree with almost all of it, and it's more right than my first draft was.

Agreed, no changes needed:
- **Don't expand realtime.** The channel is generic: INSERT + UPDATE + retraction-as-UPDATE + count reconcile + polling backstop. New notification types inherit it for free. Adding a DELETE subscription buys nothing — retraction is an UPDATE, and pruning only deletes rows invisible for 60 days.
- **Don't redo the Phase 2.5 rollout.** Expand/deploy/activate is a deployment strategy, not a missing feature. Phase 2.5 is live and correct; replaying the migration, re-running the backfill, or adding compat branches for a client nobody is served would add risk for zero user value. Record it as a rule for the *next* schema change.
- **Leave deferred:** review/journey notifications (product surface doesn't exist), target-deletion retraction (2.2C already degrades gracefully), grouping beyond likes.
- **Preferences next**, enforced at creation rather than filtered in the drawer.

Where I'd extend it: Codex found one comment-lifecycle gap. I checked the database and there are **three**, all in the same two RPCs, so they should land as one migration.

## The three confirmed gaps

Verified by reading `toggle_comment_like` and `update_comment` in the database:

1. **Comment un-like never retracts.** `toggle_comment_like` deletes the `comment_likes` row and returns — it never touches the notification. `comment_likes` has no triggers at all. So un-liking a comment leaves a live unread row and the badge never drops. This is the same class of bug Phase 2.5 fixed for post/recommendation likes, just missed because this path is an RPC rather than a trigger.
2. **Re-like will be suppressed once retraction exists.** The insert is guarded by a `NOT EXISTS` that does **not** filter `retracted_at IS NULL`. The moment gap 1 is fixed, a retracted row would block every future comment-like notification from that actor on that comment — permanently silent.
3. **Comment edits don't reconcile mentions or previews** (Codex's point). `update_comment` only rewrites `content`: removing `@hana` leaves her mention notification live, adding `@hana` creates nothing, and existing mention/comment previews keep the pre-edit text.

Also found while reading: `toggle_comment_like` builds `action_url` as `/recommendation/<id>` (singular) — the stale form 2.2B corrected everywhere else. The resolver prefers `entity_id`, so it isn't breaking navigation today, but it's a leftover and should be fixed in the same pass.

## Plan

### 1. Retract on comment un-like (`toggle_comment_like`)
On the DELETE branch, set `retracted_at = now()` on the matching **active** notification (same `user_id`/`sender_id`/`entity_id`/`entity_type`/`metadata.comment_id`, `event = 'like'`). Realtime delivers the UPDATE, the client drops the row from both lanes, and the coalesced reconcile re-reads the count RPC — no client change required.

### 2. Make the insert guard retraction-aware
Add `AND n.retracted_at IS NULL` to the `NOT EXISTS` on the like branch, so a re-like after a retraction creates a **fresh unread row** (consistent with Phase 2.5: `is_read` stays monotonic, retracted rows are never resurrected). Fix the singular `/recommendation/` action_url to `/recommendations/` in the same function.

### 3. Reconcile mentions and previews on edit (`update_comment`)
After the content update, inside the same transaction:
- Re-parse mentions with the **same** regex, dedup and 5-cap logic `add_comment` uses (extract it so the two can't drift).
- **Removed** mentions: delete the `comment_mentions` row and retract its active mention notification.
- **Added** mentions: insert the `comment_mentions` row and a mention notification, reusing `add_comment`'s guard shape plus `retracted_at IS NULL`; skip self-mentions and deleted profiles.
- **Kept** mentions: leave the notification's read state alone, only refresh `message` to `LEFT(new_content, 200)`.
- Refresh the preview `message` on the comment/reply notifications for this `comment_id` too, so no drawer row shows pre-edit text.
- Read state is never reset by an edit — an edit is not a new event.

### 4. Documentation
- Correct the stale **Phase 2.3** roadmap entry: it still describes "representative title + and N others", no profile-name resolution, and an event-count chip. Shipped behaviour is verified display names, event-aware singleton copy, no count chip, and shared React Query profile keys with `ProfileAvatar`.
- Add **Phase 2.5A** with the three gaps and their fixes, and update the behaviour-matrix rows for comment likes and mentions.
- Add a short **"Notification schema rollout rule"** note: future schema changes go expand → deploy → activate; Phase 2.5 shipped stable and is deliberately not being replayed.

### 5. Then Phase 2.3b — Preferences
Server-enforced at creation: the producers (`add_comment`, `toggle_comment_like`, the like/follow triggers) check the recipient's per-type preference before inserting, so a disabled category produces no row at all — no unread count, no realtime traffic, no retention cost. Existing `notification_preferences` infrastructure gets extended rather than replaced. Scoped as its own phase after 2.5A lands.

## Technical notes

- One migration, replacing `toggle_comment_like` and `update_comment` via `CREATE OR REPLACE`, both already `SECURITY DEFINER` with a pinned `search_path`. No table, RLS, or grant change; no new triggers on `comment_likes` (the RPC is the single writer for that path).
- The mention-parsing helper is a new `SECURITY DEFINER` function returning the resolved user ids for a body, called by both `add_comment` and `update_comment`.
- No client changes expected. Comment likes and mentions stay singletons with their own `?commentId` destination, so grouping is untouched.
- Verification: after the migration, probe like → unlike → re-like on a comment (tombstone, then a *new* row), and edit a comment to add and remove a mention. Then run the unit suite (143 tests) — pure-layer behaviour shouldn't move.

## Manual test pass

Comment-like → unread row appears; unlike → row disappears within ~250ms and the badge drops; re-like → a new unread row, not a resurrected read one; self-like → nothing. Edit a comment to drop `@user` → that mention row disappears; edit to add `@user` → a new mention row; edit the text only → same rows, read state preserved, preview text updated.
