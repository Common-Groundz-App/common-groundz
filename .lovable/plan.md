

## Phase 1: Composer & Language Refinement — Implementation Plan

All feedback from ChatGPT and Codex has been incorporated. Here's the final plan.

### Scope
- **4 files modified**, no new files, no DB changes
- Adds title field, elevates entity tagging, updates copy, adds guidance text

---

### 1. `src/components/feed/EnhancedCreatePostForm.tsx`

**A. Add `title` state and input**
- New state: `const [title, setTitle] = useState('')`
- Render a borderless `<input>` between the username (line 399) and Textarea (line 400):
  - `placeholder="Add a title (optional)"`, `maxLength={120}`, `aria-label="Post title"`
  - Styled: `text-lg font-semibold border-none outline-none bg-transparent w-full placeholder:text-muted-foreground/50`
- Reset `setTitle('')` after successful submit (around line 331)
- Include `title: title.trim() || null` in `postData` at line 275

**B. Elevate entity section — compact-expandable, always visible**
- Move entity UI from hidden toggle (lines 488-498) to between title and textarea
- When no entities selected and not expanded: render a `<button>` with Tag icon + "What are you sharing about?" styled `cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 text-sm text-muted-foreground w-full text-left`
- On click: expand `SimpleEntitySelector` with `autoFocusSearch={true}`
- When entities selected: show existing entity badges (lines 441-462) moved here, plus "Add more" trigger
- Keep toolbar Tag button as secondary shortcut
- Preserve `@mention` trigger behavior unchanged

**C. Textarea placeholder (line 402)**
- `"What do you want to share today?"` → `"Share your experience..."`

**D. Helper text after textarea (after line 428)**
- Add: `<p className="text-xs text-muted-foreground/60 mt-1">What worked? · What didn't? · Who is this useful for?</p>`

**E. Success toast (lines 316-317)**
- `"Post created"` → `"Experience shared"`
- `"Your post has been published successfully"` → `"Your experience has been shared successfully"`

### 2. `src/pages/CreatePost.tsx`
- Line 91 mobile header: `"Create post"` → `"Share your experience"`
- Line 108 desktop header: `"Create post"` → `"Share your experience"`

### 3. `src/components/feed/CreatePostButton.tsx`
- Line 29: `"Create Post"` → `"Share Experience"`

### 4. `src/components/profile/ProfilePosts.tsx`
- Line ~130: `"Create Post"` → `"Share Experience"`

### What stays unchanged
- Submit button: **"Post"** / **"Posting..."**
- Entity remains **optional**
- Validation: content or media required
- Media upload, emoji, location, visibility — untouched
- `@mention` trigger behavior preserved
- No DB schema changes, no feed/detail page changes

