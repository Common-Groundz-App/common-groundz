# Phase 2.5 — Reversible notification lifecycle (retraction) — final

Both reviews approve this plan. Codex added three acceptance criteria and a database-verification request in the latest round; I checked all four against the code and all four are right, so they are folded in below. No further planning round after this.

### Latest round — folded in

| Correction | Verified | Outcome |
| --- | --- | --- |
| Competing lane revalidation calls | **True.** `useNotifications.ts:386` returns early when `revalidationOwnerRef.current` is held, so if All and Unread each invoke the pass from their own head commit, the second silently skips and stays stale until another poll | One owner runs **one coordinated pass covering both lanes**, not two lanes competing for ownership |
| Targeted conflict inference instead of bare `ON CONFLICT DO NOTHING` | **Correct, and better than my version.** Untargeted suppression would also swallow a PK collision or a future unique rule. Postgres *can* infer a partial unique index when the columns and the predicate are both supplied | `ON CONFLICT (cols) WHERE <predicate> DO NOTHING`, predicate byte-identical to the index. If the index changes, the trigger fails loudly instead of hiding an unrelated conflict |
| `type IN ('comment','like','mention')` names a nonexistent type | **True.** `NotificationType` is `like \| comment \| follow \| system \| journey_watched \| journey_digest`; mentions are `type='comment'` with `metadata.event='mention'` | Filter is `type IN ('comment','like')`; `metadata.event` distinguishes comment, reply, mention and comment-like |
| Prune ordering must be deterministic | **Correct.** Equal `retracted_at` values could stall progress | `ORDER BY retracted_at, id`, matching the cleanup index |
| Database-boundary verification | **Correct.** The 138 TS tests cannot prove trigger security, backfill mapping, index inference, or concurrent-insert idempotency | Added as Step 6b — Deno/SQL verification of the riskiest half of this phase |

## Verification of the feedback

| Point | Verified | Outcome |
| --- | --- | --- |
| Codex 1: polling cannot remove older retracted All-lane rows | **True and the most important catch.** `mergeNotifications` deliberately preserves rows only present in older loaded pages, and `useNotifications.ts:169` builds the All-lane head as `mergeNotifications(prev, page.rows)`. Absence from a head page is not authoritative, so a retracted page-2 row survives forever with realtime off | Folded in — All-lane active-membership revalidation |
| Codex 2: `type='like'` also covers comment likes | **True.** `notificationDestination.test.ts:94` asserts a supported row: `type: 'like'`, `entity_type: 'post'`, same `entity_id` as the post, `metadata.event: 'comment_like'` | Folded in — like index restricted to top-level likes |
| Codex 3: several notifications can share one `comment_id` | **True.** The destination tests cover mention, reply and comment-like rows all carrying `metadata.comment_id` | Folded in — retract all matching active rows |
| Codex 5 + migration race: required field, single migration | **True.** Two DB states deserve two client states; and splitting A/B/C leaves a window where old triggers still write duplicates after verification passes | Folded in — required field, one transactional migration |
| Codex 4 / ChatGPT 5: pruning needs an index and an idempotent schedule | **Partly new.** I had bounded batches but no supporting index and no unschedule guard | Folded in |
| ChatGPT 1: verification must `RAISE EXCEPTION` | **Correct.** A manual query is not a gate | Folded in |
| ChatGPT 2/3/4: conflict-target care, active-only comment retraction, regenerate types first | **Already the plan** | Restated explicitly so implementation cannot drift |

## Where I disagree

**Codex 3, partially.** Retracting *every* notification tied to a deleted comment is right for mention, reply and comment-like rows, but I am not retracting **moderation or system rows** that happen to reference a comment id. Those are durable by design — a moderation record that vanishes because the author deleted the evidence is worse than a stale preview. The trigger therefore retracts rows whose `type IN ('comment','like')` and leaves `system` rows alone.

**Codex 2's framing.** The comment-like shape is not merely hypothetical for the future — it is an asserted, supported shape *today*. Under my previous index, a comment like and a post like from the same actor on the same post collide, and `ON CONFLICT DO NOTHING` would have silently swallowed the second one. The broad index was not just future-risky, it was wrong now.

**One thing nobody raised.** All-lane active-membership revalidation must reuse the existing `revalidationOwnerRef` / `revalidationSeqRef` gating, not add a parallel mechanism. Two independent revalidators racing against the same mutation gates is exactly the class of bug Phase 2.1 was spent eliminating. It will be one generic membership pass parameterised by lane.

## Committed scope

Post likes, recommendation likes, follows, comment soft-delete retraction, realtime removal, All-lane and Unread-lane reconciliation, count reconciliation, bounded retention. Nothing else.

## Target behaviour

```text
hana likes    -> INSERT active row            -> 65
hana unlikes  -> UPDATE retracted_at = now()  -> 64, row disappears
hana re-likes -> INSERT a new active row      -> 65   (never 66)
repeat x10    -> still 65, one visible row
```

