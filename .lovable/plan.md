

# Reduce Follow Button Size in Sidebar

## Problem
The `EntityFollowButton` ignores the `size="sm"` prop passed from the sidebar — it hardcodes `size={isMobile ? "sm" : "default"}` and uses fixed `16px` icons. The button appears too large in the sidebar context.

## Changes

### `src/components/entity/EntityFollowButton.tsx`
- Use the `size` prop instead of hardcoding: `size={isMobile ? "sm" : size}` 
- When `size="sm"`, reduce icon size from `16` to `14` and reduce `mr-1` to `mr-0.5`
- Add `text-xs` class when `size="sm"` for smaller button text

### `src/components/content/PostDetailSidebar.tsx`
- No changes needed — already passes `size="sm"`

## Result
The follow button in the sidebar will render noticeably smaller with compact text and icons, while the full-size button on entity pages remains unchanged.

