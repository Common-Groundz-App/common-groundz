

## Move Post Composer from Modal to `/create` Route — Updated Plan

### Summary
Replace the post modal with a dedicated `/create` page. All 6 locations that trigger the post composer will navigate to `/create` instead. The `open-create-post-dialog` event is fully removed for posts. Reviews, journals, watching, and recommendations stay as modals.

### Feedback incorporated

| ChatGPT suggestion | Action |
|---|---|
| Remove `open-create-post-dialog` entirely for posts | Yes — no "temporary" keep, clean removal |
| Safe query param handling (missing/partial params) | Yes — defensive parsing, blank form on missing params |
| Defensive back navigation | Yes — `history.length > 1 ? navigate(-1) : navigate('/home')` |
| Remove modal styling leftovers | Yes — form renders without Dialog wrapper, no max-height/overflow hacks |
| Keep form UI identical | Yes — zero layout or field changes to `EnhancedCreatePostForm` |
| Hidden SmartComposerButton cleanup | Remove from PostView — only needed for post event, which is gone. SmartComposerButton still lives in Feed layout for review/journal/watching modals + recommendation event |

---

### Files to create

**`src/pages/CreatePost.tsx`** — New full-page composer

- Desktop: centered card (max-w-xl) within standard app shell, matching feed width
- Mobile: full-screen with top bar (X close left, "Create post" title center)
- Reads entity from URL search params: `entityId`, `entityName`, `entityType`
- Defensive parsing: if any param missing, just skip prefill (blank form)
- Renders `EnhancedCreatePostForm` directly (no Dialog wrapper)
- On success: dispatches refresh events, then `navigate(-1)` with `/home` fallback
- On cancel/X: same back navigation
- Uses `useEmailVerification` gate like current flow

---

### Files to modify

**`src/App.tsx`**
- Add `/create` route wrapped in `AppProtectedRoute`

**`src/components/navigation/BottomNavigation.tsx`**
- Replace `CustomEvent('open-create-post-dialog')` dispatch with `navigate('/create')`

**`src/components/profile/ProfilePosts.tsx`**
- Replace event dispatch with `navigate('/create')`

**`src/components/profile/ProfilePostsEmpty.tsx`**
- Replace event dispatch with `navigate('/create')`

**`src/components/content/PostContentViewer.tsx`** (line 369-380)
- Replace event dispatch with `navigate('/create?entityId=...&entityName=...&entityType=...')`
- Entity params built from `post.tagged_entities[0]`

**`src/components/feed/SmartComposerButton.tsx`**
- Remove the `open-create-post-dialog` listener's post path — when `contentType === 'post'`, navigate to `/create` instead of opening dialog
- Remove the `selectedContentType === 'post'` branch from the Dialog content (lines 245-251)
- Popover "Post" button: navigate to `/create` instead of `handleContentTypeSelect('post')`
- Keep review, journal, watching in the Dialog as-is
- Keep recommendation form as-is

**`src/pages/PostView.tsx`** (lines 181-186)
- Remove the hidden `<SmartComposerButton />` — no longer needed since PostContentViewer navigates directly

**`src/components/feed/EnhancedCreatePostForm.tsx`**
- Make `onCancel` optional (`onCancel?: () => void`) since the `/create` page handles navigation
- No other changes — form internals stay identical

**`src/components/feed/CreatePostButton.tsx`**
- Replace `open-create-post-dialog` listener with `navigate('/create')`
- Replace button click handler with `navigate('/create')`
- Remove the Dialog entirely — it's redundant now

---

### What stays unchanged
- `EnhancedCreatePostForm` internal logic (submit, entity tagging, media, emoji, location)
- Review, journal, watching modals inside SmartComposerButton
- Recommendation form
- DB schema, `post_entities` persistence
- All refresh event dispatching inside the form

