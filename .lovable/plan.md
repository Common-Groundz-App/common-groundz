

# Phase 1: Reddit-Style Discussion Shift — Final Approved Plan

The plan from our previous iteration is solid. Both ChatGPT and Codex added minor but valid safeguards. Here's what to accept and what to skip.

## Additions accepted

**1. Entity always visible (ChatGPT)** — Yes. Entity tags already render via `renderTaggedEntities()` at line 444. Moving them above content (after author row, before post text) ensures they're never hidden by content truncation. This is a positioning change, not a size change — entity stays as a tag badge, not a headline.

**2. Empty state for "More experiences" (ChatGPT)** — Yes. When the detail page fetches related posts and gets zero results, show: "No more experiences yet. Be the first to share yours." with a CTA linking to the composer. Cheap to build, prevents dead UI.

**3. `?focus=comment` scroll + autofocus behavior (Codex)** — Yes. When navigating from the feed comment button, the detail page should scroll to the comment input and autofocus it. Must also work on direct link / refresh.

**4. Loading/error states for "More experiences" (Codex)** — Yes. Show skeleton while loading, graceful empty state, silently handle fetch errors. Standard pattern.

## Additions skipped

- **Analytics instrumentation** — Separate concern. Not part of this UI shift. Can be added as a follow-up without any rework.
- **Copy consistency audit** — Follow-up task, not blocking.

## No other additions needed

The plan is already correctly scoped. Adding more risks scope creep.

---

## Final implementation plan (4 steps)

### Step 1: PostFeedItem — Clickable preview cards
**File: `src/components/feed/PostFeedItem.tsx` (536 lines)**

- **Make content area clickable**: Wrap lines 399-445 (title, content, media, tags) in a `div` with `onClick={() => navigate(\`/post/\${post.id}\`)}`, `cursor-pointer`, `hover:bg-muted/30 transition-colors`, `role="link"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space
- **Isolate action buttons**: Wrap the action bar (lines 448-494) with `onClick={e => e.stopPropagation()}`; same for avatar/username (lines 349-373), dropdown menu (lines 376-396), edit/delete dialogs
- **Show title**: If `post.title` exists, render it as a bold `<h3>` above the content text (before line 400)
- **Move entity tags above content**: Move `renderTaggedEntities` call from line 444 to before the content area (around line 399), remove the wrapping `space-y-3 mt-4` div. Entity tags must always be visible, never hidden by truncation
- **Replace "Show more/less" with hard truncation**: Remove lines 401-424 (gradient overlay, expand/collapse button, `isExpanded` logic). Replace with `line-clamp-3` CSS on the content div
- **Remove CommentDialog**: Delete lines 498-507, remove `isCommentDialogOpen` state (line 72), remove `handleCommentClick` that opens dialog (line 306-308)
- **Comment button navigates**: Change comment button onClick to `navigate(\`/post/\${post.id}?focus=comment\`)`

### Step 2: Extract InlineCommentThread component
**New file: `src/components/comments/InlineCommentThread.tsx`**

- Extract from `CommentDialog.tsx` (614 lines): comment list rendering, comment input, CRUD operations (add/edit/delete), profile fetching, highlight logic
- Props: `itemId: string`, `itemType: 'recommendation' | 'post'`, `highlightCommentId?: string | null`, `autoFocusInput?: boolean`
- No Dialog/Sheet wrapper — just the content area
- When `autoFocusInput` is true, scroll to and focus the comment input on mount
- Keep `CommentDialog.tsx` intact for any other surfaces that still use it

### Step 3: PostContentViewer — Inline comments + entity cross-links
**File: `src/components/content/PostContentViewer.tsx` (215 lines)**

- Remove `CommentDialog` and `CommentsPreview` imports and usage (lines 6-8, 197-210)
- Remove `showComments` state and related effects
- Render `InlineCommentThread` directly below the post, always visible
- Read `focus=comment` from search params → pass `autoFocusInput={true}` to `InlineCommentThread`
- **"More experiences about [Entity]" section**: After comments, check `post.tagged_entities[0]`; if exists, fetch related posts via `fetchEntityPosts(entityId, userId, 0, 5)`, filter out current post
  - **Loading state**: Show skeleton placeholders while fetching
  - **Empty state**: "No more experiences yet. Be the first to share yours about [Entity Name]." with a link/button to composer
  - **Error state**: Silently fail, don't show the section
  - **Only first tagged entity** — no multiple sections

### Step 4: Composer microcopy updates
**File: `src/components/feed/ModernCreatePostForm.tsx` (701 lines)**

- Update `getPlaceholder()` function: change default placeholder to "Share your experience..."
- For `routine` type: "What's your routine? Share what works..."
- Make entity selector more visually prominent: add a subtle prompt text "What are you sharing about?" near the entity selector area, above or alongside the toolbar

---

## What stays unchanged
- "Post" naming everywhere
- Like/Save interaction model (no "Helpful" rename)
- No comment sorting or threading
- Title remains optional
- No analytics instrumentation in this phase
- No changes to other pages/components

## Implementation order
1. PostFeedItem (clickable cards) — largest change
2. InlineCommentThread (new component extraction)
3. PostContentViewer (inline comments + entity cross-links + empty states)
4. ModernCreatePostForm (microcopy only)

