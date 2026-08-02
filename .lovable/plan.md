# Phase 2.5A — Comment lifecycle sync (final)

## Verdict

Both reviews are right, and codex's four corrections are all factually correct — I verified each against the database before folding them in. Two of them would have caused real bugs:

1. **`comment_likes` is not RPC-only.** Verified: the table has `INSERT` ("Verified users can like comments") and `DELETE` ("Users can unlike their own") policies for `public`. So "the RPC is the single writer" is a convention, not an invariant — my previous note was wrong. Fixed below.
2. **Preview text lives in different fields per shape.** Verified: `create_post_comment_notification` writes `message` = the event sentence ("linda commented on your post") and `metadata.comment_text` = a 50-char preview. `add_comment`'s mention/reply rows write `title` = the event sentence and `message` = a 200-char preview. Blindly rewriting `message` for plain comments would replace the event copy with raw comment text. Fixed below.
3. **A shared parser means `add_comment` must be replaced too** — otherwise the "single authority" claim is false and the two flows drift. Correct; the migration now replaces three functions, and the helper's `EXECUTE` is revoked from `PUBLIC`.
4. **Orphan backfill + active uniqueness must stay.** Correct — fixing the unlike branch only helps future unlikes; rows already orphaned by past unlikes stay live forever.

One thing I'd add that neither review raised: **`add_comment` also writes the stale `/recommendation/` singular URL** (line 96 of the reference SQL and in the live function). Since that function is being replaced anyway, fix it in the same pass so the two comment producers agree.

Scope stays closed after this: no realtime expansion, no DELETE subscription, no grouping changes, no review/journey types, no target-deletion cleanup, no preferences in this migration.

## Plan

### 1. Repair existing comment-like state (data, runs once)
- **Retract orphans:** set `retracted_at = now()` on active `type='comment'`, `metadata.event='like'` notifications whose `(comment_id, sender_id)` no longer has a matching `comment_likes` row.
- **Deduplicate:** keep the oldest active row per `(user_id, sender_id, entity_type, entity_id, metadata->>'comment_id')` for `event='like'`, retract the rest, ordered deterministically (`retracted_at, id`) as in 2.5.
- **Assert:** raise if any duplicate active group survives, so the migration fails loudly rather than half-applying.
- **Constrain:** partial unique index on those five columns `WHERE retracted_at IS NULL AND type='comment' AND metadata->>'event'='like'`, matching the 2.5 index style so `ON CONFLICT` inference works.

### 2. `toggle_comment_like`
- **Unlike branch:** before returning, retract the matching **active** row (same recipient, sender, `entity_type`/`entity_id`, `metadata.comment_id`, `event='like'`) with `retracted_at = now(), updated_at = now()`. Never touch `is_read`.
- **Like branch:** add `AND n.retracted_at IS NULL` to the `NOT EXISTS`, so a re-like inserts a **fresh unread row** rather than being permanently suppressed.
- Fix `action_url` from `/recommendation/<id>` to `/recommendations/<id>`.
- Keep the canonical `type='comment'` + `metadata.event='like'` shape so grouping and destination resolution are untouched.

### 3. Enforce the writer invariant
Revoke direct `INSERT`/`DELETE` on `comment_likes` from `anon`/`authenticated` (drop the two mutation policies) and leave `SELECT` in place for counts and liked-state. The `SECURITY DEFINER` RPC keeps working; direct client writes — which would silently skip notification creation and retraction — stop being possible.

### 4. Shared mention parser
New `SECURITY DEFINER` helper returning resolved `(user_id, username)` rows for a body, with `REVOKE EXECUTE ... FROM PUBLIC`. It reproduces today's behaviour byte-for-byte: same regex `(?:^|[^a-z0-9.@])@([a-z0-9._]+)` with `gi`, same lower/trim normalization, same dedup on the normalized handle, same 5-mention cap, same self-mention skip, same `deleted_at IS NULL` profile filter. `add_comment` is replaced to call it, so there is exactly one parsing authority.

### 5. `update_comment` — mention and preview reconciliation
In the same transaction, after the content update:
- **Removed mentions:** delete the `comment_mentions` row and retract the active mention notification.
- **Added mentions:** insert `comment_mentions`, and insert a mention notification only when no active one exists (guard filtered on `retracted_at IS NULL`).
- **Kept mentions:** leave `is_read` and `created_at` alone; refresh only the preview.
- **Preview refresh, per row shape:**
  - mention / reply rows → update `message` to `LEFT(new_content, 200)`, leave `title` alone.
  - plain comment rows → update `metadata.comment_text` to the 50-char-plus-ellipsis form, and **never** touch `message` (that's the event sentence).
  - comment-like rows → no body preview at all; leave untouched.
- An edit is not a new event: no read-state reset, no `created_at` change, no new notification for unchanged recipients.
- Fix the same stale `/recommendation/` URL in `add_comment` while it's being replaced.

### 6. Documentation
- Correct the stale **Phase 2.3** entry (it still describes "representative title + and N others", no name resolution, and an event-count chip; shipped behaviour is verified display names, event-aware singleton copy, no chip, shared React Query profile keys with `ProfileAvatar`).
- Add **Phase 2.5A** lifecycle rules, including the per-shape preview-field table.
- Record **expand → deploy → activate** as the rollout rule for *future* notification schema changes; Phase 2.5 shipped stable and is deliberately not replayed.
- Mark **server-enforced preferences** as next.

## Technical notes

- One transactional migration: backfill → dedup → assert → index → `CREATE OR REPLACE` of `add_comment`, `update_comment`, `toggle_comment_like` → new parser helper with revoked `PUBLIC` execute → policy revocation on `comment_likes`. All three RPCs are already `SECURITY DEFINER` with a pinned `search_path`.
- Retraction stays an `UPDATE`; the existing realtime channel and coalesced count reconcile deliver everything with **zero client changes**. Counts are never derived from payloads.
- No new triggers on `comment_likes` — step 3 makes the RPC genuinely the only writer, which is the cheaper of the two enforcement options and matches the existing design.
- After applying: probe the toggle and edit paths against real rows, then run the unit suite (143 tests) — the pure layers shouldn't move.

## Manual test pass

Comment like → unread row appears. Unlike → row disappears within ~250ms and the badge drops. Re-like → a **new** unread row, not a resurrected read one. Toggle repeatedly → no count drift. Self-like → nothing. Edit a comment removing `@user` → that mention row disappears. Edit adding `@user` → a new mention row. Text-only edit → same rows, read state and ordering preserved, mention/reply previews updated, and the plain "commented on your post" sentence unchanged with a refreshed snippet.
