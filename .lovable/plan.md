# Phase 2.5b — Close the last retraction gap (comment likes)

## Recommendation

Don't reopen realtime or re-roll retraction broadly — both are stable and already cover the reversible actions that matter (post likes, recommendation likes, follows, comment/reply/mention deletion). There is exactly **one** real gap left, confirmed against the database: `comment_likes` has **no notification trigger at all**. Comment-like notifications are inserted from client code, so:

- un-liking a comment leaves a live notification and the unread badge never drops;
- re-liking can add another row, because the partial unique index protects only trigger-inserted rows written with the targeted `ON CONFLICT`;
- realtime works fine here — the problem is that no retraction event is ever produced.

This is a small, contained migration that makes comment likes behave exactly like the other likes. Everything else on the roadmap (per-type preferences 2.3b, review/journey coverage 2.6, mention-edit diffing) stays deferred.

## What changes

1. **Create the comment-like notification in the database**, not the client, matching `create_post_like_notification`:
   - `AFTER INSERT` on `comment_likes`, `SECURITY DEFINER`, `search_path = public`.
   - Skips self-likes; resolves the comment's author and its parent post/recommendation so the destination stays `/post/:id?commentId=<uuid>` or `/recommendations/:id?commentId=<uuid>` (unchanged resolver contract — `type = 'like'`, `metadata.comment_id` set).
   - Targeted `ON CONFLICT (user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id')) WHERE retracted_at IS NULL ... DO NOTHING` against a new partial unique index for comment likes, so a primary-key or unrelated violation still raises.

2. **Retract on un-like**: `AFTER DELETE` on `comment_likes` sets `retracted_at = now()` on the matching active row (same identity tuple). Realtime then removes it from both lanes and the coalesced reconcile re-reads the count RPC — no client change needed.

3. **New partial unique index** on active comment-like rows keyed by `(user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id'))` where `retracted_at IS NULL AND type = 'like' AND metadata->>'comment_id' IS NOT NULL`. This is disjoint from the existing top-level-like index, which explicitly excludes rows carrying `comment_id`.

4. **Backfill, gated**: retract comment-like notification rows whose `comment_likes` row no longer exists, then retract older duplicates per identity keeping the newest, then `RAISE EXCEPTION` if any duplicate identity survives — so the index can never be created over dirty data.

5. **Remove the client-side insert** for comment likes so the trigger is the single writer (double-writing would be swallowed by `DO NOTHING`, but leaving it invites drift).

## Backward compatibility

- Existing comment-like rows keep rendering and routing; only orphans are tombstoned.
- No RLS/grant change: the existing `auth.uid() = user_id` SELECT policy and the `retracted_at IS NULL` server-side filters already cover the new rows.
- Nothing about the drawer, lanes, grouping, or the destination resolver changes. Comment likes remain singletons by design (they each carry their own `?commentId`).

## Technical notes

- Migration file adds: 1 insert function + trigger, 1 retract function + trigger, 1 partial unique index, backfill + duplicate gate — all in one transaction.
- Client edit: drop the notification insert in the comment-like path (`src/services/commentsService.ts` / the comment-like handler) after verifying which module writes it.
- Docs: add a Phase 2.5b section to `docs/NOTIFICATION_CENTER_ROADMAP.md` and update the behavior matrix row for comment likes.
- Verification: confirm 6 retraction/creation triggers, 6 indexes, then a live probe — like a comment, unlike it, and check the row is tombstoned rather than deleted.

## Manual test pass

Comment-like → recipient sees an unread row; unlike → row disappears within ~250ms and the badge drops; re-like → a **new** unread row (not a resurrected read one); self-like → no notification; delete the comment → the comment-like row retracts along with the comment row.
