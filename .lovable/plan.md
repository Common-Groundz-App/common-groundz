

# Phase 1: Threaded Comments with Likes — IMPLEMENTED

## What was built

### Database
1. `parent_id` column on `post_comments` and `recommendation_comments` (ON DELETE SET NULL, indexed)
2. `comment_likes` table with RLS (polymorphic: post/recommendation, email-verified INSERT)
3. Updated RPCs:
   - `add_comment` — accepts `p_parent_id`, enforces 1-level depth
   - `get_comments_with_profiles` — returns `parent_id`, `like_count`, `reply_count`, `is_liked`, `is_from_circle`
   - `toggle_comment_like` — atomic like/unlike with SECURITY DEFINER
   - `delete_comment` — soft-deletes replies when parent deleted, adjusts comment_count
   - `update_comment` — re-hardened with search_path

### Frontend
1. **`CommentItem.tsx`** — Extracted comment component with ❤️ heart reaction, Reply button, edit/delete dropdown
2. **`InlineCommentThread.tsx`** — Full rework:
   - Threaded grouping (top-level + replies)
   - Sorting: conversations first → newest → id DESC tie-break
   - Replies oldest-first within threads
   - Auto-expand 1-2 replies, collapsible 3+
   - Inline reply input with "Replying to @username"
   - Optimistic like UI (revert on failure)
   - Placeholder: "Share your experience, or ask someone who's tried this"
   - Empty state: "No comments yet. Share your experience or ask something!"
3. **`commentsService.ts`** — Extended `CommentData`, `toggleCommentLike`, `parentId` support

## Future Phases
- **Phase 2**: "From your circle" badge, sort toggle, visual conversation prominence
- **Phase 3**: @mentions with notifications, "Most helpful" comment highlight
