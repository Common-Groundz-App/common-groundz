## Problem

The composer scroll container at `src/components/feed/EnhancedCreatePostForm.tsx` (line 1009) uses:

```
py-5 md:pt-10
```

`py-5` sets both top and bottom padding to 20px. `md:pt-10` only overrides the **top** on desktop, leaving the bottom at 20px. Result: the inline footer (media icons, Public, Cancel, Post) sits flush against the viewport bottom — the user can't scroll past it for any breathing room.

## Change

**File:** `src/components/feed/EnhancedCreatePostForm.tsx` (line 1009)

Update the scrollable surface's padding so the bottom has generous runway on every breakpoint:

```
py-5 md:pt-10 pb-16 md:pb-24
```

- `pb-16` (64px) on mobile — comfortable space above the OS edge / mobile bottom nav.
- `md:pb-24` (96px) on desktop — matches the visual breathing room used by Twitter/Notion composers, so the footer doesn't kiss the viewport edge.

That's the only change.

## Out of scope

- No changes to the footer divider, structured fields, suggested tags, post type pill, title, body, or any field styling.
- No layout/structural changes — only the bottom padding on the scroll surface.
