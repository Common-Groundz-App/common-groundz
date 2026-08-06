# Restore the right column's vertical start position

## What I verified

Main column width/padding now matches the feed exactly:

- Feed (`src/pages/Feed.tsx:625`): `col-span-1 xl:col-span-4 max-w-2xl w-full mx-auto px-0 sm:px-4`
- Post detail (`src/pages/PostView.tsx:229`): identical classes

So the horizontal alignment work is complete and correct.

## What caused the right-column shift

In the last change the sidebar sticky offset was also changed from `top-20` to `top-4` in `src/components/content/PostDetailSidebar.tsx` (both the loading skeleton and the loaded return). That is what pulled the author/entity card up above where the post begins in `new_card.png`. The feed's own right rail uses `top-4`, but the feed's rail has no "Back" row above it, so matching that value visually raised the detail page's card.

## The change

In `src/components/content/PostDetailSidebar.tsx`, revert both wrappers back to `sticky top-20`:

- line 389 (loading skeleton)
- line 435 (loaded sidebar)

Nothing else changes — main column width, padding, and mobile edge-to-edge behavior stay as they are.
