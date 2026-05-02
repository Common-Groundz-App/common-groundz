## Problem

When the Tag Entities modal is open with the search input focused (showing recent searches), clicking the modal's X close button requires two clicks:
1. First click: the `handleClickOutside` handler in `UnifiedEntitySelector` intercepts the mousedown event (since the X button is outside `containerRef`), closing the recent searches dropdown but not the modal.
2. Second click: now actually closes the modal.

## Fix

**`src/components/feed/UnifiedEntitySelector.tsx`** — In the click-outside `useEffect` (lines 193-203), skip registering the handler entirely when `variant === 'modal'`. The modal variant doesn't need click-outside logic because the Dialog overlay already handles dismissal.

Change the effect to early-return when `isModal` is true:

```typescript
useEffect(() => {
  if (isModal) return; // Modal variant — Dialog overlay handles dismissal
  function handleClickOutside(event: MouseEvent) {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setShowResults(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isModal]);
```

This is a single-line addition. No other files need changes.
