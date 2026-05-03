## Problem

When the user types `@is` in the composer, the draft autosave stores `"@is"` in localStorage. After selecting an entity, the `@is` text is correctly removed from the live content state. However, if the user navigates away without posting, the draft still contains the old `@is` text because:

- The autosave only writes when `title.trim() || content.trim()` is truthy (line 203)
- After cleanup, if both title and content are empty, the old draft is never overwritten
- When the user returns, the stale draft with `@is` is restored

## Fix

**File: `src/components/feed/EnhancedCreatePostForm.tsx`**

Update the debounced autosave effect (~line 200-209) to also handle the case where content becomes empty after previously having content. When both `title` and `content` are empty, **clear the draft** instead of silently skipping the save:

```typescript
useEffect(() => {
  if (isEditMode) return;
  const handle = setTimeout(() => {
    if (title.trim() || content.trim()) {
      setDraft({ title, content, savedAt: Date.now() });
    } else {
      // Content was cleared (e.g. after entity selection cleanup) — remove stale draft
      clearDraft();
    }
  }, 500);
  return () => clearTimeout(handle);
}, [title, content, isEditMode]);
```

This ensures that when the `@query` text is cleaned up and the composer is effectively empty, the stale draft is cleared from localStorage. No other files or logic need to change.
