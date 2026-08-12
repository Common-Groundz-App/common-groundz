# Mobile edge-to-edge: feed vs post detail

## What the code actually says

The card geometry on the two pages is already identical — I compared them line by line:

| | Feed (`src/pages/Feed.tsx:618/625`) | Detail (`src/pages/PostView.tsx:224/229`) |
|---|---|---|
| Grid container | `grid … gap-4 px-0 sm:px-4 py-6` | same |
| Main column | `max-w-2xl w-full mx-auto px-0 sm:px-4` | same |
| Viewer wrapper | n/a | `pt-1 pb-4 px-0 sm:…` (no mobile side padding) |
| Card | `rounded-none border-x-0`, `CardContent px-3 sm:px-4` | same component, same classes |

So on mobile both pages give the post card the full viewport width with the same internal `px-3` (12px) gutter. There is no extra inset coded into the detail page.

## Why the screenshots still look different

Two candidates, and I have not confirmed which is in play:

1. **The media, not the card.** `PostMediaDisplay` sizes single media by orientation (`max-h-[600px]` for portrait, `max-h-[400px]` for landscape) with `objectFit="contain"`. In the feed shot the poster frame is landscape and fills the card; in the detail shot it is a tall/portrait frame, so height capping leaves visible side gutters — the video looks narrower even though the card is the same width.
2. **Capture conditions.** In your two images the app header logo also sits at a different distance from the screen edge, and the header markup is byte-identical on both pages. That can only happen if the shots were taken at different zoom/device/scale — so part of the perceived difference is likely not CSS at all.

## Recommendation

Keep the card padding as-is: it already matches the feed exactly, and dropping the `px-3` gutter would make text touch the screen edge, which reads worse than the feed, not better.

Proposed work, in order:

1. **Measure first.** Screenshot feed and detail for the same post at a single fixed 390px viewport and print the computed left/right offsets of the card, the avatar, and the media element. This settles cause 1 vs cause 2 with numbers instead of impressions.
2. **If the media is the cause (expected):** make single-item media in a post card fill the card's content width on mobile — set the media box to `w-full` with the orientation cap applied to height only, so a portrait video letterboxes vertically instead of shrinking horizontally. This change lives in `PostMediaDisplay` and would apply to both feed and detail identically, keeping the two surfaces in sync.
3. **If the numbers come back identical:** no code change — the difference was capture scale, and I'll show you the measured proof.

## Explicitly not changing

Card gutters (`px-3 sm:px-4`), page grid padding, desktop widths, the sidebar sticky offset, the header row, and comments layout.

## Verification

Same post, same 390px viewport, feed vs detail: card edges, avatar left edge, and media left/right edges must match to the pixel. Re-check desktop to confirm nothing shifted there.
