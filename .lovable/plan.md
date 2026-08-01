# Phase 2.5 — Reversible notification lifecycle (retraction) — revised

Both reviews are right, and I verified their corrections against the live database rather than accepting them. Three of the five corrections hold, one is already satisfied by existing code, and one was based on a wrong guess about our data. Details below, then the revised plan.

## Verification of the review points

| Point | Verified | Outcome |
| --- | --- | --- |
| Comment delete is a soft UPDATE, so `AFTER DELETE` never fires | **True.** `delete_comment()` does `UPDATE ... SET is_deleted = true` for the comment and its replies | Corrected — retract on the `is_deleted` transition |
| Retraction triggers need `SECURITY DEFINER` | **Already the pattern.** All three notification triggers are `SECURITY DEFINER` with `SET search_path TO 'public'` | Retraction functions mirror it exactly; no new grants to users |
| Follow notifications may have NULL `entity_id`, defeating a combined index | **False for our data.** All 27 follow rows have `entity_type='profile'` and `entity_id = follower_id`, non-null; 99 like rows all non-null too | Still splitting the index, but for the *right* reason (see below) |
| Content-deletion and mention-edit scope is underspecified | **True** | Both dropped from this phase |
| No daily workflow to hang retention on | **True.** `cron.job` has only an hourly stats refresh and a weekly media cleanup | Dedicated bounded pg_cron job |

## Decisions where the reviews disagree with each other or with me

**Index split — yes, but not for null-safety.** ChatGPT's null argument does not apply to our rows, and I would rather not design around a hypothetical. The real reason to split is that follow identity is genuinely different: for follows, `entity_id` is a *copy* of `sender_id`, so including it in the key is redundant, and if a future follow notification ever pointed at something else the combined index would silently stop enforcing anything. Two indexes, each stating its own identity honestly. Both get `sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL` in the predicate anyway, so a malformed future row can never slip past uniqueness unnoticed.

**Mention-edit retraction — dropped.** Both reviews say defer; they are right, and the reason is concrete: retracting a removed mention requires diffing the old and new mention sets during a post edit, which is application flow, not a lifecycle trigger. It does not belong in the same migration as like/unlike.

**Post/recommendation deletion — dropped.** Phase 2.2C already renders unavailable targets gracefully, so this is a polish item, not a correctness gap. Bundling it would pull comments, mentions, and replies into a phase that should be about undoing *source actions*.

**Comment soft-delete — kept, narrowed.** Not because deletion is reversible, but because a deleted comment's notification keeps exposing its quoted preview text, which is a real leak. Restricted to retracting the notification whose `metadata->>'comment_id'` matches, nothing else.

**One thing neither review raised, which I want in:** a verification query that proves zero duplicate active identities *before* the unique index is created, run as its own step. If the backfill missed a case, `CREATE UNIQUE INDEX` fails and aborts the whole migration with an opaque error. Checking first turns that into a readable number I can act on.

## Committed scope

Post likes, recommendation likes, follows, comment soft-deletion, realtime removal, count reconciliation, bounded retention. Nothing else.

## Target behaviour

```text
hana likes    -> INSERT active row            -> 65
hana unlikes  -> UPDATE retracted_at = now()  -> 64, row disappears
hana re-likes -> INSERT a new active row      -> 65   (never 66)
repeat x10    -> still 65, one visible row
```

Why a fresh row instead of reactivating the old one: `mergeRealtimeRow` and `mergeNotifications` both enforce that `is_read: true` is monotonic, and the Unread lane keeps sticky-read rows visible until the drawer closes. Reactivation means flipping a read row back to unread and moving its `created_at` — a special case carved into the single rule holding read state stable across two lanes, a poller, and a socket. Retract + insert needs no exceptions: retraction is a removal, a re-like is an ordinary insert with a new id.

## Step 1 — Migration A: column, backfill, verification

1. `ALTER TABLE public.notifications ADD COLUMN retracted_at timestamptz NULL`.
2. Retract like/follow notifications whose underlying `post_likes` / `recommendation_likes` / `follows` row no longer exists.
3. Among the remaining active rows, keep the newest per identity and retract older duplicates. The inflated count settles to truth here.
4. **Verify**: count remaining duplicate active identities. Must be zero before Step 2 runs.

## Step 2 — Migration B: indexes

```sql
CREATE UNIQUE INDEX uniq_active_like_notifications
  ON public.notifications (user_id, sender_id, entity_type, entity_id)
  WHERE retracted_at IS NULL AND type = 'like'
    AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL;

CREATE UNIQUE INDEX uniq_active_follow_notifications
  ON public.notifications (user_id, sender_id)
  WHERE retracted_at IS NULL AND type = 'follow'
    AND sender_id IS NOT NULL;
```

Plus two active-only query indexes so accumulating tombstones never make live reads scan dead history:
- `(user_id, created_at DESC, id DESC) WHERE retracted_at IS NULL` — All lane keyset.
- `(user_id, created_at DESC, id DESC) WHERE retracted_at IS NULL AND is_read = false` — Unread lane keyset and the count RPC.

