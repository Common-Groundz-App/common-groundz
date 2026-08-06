# Edge-to-edge post detail on mobile (revised)

All three of codex's points are correct and are now folded in. Confirmed against the code:

- `PostView.tsx` logged-in layout has `px-4` only on the grid container (`grid ... gap-4 px-4 py-6`); the main column has no horizontal padding. Adding `sm:px-4` to both would have doubled the desktop inset.
- `PostContentViewer.tsx` wraps everything in `p-4 sm:p-6`, so zeroing it on mobile would also drop vertical rhythm.
- Below `PostFeedItem` the viewer renders four detail-only blocks: post-type badge, structured fields, inline comments, and the "Real experiences with …" related section — the last one was missing from the first draft.

## What changes

1. `PostView.tsx` — logged-in layout: grid container padding becomes `px-0 sm:px-4`. The main column is left untouched, so tablet/desktop width is byte-for-byte the same as today.
2. `PostView.tsx` — guest layout: container becomes `py-6 px-0 sm:px-4` (was `py-6 px-4`).
3. `PostContentViewer.tsx` — outer wrapper: `p-4 sm:p-6` becomes `py-4 px-0 sm:p-6`. Horizontal inset only is removed on mobile; vertical spacing is unchanged at every breakpoint.
4. `PostContentViewer.tsx` — detail-only content keeps readable side padding on mobile:
   - The Back button gets `px-4 sm:px-0` on its row (it sits above `PostFeedItem`).
   - The badge, structured fields, inline comments, and the related-experiences section are wrapped in a single container with `px-4 sm:px-0` rather than sprinkling padding on each block.

`PostFeedItem` itself is not touched — it stays borderless/full-bleed with its own `CardContent px-3 sm:px-4`, which is exactly the feed's internal rhythm.

## Responsive contract

- Mobile: `PostFeedItem` has the same width and internal padding as in the feed. Media uses the same inset the feed uses (from the card's `px-3`) — not literal viewport-edge.
- Mobile detail controls: Back, badge, structured fields, comments, and related content keep `px-4` side padding.
- Tablet (`sm`) and desktop: no width change at all — the `sm:` values reproduce today's padding.

## Verification

Compare feed vs detail for the same post at ~390px width and again just above the `sm` breakpoint (640-768px), checking that the card edges align in both and that desktop inset is unchanged.
