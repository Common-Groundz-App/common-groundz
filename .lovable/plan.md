# Edge-to-edge post detail on mobile

Yes — matching the feed on mobile is the right call. The detail page currently loses ~32px of horizontal space to padding that the feed doesn't have, which is why the same post looks narrower. Desktop stays as-is (the centered column with breathing room is correct there).

## Why it happens today

Two layers of padding stack on the detail page:

- `PostView.tsx` wraps content in `px-4` (both guest and logged-in layouts).
- `PostContentViewer.tsx` adds `p-4 sm:p-6` around the post.

The feed instead uses `px-0 sm:px-4` on its container and lets the post card go edge-to-edge, with the card's own `px-3 sm:px-4` supplying inner text padding.

## What changes

1. `PostView.tsx` (logged-in layout): container padding becomes `px-0 sm:px-4`; the main column gets `px-0 sm:px-4` so mobile is flush while desktop keeps its inset.
2. `PostView.tsx` (guest layout): same `px-0 sm:px-4` treatment.
3. `PostContentViewer.tsx`: outer wrapper becomes `p-0 sm:p-6` (no inset on mobile), and the elements that were relying on that padding get their own mobile padding so nothing touches the screen edge:
   - Back button row: `px-4 sm:px-0`
   - post-type badge row, structured fields, and the inline comments block: `px-4 sm:px-0`

The post card itself already renders borderless/edge-to-edge (`rounded-none border-x-0`), so media and the action bar will reach the screen edges exactly as on the feed.

## Result

- Mobile: post title, text, media, and action row align with the feed — full width, same left/right rhythm.
- Desktop: unchanged.
- Comments, structured fields, and the back button keep readable side padding on mobile.
