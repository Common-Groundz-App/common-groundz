

## Fixes for Post Detail Page — 3 Items

### 1. Replace 3 chat icons in comments empty state with single icon
**File:** `src/components/comments/InlineCommentThread.tsx` (lines 597-606)

Replace the three overlapping `MessageCircle` circles with a single, larger `MessageCircle` icon in a muted circle. This removes the "mistake" feeling while keeping a clean visual anchor above "Start the conversation."

```
Before: 3 overlapping circles with MessageCircle icons
After:  1 centered circle (h-12 w-12) with a single MessageCircle (h-6 w-6)
```

### 2. Replace 3 empty bubbles in experiences empty state with blurred avatar placeholders
**File:** `src/components/content/PostContentViewer.tsx` (lines 336-340)

Replace the plain `bg-muted` circles with blurred placeholder avatars that imply "people will be here." Use the same overlapping layout but add a `blur-[2px]` filter and slightly varied muted background tones to suggest real avatars rather than empty dots.

### 3. Fix "Share your experience" button — orange outline + open modal
**File:** `src/components/content/PostContentViewer.tsx` (lines 348-355)

**Styling:** Keep `variant="outline"` but add explicit orange border and text classes: `border-brand-orange text-brand-orange hover:bg-brand-orange/10`. This makes it visually distinct as a branded secondary action without competing with primary actions.

**Behavior:** Replace `onClick={() => navigate('/')}` with `onClick={() => window.dispatchEvent(new CustomEvent('open-create-post-dialog'))})`. This opens the create post modal over the current page — no redirect. After submission, the modal closes and feeds refresh via the existing event system. User stays on the post detail page throughout.

### Files changed
- `src/components/comments/InlineCommentThread.tsx` — single icon replacing 3
- `src/components/content/PostContentViewer.tsx` — blurred placeholders + button fix