A fresh row rather than reviving the old one, because `mergeNotifications` and `mergeRealtimeRow` both enforce monotonic `is_read`, and the Unread lane keeps sticky-read rows visible until the drawer closes. Reviving means flipping a read row back to unread and moving its `created_at` — a carve-out in the one rule holding read state stable across two lanes, a poller and a socket. Retract + insert needs no exception.

## Step 1 — One transactional migration

Split migrations leave a window where the old triggers keep writing duplicates after verification passes but before the unique index exists, so index creation fails on a duplicate created *in between*. The dataset is small (99 like rows, 27 follow rows), so this is one migration, in order:

1. `ALTER TABLE public.notifications ADD COLUMN retracted_at timestamptz NULL`.
2. Backfill: retract like/follow rows whose source `post_likes` / `recommendation_likes` / `follows` row no longer exists.
3. Retract older duplicates per active identity, keeping the newest. The inflated count settles to truth here.
4. **Gate**: count remaining duplicate active identities and `RAISE EXCEPTION` with the count and the offending type if non-zero. The migration aborts with a readable reason instead of an opaque index-creation error.
5. Create the indexes.
6. Replace the triggers.

### Indexes

```sql
-- Top-level content likes only. Comment likes carry metadata.comment_id and
-- share the parent entity_id, so including them would make a post like and a
-- comment like from the same actor collide.
CREATE UNIQUE INDEX uniq_active_content_like_notifications
  ON public.notifications (user_id, sender_id, entity_type, entity_id)
  WHERE retracted_at IS NULL AND type = 'like'
    AND (metadata->>'comment_id') IS NULL
    AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL;

CREATE UNIQUE INDEX uniq_active_follow_notifications
  ON public.notifications (user_id, sender_id)
  WHERE retracted_at IS NULL AND type = 'follow' AND sender_id IS NOT NULL;
```

Follows get their own index because `entity_id` there is a *copy* of `sender_id` — redundant in the key, and if a future follow row ever pointed elsewhere a combined index would silently stop enforcing anything.

Plus three supporting indexes so tombstones never slow live reads or the nightly prune:
- `(user_id, created_at DESC, id DESC) WHERE retracted_at IS NULL` — All-lane keyset.
- `(user_id, created_at DESC, id DESC) WHERE retracted_at IS NULL AND is_read = false` — Unread keyset and the count RPC.
- `(retracted_at, id) WHERE retracted_at IS NOT NULL` — the prune batch selection, matching the prune function's `ORDER BY retracted_at, id`.

### Triggers

- The three insert triggers use **targeted** conflict inference: `ON CONFLICT (user_id, sender_id, entity_type, entity_id) WHERE <predicate> DO NOTHING` for likes and `ON CONFLICT (user_id, sender_id) WHERE <predicate> DO NOTHING` for follows, with each predicate byte-identical to its partial index. Postgres infers a partial unique index when both the columns and the predicate are supplied. Bare `ON CONFLICT DO NOTHING` would also swallow a primary-key collision, a malformed insert conflicting for an unrelated reason, or any unique rule added later — and if the index predicate ever changes, a targeted clause fails loudly instead of silently no-oping.
- New `AFTER DELETE` triggers on `post_likes`, `recommendation_likes`, `follows` — each `SECURITY DEFINER SET search_path TO 'public'`, matching the existing three exactly — setting `retracted_at = now(), updated_at = now()` on the matching row `WHERE retracted_at IS NULL`. `is_read` is never touched: retraction removes the row from view and from the count, so mutating read state adds nothing and would fight monotonicity.
- Comment retraction fires on the real transition, null-safe:
  `AFTER UPDATE ON post_comments / recommendation_comments WHEN (OLD.is_deleted IS DISTINCT FROM TRUE AND NEW.is_deleted = TRUE)`, retracting **all** active rows where `metadata->>'comment_id' = NEW.id::text AND type IN ('comment','like')` — which covers the comment notification, mention notifications (`type='comment'`, `metadata.event='mention'`), the reply notification and the comment-like notification. There is no `mention` value in `NotificationType`, so `metadata.event` — not `type` — is what distinguishes those events; naming a nonexistent type would misdocument the contract. `retracted_at IS NULL` in the predicate means repeated soft-delete updates do no redundant writes. Cascaded reply soft-deletes inside `delete_comment()` are UPDATEs too, so they are covered for free. System and moderation rows referencing the comment are deliberately left alone.
- `get_unread_notification_count` and `mark_all_notifications_as_read` gain `AND retracted_at IS NULL`. `mark_notifications_as_read` stays permissive — marking an already-retracted row read is harmless, and refusing it would add error handling to a path that no longer matters.

## Step 2 — Types, then client

