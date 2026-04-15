

## Final Plan: Reliable post-creation feed refresh with optimistic insertion

### Summary
Fix the intermittent "post not appearing after creation" bug by adding optimistic cache insertion + React Query invalidation, replacing unreliable custom events.

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `EnhancedCreatePostForm.tsx` | After entity relationships are saved (~line 392), add optimistic cache update + invalidation. Import `useQueryClient`. Wrap in try/catch fail-safe. |
| 2 | `CreatePost.tsx` | Remove 3 redundant event dispatches from `handleSuccess`. Change `navigateBack()` → `navigate('/home')`. |

### Implementation detail

**File 1 — `EnhancedCreatePostForm.tsx`** (after line 392, before toast):

```ts
// Import useQueryClient at top
import { useQueryClient } from '@tanstack/react-query';

// In component body
const queryClient = useQueryClient();

// After entity relationships saved, before toast:
try {
  queryClient.setQueryData(['infinite-feed', 'for_you', user.id], (oldData: any) => {
    if (!oldData?.pages?.[0]?.items) return oldData;
    const firstPage = oldData.pages[0];
    if (firstPage.items.some((item: any) => item.id === newPost.id)) return oldData;
    
    const optimisticItem = {
      ...newPost,
      is_post: true,
      username: profileData?.username || null,
      displayName: getDisplayName(profileData) || null,
      avatar_url: profileData?.avatar_url || null,
      likes: 0,
      is_liked: false,
      is_saved: false,
      comment_count: 0,
      tagged_entities: entities,
      created_at: newPost.created_at || new Date().toISOString(),
    };
    
    return {
      ...oldData,
      pages: [
        { ...firstPage, items: [optimisticItem, ...firstPage.items] },
        ...oldData.pages.slice(1),
      ],
    };
  });
} catch (e) {
  console.warn('Optimistic update failed, relying on invalidation', e);
}

queryClient.invalidateQueries({ queryKey: ['infinite-feed'], exact: false });
```

Keep existing custom events as fallback for already-mounted components (entity refresh, profile posts).

**File 2 — `CreatePost.tsx`**:

```ts
const handleSuccess = useCallback(() => {
  navigate('/home');
}, [navigate]);
```

### Safeguards

| Guard | How |
|-------|-----|
| Cache shape | `if (!oldData?.pages?.[0]?.items) return oldData` |
| Dedup | `items.some(i => i.id === newPost.id)` check |
| Fail-safe | try/catch around setQueryData |
| Broad invalidation | `exact: false` covers all feed variants |
| `created_at` fallback | Uses `newPost.created_at` with client-side fallback |
| Scroll to top | Handled by existing `ScrollToTop` on PUSH navigation |

### What stays untouched
- Feed hooks, API layer, realtime subscriptions — unchanged
- Entity-specific refresh events stay in the form (for entity pages)
- No new dependencies

