

## Phase 4 Completion — Two Fixes + One Safeguard

### Changes

**1. `src/components/feed/EnhancedCreatePostForm.tsx` (line 306)**
Remove the narrow type cast:
```ts
// Before
post_type: (postType || 'story') as 'story' | 'routine' | 'project' | 'note',
// After
post_type: postType || 'story',
```

**2. `src/components/content/PostContentViewer.tsx`**
- Import `shouldShowTypeBadge` and `getPostTypeLabel` from `postUtils.ts`
- After rendering the `PostFeedItem`, add a small muted badge (matching the feed pattern) when `shouldShowTypeBadge(post.post_type)` is true
- Use `post.post_type ?? 'story'` as safe fallback

**3. `src/components/feed/PostFeedItem.tsx` (line 371)**
Add safe fallback: use `post.post_type ?? 'story'` when calling `shouldShowTypeBadge` and `getPostTypeLabel`

### Files

| File | Change |
|------|--------|
| `EnhancedCreatePostForm.tsx` | Remove narrow type cast (line 306) |
| `PostContentViewer.tsx` | Add type badge import + render |
| `PostFeedItem.tsx` | Add `?? 'story'` fallback |

No other changes. Three small, surgical edits.