Supabase types regenerate after the migration, before any frontend work. `Notification` gains **required** `retracted_at: string | null` — `select('*')` and realtime payloads always carry the column, and two DB states should not be modelled as three client states.

## Step 3 — Read path and All-lane reconciliation

- `fetchNotifications` and `fetchUnreadMembership` add `.is('retracted_at', null)`.
- New `fetchActiveMembership(ids, userId)` — same all-or-nothing chunked contract as `fetchUnreadMembership` (a partial result is indistinguishable from "these were retracted" and would delete live rows), returning which ids are still active.
- `revalidateUnreadHistory` generalises into **one coordinated pass that reconciles both lanes in a single operation** under the existing `revalidationSeqRef` / `revalidationOwnerRef` gates. It must not be two lanes each calling the pass from their own head commit: `useNotifications.ts:386` returns early when ownership is held, so the second caller would silently skip and stay stale until another poll. One acquisition, one batched membership query set (active ids for the All lane, unread ids for the Unread lane), one commit. The All lane revalidates loaded rows older than its head window and drops any that came back retracted. This is what makes manual check 8 (kill switch off) actually pass.

## Step 4 — Realtime retraction

- `validateRealtimePayload` validates `retracted_at` as ISO string or null; malformed drops the payload to a reconcile, as today.
- A validated UPDATE with `retracted_at !== null` is a **removal, not a patch**: drop the id from the All lane, the Unread lane and `stickyReadIdsRef`, then let the existing 250 ms coalesced scheduler refresh the count via the RPC. The count is never derived from payload arithmetic.
- `applyRealtimeInsert` refuses rows already carrying `retracted_at`.
- **Retraction dominates local read projections**: retracted ids go into a short-lived `retractedIdsRef` so an in-flight read mutation resolving afterwards cannot re-add the row. Without this, a mark-read round trip that started before the retraction restores it on release.
- Retractions arriving while a read mutation holds rows are dropped by the existing gate and recovered by the release-time membership pass. Mutation-exclusivity and release-before-reconcile invariants are unchanged. `notificationGrouping.ts` needs no changes — grouping recomputes from the reduced set.

## Step 5 — Bounded retention

`prune_retracted_notifications(p_limit int default 5000)` deletes a bounded, deterministically ordered batch (`ORDER BY retracted_at` so runs make forward progress) where `retracted_at < now() - interval '60 days'`, returning the delete count for monitoring. Never one unbounded DELETE — that means heavy WAL and long locks as the table grows. `EXECUTE` granted to `service_role` only. Scheduled idempotently: `cron.unschedule` guarded by existence, then `cron.schedule` under a fixed job name, so re-running the migration cannot stack duplicate jobs. Retracted rows are never returned to a user or counted at any point in their life; the window exists purely for debugging and abuse analysis.

## Step 6 — Tests

Extend `notificationRealtime.test.ts`: a retraction UPDATE removes rather than patches; a retracted INSERT is refused; `retracted_at` validation accepts null/ISO and rejects garbage; a late-resolving read mutation cannot restore a retracted id; a burst of retractions coalesces to exactly one reconcile. New coverage for All-lane active-membership dropping a retracted older row and for the all-or-nothing chunk contract. All 138 existing tests stay green.

## Step 7 — Docs

Append Phase 2.5 to `docs/NOTIFICATION_CENTER_ROADMAP.md` with the standing invariant: **like and follow notifications are projections of live state — at most one active row per (recipient, type, target, actor) for top-level likes and per (recipient, actor) for follows; undoing the source retracts, redoing it inserts a new row; retracted rows are invisible to users and to the count; read state remains monotonic.** Record the deferred items (target deletion, mention-edit diffing, outbox/projector evolution path) as named follow-ups.

## Manual verification

1. Rishab at 64. Hana likes → 65, row appears. Hana unlikes → **64**, row gone, no refresh.
2. Re-like → 65. Toggle five more times → still 65, one visible row, newest timestamp.
3. Read the like, Hana unlikes then re-likes → a fresh unread row appears; the old one does not resurrect.
4. Same cycle with the drawer closed → count correct on open.
5. Follow / unfollow / refollow → identical single-row behaviour.
6. Hana comments, Hana deletes it → notification disappears, preview text gone.
7. Delete a comment with replies and a mention → parent, reply and mention notifications all retracted.
8. **Kill switch off**, retract a row that sits on page 2 of a loaded list → it disappears within one poll cycle. This is the check the previous plan would have failed.
9. Two tabs, rapid toggling in one → the other converges, no duplicate rows.

## Out of scope

Hard deletes, DELETE realtime subscriptions, post/recommendation deletion cleanup, mention-edit diffing, changes to grouping or pagination, deriving counts from payloads, push/email suppression (`retracted_at` is the hook a future delivery worker checks), per-type preferences (2.3b), the `/notifications` route, and the outbox/projector rearchitecture — correct at much higher scale, unnecessary complexity now.
