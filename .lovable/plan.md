
# Phase 1: Reddit-Style Discussion Shift — IMPLEMENTED

## What was done

### Step 1: PostFeedItem — Clickable preview cards ✅
- Content area (title, text, media, tags) wrapped in clickable div → navigates to `/post/:id`
- Action bar (like, save, share, comment) isolated with `stopPropagation`
- Entity tags moved above content (always visible, never hidden by truncation)
- Post title rendered as bold `<h3>` when present
- "Show more/less" replaced with CSS `line-clamp-3` hard truncation
- CommentDialog removed — comment button navigates to `/post/:id?focus=comment`
- Keyboard accessible (`role="link"`, `tabIndex`, Enter/Space)

### Step 2: InlineCommentThread — New component ✅
- Extracted from CommentDialog into standalone `src/components/comments/InlineCommentThread.tsx`
- Full CRUD: add, edit, delete comments inline
- `autoFocusInput` prop: scrolls to and focuses comment input
- `highlightCommentId` prop: scrolls to and highlights specific comment
- Skeleton loading states, empty state
- Enter to submit (Shift+Enter for newline)

### Step 3: PostContentViewer — Inline comments + entity cross-links ✅
- CommentDialog and CommentsPreview removed
- InlineCommentThread rendered directly below the post (always visible)
- `?focus=comment` URL param triggers autofocus on comment input
- "More experiences about [Entity]" section after comments:
  - Fetches related posts for first tagged entity
  - Skeleton loading state
  - Empty state with CTA: "Be the first to share yours about [Entity]"
  - Clickable related post cards

### Step 4: Composer microcopy ✅
- Default placeholder: "Share your experience..."
- Routine placeholder: "What's your routine? Share what works..."
- Entity selector button shows "What's this about?" hint
- Popover includes "What are you sharing about?" prompt
