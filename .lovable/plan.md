# Phase 2.5A — Comment lifecycle sync (final)

## Verdict

Yes — both corrections are right and I've folded them in. One of them (dedup direction) was a genuine error in my plan; the other two review points were already satisfied, and I verified the third myself rather than asking you to.

**Accepted as a fix:** dedup keeps the **newest** active row (`created_at DESC, id DESC`), not the oldest. Keeping the oldest could preserve an already-read row with a stale timestamp and URL over the newer real event, and it contradicts Phase 2.5. Codex's added detail is also right: `retracted_at` cannot order active candidates because they're all NULL there.

**Already in the plan (now stated explicitly):** the partial unique index identity always included `(metadata->>'comment_id')` — without it, "Hana liked comment A" and "Hana liked comment B" on the same post would collide. Spelled out in step 1 so it can't be lost in implementation.

**Verified rather than asked:** I searched the project for direct `comment_likes` writes before agreeing to revoke. There are none — every mutation lives inside `toggle_comment_like`; `commentsService.ts` calls only the RPC and `get_comments_with_profiles` only reads. Revocation is safe.

**Also folded in from codex:** orphan cleanup validates the *full* canonical identity (recipient = comment author, `entity_id` = parent, `entity_type` matches) rather than just `(comment_id, sender_id)`, and enforcement covers **both** privileges and policies since those are independent controls in Postgres.

Carried over from the previous round: preview fields differ per notification shape (plain comments use `metadata.comment_text`, mention/reply rows use `message`), `add_comment` is replaced too so there's a single mention-parsing authority, and `add_comment`'s stale `/recommendation/` singular URL gets fixed in the same pass.

Scope stays closed after this: no realtime expansion, no DELETE subscription, no grouping changes, no review/journey types, no target-deletion cleanup, no preferences in this migration. Preferences is the next phase.

**Final round — both clarifications accepted, no redesign:**
- Every replaced function **explicitly re-declares** `SECURITY DEFINER` and `SET search_path = public` instead of assuming `CREATE OR REPLACE` carries them. Codex is right that this is a real hazard once direct DML is revoked: an accidental `SECURITY INVOKER` would break liking entirely.
- Mention reconciliation is driven by **actual membership changes** (`DELETE ... RETURNING`, `INSERT ... ON CONFLICT DO NOTHING RETURNING`) rather than a diff computed before the write — concurrency-safe and idempotent on retry.
- Verification includes **database probes** (privileges, function security attributes, dedup result, unlike/re-like, mention add/remove/re-add, repeated edits), not just the TypeScript suite.


## Plan

### 1. Repair existing comment-like state (data, runs once)
- **Retract orphans:** set `retracted_at = now()` on active `type='comment'`, `metadata.event='like'` notifications that don't map to a real like. The check validates the **full canonical identity**, not just `(comment_id, sender_id)`: join `comment_likes` to the owning `post_comments` / `recommendation_comments` row and confirm the notification's `user_id` is the comment author, `entity_id` is the parent post/recommendation, and `entity_type` matches. Malformed historical rows get retracted instead of being locked in by the new index.
- **Deduplicate:** keep the **newest** active row per `(user_id, sender_id, entity_type, entity_id, metadata->>'comment_id')`, ordered `created_at DESC, id DESC`, and retract the rest. (Correction accepted — my earlier "oldest" was wrong and inconsistent with 2.5; `retracted_at` can't order active rows since they're all NULL.)
- **Assert:** raise if any duplicate active group survives, so the migration fails loudly rather than half-applying.
- **Constrain:** partial unique index on `(user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id'))` `WHERE retracted_at IS NULL AND type='comment' AND metadata->>'event'='like'`. The `comment_id` expression is required so two likes on different comments of the same post don't collide; the targeted `ON CONFLICT` inference uses this exact column list and predicate.

