

## Plan: New post highlight animation (ship this)

Same plan as before, with one addition: `outline-offset: 2px`.

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `EnhancedCreatePostForm.tsx` | Add `is_optimistic: true` to the optimistic item |
| 2 | `PostFeedItem.tsx` | Detect flag + user ownership, apply highlight once via `useRef`, auto-remove after 1.8s |
| 3 | `index.css` | Add `highlight-fade` keyframes with `outline-offset: 2px` + reduced-motion override |

### Implementation

**`EnhancedCreatePostForm.tsx`** — add to optimistic item:
```ts
is_optimistic: true,
```

**`PostFeedItem.tsx`**:
```tsx
const hasAnimatedRef = useRef(false);
const [showHighlight, setShowHighlight] = useState(() => {
  if (post.is_optimistic && post.user_id === user?.id && !hasAnimatedRef.current) {
    hasAnimatedRef.current = true;
    return true;
  }
  return false;
});

useEffect(() => {
  if (showHighlight) {
    const timer = setTimeout(() => setShowHighlight(false), 1800);
    return () => clearTimeout(timer);
  }
}, [showHighlight]);

// Add to Card className:
showHighlight && "animate-highlight-fade"
```

**`index.css`**:
```css
@keyframes highlight-fade {
  0% { outline: 2px solid hsl(var(--brand-orange) / 0.25); outline-offset: 2px; }
  60% { outline: 2px solid hsl(var(--brand-orange) / 0.15); outline-offset: 2px; }
  100% { outline: 2px solid transparent; outline-offset: 2px; }
}
.animate-highlight-fade {
  animation: highlight-fade 1.8s ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .animate-highlight-fade {
    animation: none !important;
  }
}
```

### Why no further changes needed
- **State cleanup**: Server data from `invalidateQueries` lacks `is_optimistic`, so highlight never lingers
- **Border-radius**: Modern browsers render `outline` with `border-radius` correctly
- **Dark mode**: Orange at 0.25 opacity is actually more visible on dark backgrounds — no alpha adjustment needed

