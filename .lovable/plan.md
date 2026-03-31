

# Final Plan Approval + Input Validation Decision

## On the "@username only" question

You should **allow** "@username" only replies. Here is why:

- Tagging someone in a reply is a valid social action — it pulls them into the conversation
- Adding a minimum character rule that blocks `@hana.li` would frustrate users who are doing something intentional
- This is how Instagram, Twitter, and every social platform works — tagging is a first-class interaction
- When you build @mentions in Phase 3, this becomes even more important

## Input validation rule (what we actually add)

Keep it simple:
- **Trim whitespace** before submit (already done in `addComment` via `.trim()`)
- **Disable submit** when trimmed content is empty (already done via `!newComment.trim()` check)
- **No minimum character count** — a reply of "yes" or "@someone" is valid
- The existing empty-string check is sufficient

This means: no code change needed for this suggestion. The current validation is already correct.

## Final verdict

The plan from the previous conversation is **complete and ready to implement**. No further changes needed.

### What gets built (Phase 1 recap):

**Database:**
1. `parent_id` column on `post_comments` and `recommendation_comments` (ON DELETE SET NULL)
2. `comment_likes` table with RLS
3. Updated RPCs: `add_comment` (with `p_parent_id`), `get_comments_with_profiles` (with `like_count`, `reply_count`, `is_liked`, `is_from_circle`), new `toggle_comment_like`, updated `delete_comment`

**Frontend:**
1. New `CommentItem.tsx` — extracted comment component with heart like + reply button
2. Reworked `InlineCommentThread.tsx` — threaded grouping, collapsible replies (auto-expand 1-2, collapse 3+), inline reply input with "Replying to @username", optimistic likes
3. Updated `commentsService.ts` — extended interface, `toggleCommentLike`, `parentId` support

**UX details:**
- Sorting: conversations first, then newest, tie-break by id DESC
- Replies: oldest-first inside threads
- Placeholder: "Share your experience, or ask someone who's tried this"
- Deleted parent with replies: "[Comment deleted]" placeholder
- Reply container: `bg-muted/20 rounded-lg` with `border-l-2 border-muted`

Shall I proceed with implementation?