### 2. `toggle_comment_like`
- **Unlike branch:** before returning, retract the matching **active** row (same recipient, sender, `entity_type`/`entity_id`, `metadata.comment_id`, `event='like'`) with `retracted_at = now(), updated_at = now()`. Never touch `is_read`.
- **Like branch:** add `AND n.retracted_at IS NULL` to the `NOT EXISTS`, so a re-like inserts a **fresh unread row** rather than being permanently suppressed.
- Fix `action_url` from `/recommendation/<id>` to `/recommendations/<id>`.
- Keep the canonical `type='comment'` + `metadata.event='like'` shape so grouping and destination resolution are untouched.
- Each replacement definition **explicitly re-declares** `SECURITY DEFINER` and `SET search_path = public` rather than relying on `CREATE OR REPLACE` to carry them over, plus the existing `auth.uid()` ownership check, like-count side effects and boolean return contract. This matters most here: with direct DML revoked, a `toggle_comment_like` that silently became `SECURITY INVOKER` would make liking impossible.

### 3. Enforce the writer invariant
Verified before committing to this: **no direct writes exist.** Searched the whole project for `.from('comment_likes')` insert/update/delete/upsert — the only mutations of `comment_likes` anywhere are inside `toggle_comment_like` itself (`src/services/commentsService.ts` calls only the RPC; `get_comments_with_profiles` reads only). So revoking is safe and won't break the like UI.

Because privileges and RLS are separate controls, do both:
- Drop the `INSERT`/`DELETE` policies ("Verified users can like comments", "Users can unlike their own").
- `REVOKE INSERT, UPDATE, DELETE ON public.comment_likes FROM anon, authenticated`.
- Keep `SELECT` for counts and liked-state, and keep `EXECUTE ON toggle_comment_like TO authenticated`.


### 4. Shared mention parser
New `SECURITY DEFINER` helper returning resolved `(user_id, username)` rows for a body, with `REVOKE EXECUTE ... FROM PUBLIC`. It reproduces today's behaviour byte-for-byte: same regex `(?:^|[^a-z0-9.@])@([a-z0-9._]+)` with `gi`, same lower/trim normalization, same dedup on the normalized handle, same 5-mention cap, same self-mention skip, same `deleted_at IS NULL` profile filter. `add_comment` is replaced to call it, so there is exactly one parsing authority.

### 5. `update_comment` — mention and preview reconciliation
In the same transaction, after the content update:
- **Membership changes drive notifications, not a pre-computed diff.** Removals use `DELETE ... RETURNING mentioned_user_id` and retract only for returned rows; additions use `INSERT ... ON CONFLICT DO NOTHING RETURNING mentioned_user_id` and notify only for returned rows. Two overlapping edits can't both conclude the same mention is new, and retries are idempotent.
- **Removed mentions:** the deleted `comment_mentions` rows retract their active mention notification.
- **Added mentions:** genuinely inserted rows get a mention notification, guarded on `retracted_at IS NULL` so a re-add after removal yields a fresh row.
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

- One transactional migration, applied in this order: orphan backfill → dedup (newest wins) → assert no duplicates → partial unique index → replace `toggle_comment_like` → revoke direct table mutations → add the internal mention parser (`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`) → replace `add_comment` and `update_comment`. All three RPCs are already `SECURITY DEFINER` with a pinned `search_path`, and `CREATE OR REPLACE` keeps their existing grants, auth checks, mention cap, reply behaviour and comment-count side effects intact.
- The index predicate and the `ON CONFLICT` predicate/column list must match **exactly**, including the `(metadata->>'comment_id')` expression.
- Retraction stays an `UPDATE`; the existing realtime channel and coalesced count reconcile deliver everything with **zero client changes**. Counts are never derived from payloads.
- No new triggers on `comment_likes` — step 3 makes the RPC genuinely the only writer, which is the cheaper of the two enforcement options and matches the existing design.
- After applying: probe the toggle and edit paths against real rows, then run the unit suite (143 tests) — the pure layers shouldn't move.

## Manual test pass

Comment like → unread row appears. Unlike → row disappears within ~250ms and the badge drops. Re-like → a **new** unread row, not a resurrected read one. Toggle repeatedly → no count drift. Self-like → nothing. Edit a comment removing `@user` → that mention row disappears. Edit adding `@user` → a new mention row. Text-only edit → same rows, read state and ordering preserved, mention/reply previews updated, and the plain "commented on your post" sentence unchanged with a refreshed snippet.
