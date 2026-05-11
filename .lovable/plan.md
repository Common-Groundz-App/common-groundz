## Goal
Make the mobile `/create` composer show the body area, Suggested tags, Add details, and the bottom toolbar on first load without scrolling.

## What I found
The previous change was applied in the correct file (`EnhancedCreatePostForm.tsx`), but it only reduced secondary spacing. The bigger mobile height issue is structural:

- `CreatePost.tsx` adds page-level bottom padding for the app nav: `pb-[calc(4rem+env(safe-area-inset-bottom))]`
- The same page also still renders the fixed mobile `BottomNavigation`
- Inside that page, `EnhancedCreatePostForm.tsx` also uses `min-h-[100dvh]`
- The composer itself has its own sticky top bar and sticky bottom toolbar

That means mobile is effectively reserving space for both:
1. the app-level bottom nav, and
2. the composer’s own bottom toolbar

So the earlier textarea/padding tweak helped only a little, but the layout still remains taller than the visible viewport.

## Plan
1. **Remove the mobile app bottom nav from `/create`**
   - In `CreatePost.tsx`, stop rendering `BottomNavigation` on the create page.
   - Remove the matching mobile bottom padding that was only there to keep content above that nav.
   - Reason: the composer already has its own dedicated mobile controls; the global app nav is redundant here and steals first-screen height.

2. **Make the create page use a single viewport-owned mobile layout**
   - Keep the composer as the only mobile vertical shell on `/create`.
   - Ensure the outer create page wrapper does not add extra mobile height on top of the composer’s own `min-h-[100dvh]` behavior.

3. **Keep the earlier mobile tightening, but only as support**
   - Preserve the smaller mobile textarea min-height and tighter composer content padding.
   - These are still useful once the bigger page-level height conflict is removed.

4. **Verify the first mobile viewport outcome**
   - Re-check the `/create` mobile layout after the above changes.
   - Confirm the visible stack on first load includes:
     - entity pill
     - post type pill
     - title
     - body
     - Suggested tags / Add details area
     - composer bottom toolbar

## Files to change
- `src/pages/CreatePost.tsx`
- Possibly `src/components/feed/EnhancedCreatePostForm.tsx` only if a final small mobile spacing adjustment is still needed after the page-level fix

## Technical details
The issue does not appear to be “wrong file edited.” The previous edit hit the right composer file, but the dominant mobile height came from page composition:

```text
CreatePost page
  ├─ page wrapper with min-h + mobile bottom padding
  ├─ EnhancedCreatePostForm with its own min-h[100dvh]
  │   ├─ sticky top bar
  │   ├─ content area
  │   └─ sticky bottom toolbar
  └─ fixed BottomNavigation
```

This stacks two mobile bottom-control systems on the same route, which is why reducing inner padding alone didn’t solve the first-screen visibility problem.