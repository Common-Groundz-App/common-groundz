

# Assessment: Phase 1 Implementation Status + Migration Fixes

## Implementation Status

The frontend code (CommentItem, InlineCommentThread, commentsService) is **fully implemented** and matches the plan:
- Threading with grouping, collapsible replies, auto-expand 1-2 replies
- Heart likes with optimistic UI
- Conversation-first sorting with tie-breaking
- Inline reply input with "Replying to @username"
- "[Comment deleted]" placeholder support
- Correct placeholder text

## ChatGPT's 3 Migration Fixes — My Assessment

### 1. "SQL injection in `get_comments_with_profiles`" — **Not actually a vulnerability, but worth improving**

ChatGPT is wrong that `%L` is an injection risk — `format('%L', value)` in PostgreSQL properly quotes and escapes literals. It's safe. However, using `$1` with `USING` is cleaner practice. This is a **code quality improvement**, not a security fix. Worth doing.

### 2. "Missing `auth.uid()` check in `toggle_comment_like`" — **Yes, add this**

Since the function is `SECURITY DEFINER` (bypasses RLS), validating `auth.uid() = p_user_id` prevents spoofing. Same pattern should be applied to `add_comment` and `delete_comment` for consistency (though `delete_comment` already validates ownership via the query).

### 3. "Remove `edited_at = now()` from `update_comment`" — **Yes, fix this**

The comment tables don't have an `edited_at` column. The RPC derives it from `updated_at > created_at + interval '1 second'`. Setting a non-existent column will cause the UPDATE to fail silently or error. Remove `edited_at = now()` and keep only `updated_at = now()`.

### Optional: "Prevent liking own comment" — **Skip for now**

Self-likes are harmless at this stage. Can revisit later.

## Plan: Apply 2 Migration Fixes

Run a new migration with:

1. **Fix `update_comment`**: Remove `edited_at = now()`, keep only `updated_at = now()`
2. **Add auth check to `toggle_comment_like`**: Add `IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN RAISE EXCEPTION` at the top
3. **Improve `get_comments_with_profiles`**: Use parameterized `$1` with `USING` for `p_item_id` instead of `%L` (code quality, not security)

All three are `CREATE OR REPLACE FUNCTION` statements — no schema changes, no frontend changes needed.

## What's Ready

After these fixes, Phase 1 is complete:
- Database schema (parent_id, comment_likes) ✅
- RPC functions (add_comment, get_comments_with_profiles, toggle_comment_like, delete_comment) ✅ (pending fixes)
- Frontend (CommentItem, InlineCommentThread, commentsService) ✅

