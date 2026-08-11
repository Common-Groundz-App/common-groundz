# Remove the remaining headroom on post detail (mobile-first)

## What's actually stacking today

Measured from the code, above the author avatar row on mobile:

- `PostView.tsx` grid container: `py-6` → 24px
- `PostContentViewer.tsx` detail wrapper: `pt-1` → 4px
- Header row (back icon + `Post`): 40px button height, `mb-1` → 4px
- `PostFeedItem` `CardContent`: `pt-2` → 8px

So ~40px of pure padding sits above a 40px header. Desktop is the same minus the app-header offset, which is why both screenshots show the gap.

## Changes

1. `src/pages/PostView.tsx`
   - Logged-in grid (line 224): `py-6` → `pt-2 pb-6 sm:py-6`
   - Guest container (line 163): `py-6` → `pt-2 pb-6 sm:py-6`
   Mobile top padding drops 24px → 8px; tablet/desktop unchanged.

2. `src/components/content/PostContentViewer.tsx` (detail view only)
   - Wrapper: `pt-1 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6` → `pt-0 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6`
   - Header row: `mb-1` → `mb-0`
   - Back button: keep the 40px tap target (`h-10 w-10`) — it stays accessible; the `-ml-2` optical alignment is unchanged.
   Non-detail (modal/embedded) spacing untouched.

3. `src/components/feed/PostFeedItem.tsx`
   - `CardContent`: `pt-2` → `pt-2` in the feed, `pt-0` when `isDetailView` (the header row already provides separation). Applied via `cn`, so feed rendering is byte-identical.

Net: ~28px reclaimed on mobile, ~24px on desktop, with the header row and post card now visually adjacent like X/Twitter.

## Sidebar

Reducing the main column's top offset by 24px on desktop means the post now starts near ~52px, so `PostDetailSidebar` at `sticky top-20` (80px) would sit lower than the post. Change both wrappers (skeleton line 389, loaded line 435) to `sticky top-14`, then screenshot-verify the author card's top edge against the post start and adjust only if it drifts.

## Not changing

Post fetch logic, comments, routing, feed layout/width, mobile edge-to-edge behavior, modal viewer spacing.

## Verification

- Mobile ~390px: gap between the app header and `Post` is tight; avatar row sits directly under the header row; tap target still ~40px.
- Desktop: reduced headroom, author card top edge aligned with post start (loading and loaded states).
- Feed page pixel-identical.
