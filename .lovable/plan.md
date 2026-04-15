

## Plan: Ship the post highlight glow (final — no more iterations)

The only addition: wrap `window.matchMedia` in a `typeof window !== 'undefined'` guard. Everything else is unchanged from the approved plan.

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/index.css` | Replace `highlight-fade` keyframes with soft box-shadow glow, cubic-bezier easing, 2s |
| 2 | `src/components/feed/PostFeedItem.tsx` | Replace `useEffect` timeout with `onAnimationEnd`, add SSR-safe reduced-motion check |

### CSS (`src/index.css`)

Replace existing `highlight-fade` block:

```css
@keyframes highlight-fade {
  0% {
    box-shadow: 0 0 8px 2px hsl(var(--brand-orange) / 0.25),
                0 0 16px 4px hsl(var(--brand-orange) / 0.12);
  }
  60% {
    box-shadow: 0 0 6px 1px hsl(var(--brand-orange) / 0.18),
                0 0 12px 3px hsl(var(--brand-orange) / 0.08);
  }
  100% {
    box-shadow: 0 0 0 0 transparent,
                0 0 0 0 transparent;
  }
}
.animate-highlight-fade {
  animation: highlight-fade 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

Reduced-motion CSS override stays as-is.

### PostFeedItem.tsx

**Remove** the existing `useEffect` timeout block. Update the state initializer with SSR-safe guard:

```tsx
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hasAnimatedRef = useRef(false);
const [showHighlight, setShowHighlight] = useState(() => {
  if ((post as any).is_optimistic && post.user_id === user?.id && !hasAnimatedRef.current) {
    hasAnimatedRef.current = true;
    if (prefersReducedMotion) return false;
    return true;
  }
  return false;
});
```

**Add** to Card element:

```tsx
onAnimationEnd={(e) => {
  if (e.target === e.currentTarget && e.animationName === 'highlight-fade') {
    setShowHighlight(false);
  }
}}
```

### Summary of all safeguards
- `useRef` — triggers once per mount
- `user?.id` check — only highlights own posts
- `e.target === e.currentTarget` — no bubbling from nested animations
- `typeof window` + `matchMedia` — SSR-safe reduced-motion skip
- CSS `prefers-reduced-motion` — backup override
- `onAnimationEnd` — no JS/CSS duration drift

