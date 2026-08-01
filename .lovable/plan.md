# Phase 2.5 — Reversible notification lifecycle (retraction)

## Which approach

Hybrid, with Codex's core mechanic. All three agree on the diagnosis and on soft retraction over hard delete. They differ on one decision that actually matters for *our* codebase:

| Decision | ChatGPT | Codex | Chosen |
| --- | --- | --- | --- |
| Column | `cancelled_at` | `retracted_at` | `retracted_at` |
| Re-like | reactivate the old row (`is_read=false`, bump `created_at`) | insert a **new** row, old one stays retracted | **new row** |
| DB enforcement | partial unique index (tentative) | partial unique index, active rows only | partial unique index on active rows |
| Realtime | UPDATE carries retraction | same | same |
| Retention | not covered | prune retracted rows | prune, 60 days |
| Comments/mentions/system | nuanced, don't blanket-retract | same, plus never retract system/moderation | same |

**Why "new row" beats "reactivate" here, specifically for this app:** our merge layer treats `is_read` as monotonic on purpose — `mergeRealtimeRow` refuses to turn a locally-read row back to unread, and the Unread lane keeps "sticky read" rows visible until the drawer closes. Reactivating a row means flipping `is_read` back to `false` and moving its `created_at`, which forces a special-case exception into the single rule that keeps read state from flickering across two lanes, a poller, and a socket. That is the most delicate invariant in Phase 2.1–2.4, and it is not worth spending on a re-like. A retract + fresh INSERT needs **zero** exceptions: retraction is a removal, a re-like is an ordinary insert with a new id, and both already have a working path.

`retracted_at` over `cancelled_at` only because "cancelled" reads like a user-cancelled action in our domain (cancelled uploads, cancelled Mux jobs), while "retracted" unambiguously means the source event stopped being true.

The one thing Codex adds that neither of the other two do, and that we should keep, is **retention**: toggling generates rows forever under soft retraction, so pruning is part of the phase, not a later cleanup.

## Confirmed current state

- `post_likes`, `recommendation_likes`, `follows` each have only an AFTER INSERT trigger. There is **no DELETE trigger anywhere**, so unliking leaves the notification active.
- `notifications` has no uniqueness, so each re-like inserts a genuinely new row. 64 → 65 → 66 is real rows; the 2.3 grouping layer only hides it visually.
- `comment_likes`, `review_likes` have **no notification trigger at all** today, so there is nothing to retract there — out of scope rather than "to do".
- `notifications` is in `supabase_realtime` with `REPLICA IDENTITY FULL`, and the client subscribes to INSERT + UPDATE only. Retraction as an UPDATE therefore travels on the existing, RLS-filtered path.

## Target behaviour

```text
hana likes    -> INSERT active row            -> 65
hana unlikes  -> UPDATE retracted_at = now()  -> 64, row disappears
hana re-likes -> INSERT a new active row      -> 65   (never 66)
repeat x10    -> still 65, one visible row
```

## Step 1 — Migration: lifecycle column and identity

1. `ALTER TABLE public.notifications ADD COLUMN retracted_at timestamptz NULL`.
2. Backfill, in this order, so the index can be created cleanly:
   - retract notifications of type `like` / `follow` whose underlying like/follow row no longer exists;
   - for the remaining active like/follow rows, keep the newest per identity group and retract the older duplicates. Your 66 settles to the truth here.
3. Partial unique index enforcing one active notification per identity:
   `(user_id, type, entity_type, entity_id, sender_id) WHERE retracted_at IS NULL AND type IN ('like','follow')`.
   Database-level, because two tabs, retries, and concurrent trigger execution can all defeat client-side dedupe.
4. Supporting partial index for the unread count: `(user_id) WHERE retracted_at IS NULL AND is_read = false`.

Comment, mention, and system notifications are deliberately excluded from the index — multiple per actor is legitimate there.

## Step 2 — Migration: triggers

