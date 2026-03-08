

# Final Plan — Fix Post Share URL Corruption

## Summary

Codex's concern about `toast` outside React doesn't apply here — the project's `toast` function uses a global dispatch pattern and works outside components. So we proceed with the plan as-is.

## Changes

### 1. New file: `src/utils/sharePost.ts`

Shared utility with:
- `navigator.share({ title, url })` — no `text` field
- On failure (non-abort), fall back to clipboard
- Clipboard copies **URL only** (Codex's recommendation)
- Feature-detect `navigator.clipboard` + `isSecureContext`, legacy `textarea` fallback
- Toast feedback on all paths
- Uses the standalone `toast` function from `@/hooks/use-toast`

### 2. Update `src/components/profile/ProfilePostItem.tsx`

Replace the `handleShare` function (~15 lines) with:
```ts
import { sharePost } from '@/utils/sharePost';
// ...
const handleShare = () => sharePost(post.id, post.title);
```

Remove the now-unused `toast` import if no other usage remains in the component (it's still used for delete/edit, so it stays).

### 3. Update `src/components/feed/PostFeedItem.tsx`

Same replacement as above.

### 4. Update `src/hooks/use-entity-share.ts`

Remove `text` from the `shareData` object (line 16) to prevent the same URL corruption bug for entity sharing.

## Files touched
- 1 new: `src/utils/sharePost.ts`
- 3 modified: `ProfilePostItem.tsx`, `PostFeedItem.tsx`, `use-entity-share.ts`