Comment, mention, and system notifications are excluded from uniqueness — multiple per actor is legitimate there.

## Step 3 — Migration C: triggers and RPCs

- The three insert triggers gain `ON CONFLICT DO NOTHING` against the new indexes, so a double-fire is a no-op rather than an error.
- New `AFTER DELETE` triggers on `post_likes`, `recommendation_likes`, `follows`, each `SECURITY DEFINER SET search_path TO 'public'` matching the existing pattern, setting `retracted_at = now(), updated_at = now()` on the matching **active** row only. `is_read` is untouched — retraction removes the row from view and from the count, so touching read state adds nothing and would fight monotonicity.
- Comment retraction fires on the real transition: `AFTER UPDATE ON post_comments / recommendation_comments WHEN (OLD.is_deleted = false AND NEW.is_deleted = true)`, retracting the notification whose `metadata->>'comment_id'` equals the comment id. This covers the cascaded reply soft-deletes inside `delete_comment()` for free, since those are UPDATEs too.
- `get_unread_notification_count` and `mark_all_notifications_as_read` gain `AND retracted_at IS NULL`. `mark_notifications_as_read` is left permissive — marking an already-retracted row read is harmless and refusing it would need error handling on a path that no longer matters.
- Explicitly not applied to system, moderation, or security types: those are durable, and a correction is a new notification, not a silent erasure.

## Step 4 — Read path

`fetchNotifications` and `fetchUnreadMembership` add `.is('retracted_at', null)`. Retraction then self-heals through the poller even with the socket down, and unread-membership revalidation drops retracted rows for free. `retracted_at?: string | null` is added to the `Notification` interface; Supabase types regenerate after the migration.

## Step 5 — Realtime retraction

- `validateRealtimePayload` validates `retracted_at` as ISO string or null; malformed drops the payload to a reconcile, as today.
- A validated UPDATE with `retracted_at !== null` is handled as a **removal, not a patch**: drop the id from the All lane, the Unread lane, and `stickyReadIdsRef`, then let the existing 250 ms coalesced scheduler refresh the count via the RPC. The count is never derived from payload arithmetic.
- `applyRealtimeInsert` refuses rows already carrying `retracted_at`.
- **Retraction dominates local read projections**: a retracted id is recorded in a short-lived `retractedIdsRef`, and an in-flight read mutation that resolves afterwards cannot re-add it. Without this, a mark-read round trip that started before the retraction would restore the row on release.
- Retractions arriving while a read mutation holds rows are dropped by the existing gate and picked up by the release-time reconcile. Mutation-exclusivity and release-before-reconcile invariants are unchanged.
- Grouping recomputes from the reduced row set; `notificationGrouping.ts` needs no changes.

## Step 6 — Bounded retention

`prune_retracted_notifications(p_limit int default 5000)` deletes in a bounded batch by `ctid` where `retracted_at < now() - interval '60 days'`, returning the number deleted — never one unbounded DELETE, which would generate heavy WAL and hold locks as the table grows. Scheduled via its own nightly `pg_cron` job, since no daily notification workflow exists to host it. Retracted rows are never returned to a user or counted at any point in their life; the window exists purely for debugging and abuse analysis.

## Step 7 — Tests

Extend `notificationRealtime.test.ts`: a retraction UPDATE removes the row rather than patching it, a retracted INSERT is refused, `retracted_at` validation accepts null/ISO and rejects garbage, a late-resolving read mutation cannot restore a retracted id, and a burst of retractions coalesces to exactly one reconcile. All 138 existing tests stay green.

## Step 8 — Docs

Append Phase 2.5 to `docs/NOTIFICATION_CENTER_ROADMAP.md` with the standing invariant: **like and follow notifications are projections of live state — at most one active row per (recipient, type, target, actor); undoing the source retracts, redoing it inserts a new row; retracted rows are invisible to users and to the count; read state remains monotonic.** Record the deferred items (target deletion, mention-edit diffing) as named follow-ups so they are not lost.

## Manual verification

1. Rishab at 64. Hana likes → 65, row appears. Hana unlikes → **64**, row gone, no refresh.
2. Re-like → 65. Toggle five more times → still 65, one visible row, newest timestamp.
3. Read the like, Hana unlikes then re-likes → a fresh unread row appears; the old one does not resurrect.
4. Same cycle with the drawer closed → count correct on open.
5. Follow / unfollow / refollow → identical single-row behaviour.
6. Hana comments, Hana deletes the comment → notification disappears, preview text gone.
7. Delete a comment that has replies → parent and reply notifications all retracted.
8. Realtime kill switch off → all of the above still correct within one poll cycle.
9. Two tabs, rapid toggling in one → the other converges, no duplicate rows.

## Out of scope

Hard deletes, DELETE realtime subscriptions, post/recommendation deletion cleanup, mention-edit diffing, changes to grouping or pagination, deriving counts from payloads, push/email suppression windows (`retracted_at` is the hook a future delivery worker checks), per-type preferences (2.3b), the `/notifications` route.
