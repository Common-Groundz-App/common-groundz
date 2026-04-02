

# Comment System Premium Upgrade — Final Plan

All reviewers have approved. One last addition accepted: safe timestamp fallback for synthetic deleted-parent groups in sorting.

## 10 Changes in `InlineCommentThread.tsx`

### 1. Fix `getReplyToUsername` (line 426-428)
Parse `@username` from start of reply content using `/^@([a-z0-9._]+)\s/i`. If extracted username matches `parentComment.username`, return `undefined` (implied context). Otherwise return the extracted username.

### 2. Auto-prepend `@username` on reply-to-reply (line 258-271)
In `handleReplySubmit`, when `replyingTo` has a `parent_id` and a valid `username`, check if `replyContent.trimStart().toLowerCase()` already starts with `@{username.toLowerCase()}`. If not, prepend `@{username} `. Guards against missing username.

### 3. Orphaned reply detection (line 78-126)
After building `topLevel` and `replyMap`, collect `parent_id` keys from `replyMap` that don't exist in the `topLevel` set. For each orphaned group, create a synthetic `GroupedComment` with a safe placeholder parent (all required `CommentData` fields with safe defaults including `created_at` set to the earliest reply's `created_at`) and `isDeletedWithReplies: true`. This ensures correct sort ordering for both relevance and newest modes.

### 4. Sort toggle — Relevance / Newest (line 464-470)
- Add `sortMode` state initialized from `localStorage` key `cg-comment-sort` with `try/catch` fallback to `'relevance'`
- Replace static "Sorted by relevance" label with a clickable toggle button with `aria-label="Change comment sort order"`
- When `newest`, sort `groupedComments` by `created_at DESC` (skip 5-tier scoring)
- Persist choice to `localStorage` on change

### 5. Smooth expand/collapse animation (line 554)
Add to `CollapsibleContent`: `className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 duration-200"`

### 6. Contextual empty state (line 487-490)
- Post: "No comments yet. Share your thoughts or ask the author a question."
- Recommendation: "No comments yet. Share your experience or ask someone who's tried this."

### 7. Dynamic reply placeholder (line 591)
Change `"Write a reply..."` to `` `Reply to ${replyingTo.displayName || replyingTo.username}...` ``

### 8. Thread toggle label (line 547-551)
Collapsed: `💬 {n} replies · View discussion` with `font-medium`. Expanded: `Hide replies`. Add `aria-label`.

### 9. Active thread styling (line 516)
Threads with 3+ replies: `bg-muted/30 border-l-2 border-primary/20`. Otherwise keep `bg-muted/20`.

### 10. Dynamic main input placeholder (line 671)
- Post: `"Ask the author something or share your thoughts"`
- Recommendation: keep current `"Share your experience, or ask someone who's tried this"`

## Files Modified

Only `InlineCommentThread.tsx`. No backend or schema changes.