- Rewrite `create_post_like_notification`, `create_recommendation_like_notification`, `create_follow_notification` to `INSERT ... ON CONFLICT DO NOTHING` against the new index, so a duplicate insert from a double-fire is a no-op rather than an error.
- New AFTER DELETE triggers on `post_likes`, `recommendation_likes`, `follows`: set `retracted_at = now()`, `updated_at = now()` on the matching **active** row. `is_read` is left untouched — retraction removes the row from view and from the count, so mutating read state adds nothing and would fight the monotonic rule.
- New AFTER DELETE trigger on `post_comments` / `recommendation_comments`: retract the notification whose `metadata->>'comment_id'` matches. A deleted comment must not keep exposing its quoted preview text.
- `get_unread_notification_count` and `mark_all_notifications_as_read` gain `AND retracted_at IS NULL`.
- Explicitly **not** applied to moderation, security, or system notification types: those are durable messages, and a correction is a new notification, not a silent erasure.

## Step 3 — Read path

`fetchNotificationsPage` and `fetchUnreadMembership` add `.is('retracted_at', null)`. Retraction then self-heals through the poller even with the socket down, and unread-membership revalidation drops retracted rows for free.

## Step 4 — Realtime retraction

- `validateRealtimePayload` accepts `retracted_at` (ISO string or null) as a validated field; a malformed value drops the payload to a reconcile, as today.
- A validated UPDATE with `retracted_at !== null` is handled as a **removal, not a patch**: drop the id from the All lane, the Unread lane, and `stickyReadIdsRef`, then let the existing 250 ms coalesced scheduler refresh the authoritative count via the RPC. The count is never derived from payload arithmetic.
- `applyRealtimeInsert` refuses rows that already carry `retracted_at`.
- Retractions arriving while a read mutation owns rows are dropped by the existing gate and picked up by the release-time reconcile. No change to the mutation-exclusivity or release-before-reconcile invariants.
- Grouping recomputes naturally from the reduced row set, so aggregation stays correct with no changes to `notificationGrouping.ts`.

## Step 5 — Retention

Retracted rows accumulate under toggling. Add a `prune_retracted_notifications()` maintenance function deleting rows with `retracted_at < now() - interval '60 days'`, invoked from the existing daily refresh workflow. Retracted rows are never returned to a user or counted at any point in their life; the window exists purely for debugging and abuse analysis.

## Step 6 — Other undo cases

| Undo | Handling |
| --- | --- |
| Unlike post / recommendation | DELETE trigger retracts |
| Unfollow | DELETE trigger retracts; refollow inserts a fresh row |
| Re-like / re-follow, repeated | Unique index caps active rows at one, count moves by at most 1 |
| Delete own comment | DELETE trigger retracts via `metadata.comment_id` |
| Author deletes the post/recommendation | Retract dependent notifications so the drawer never links to a dead target |
| Mention removed while editing a post | Retract the mention notification for actors no longer mentioned |
| Comment likes / review likes | No notification trigger exists — out of scope, and this lifecycle is the pattern to follow when one is added |
| System / moderation / security | Never auto-retracted |
| Read state | Unchanged. Read is not retraction; mark-all ignores retracted rows |

## Step 7 — Tests

Extend `notificationRealtime.test.ts`: a retraction UPDATE removes the row from a lane rather than patching it, a retracted INSERT is refused, `retracted_at` validation accepts null/ISO and rejects garbage, and a burst of retractions coalesces to exactly one reconcile. All 138 existing tests must stay green.

## Step 8 — Docs

Append Phase 2.5 to `docs/NOTIFICATION_CENTER_ROADMAP.md` with the standing invariants: **like and follow notifications are projections of live state — at most one active row per (recipient, type, target, actor); undoing the source retracts, re-doing it inserts a new row; retracted rows are invisible to users and to the count; read state remains monotonic.**

## Manual verification

1. Rishab at 64. Hana likes → 65, row appears. Hana unlikes → **64**, row gone, no refresh.
2. Re-like → 65. Toggle five more times → still 65, one visible row, newest timestamp.
3. Read the like, Hana unlikes then re-likes → a fresh unread row appears; the old one does not resurrect.
4. Same cycle with the drawer closed → count correct on open.
5. Follow / unfollow / refollow → identical single-row behaviour.
6. Hana comments, then deletes the comment → notification disappears, preview text gone.
7. Realtime kill switch off → all of the above still correct within one poll cycle.
8. Two tabs open, toggle rapidly in one → the other converges to the same count, no duplicate rows.

## Out of scope

Hard deletes, DELETE realtime subscriptions, changes to grouping or pagination, deriving counts from payloads, push/email suppression windows (the `retracted_at` field is the hook a future delivery worker will check), per-type preferences (2.3b), the `/notifications` route.
