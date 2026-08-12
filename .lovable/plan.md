# Post detail: the side bars come from the grid, not the media

## The real cause (visible in your DevTools shots)

In `inspect_1.png` the selected grid container measures **425 × 1151 with padding `24px 0px`** — so the page container itself is full width with zero horizontal padding. The inset starts one level in, at the main column. That matches the class strings:

`src/pages/PostView.tsx:224`
```
w-full mx-auto grid justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

Below `xl` there is **no** column definition, so the grid has a single implicit column. `justify-center` sets `justify-content: center` on the grid, and an implicit track is `auto`-sized — it is sized to its content and then centered, instead of stretching to the container. The main column's `w-full` resolves to 100% *of that shrunk track*, not of the viewport. Result: symmetric empty bars on both sides, exactly what the green/dashed overlays show.

This explains every observation you reported:

- It happens for portrait video, landscape video, images, and posts with no media at all — because the track width follows whatever the widest child happens to be, not the media.
- The mobile header is unaffected, because it is outside this grid.
- The feed uses the same grid classes but *looks* edge-to-edge, because its column also contains the full-width "For You / Following" tab bar and page heading, which push the auto track out to (or near) the container width. The detail page has no such wide child, so its track collapses.

So Codex is right that this is not a media issue and not a shared `FeedCollage` problem — and it is also not merely capture conditions. The card genuinely is narrower than the column on the detail page.

## The fix

`src/pages/PostView.tsx`, logged-in layout grid container (line 224): define the single-column track explicitly so it fills the width.

```
w-full mx-auto grid grid-cols-1 justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

`grid-cols-1` makes the below-`xl` track `minmax(0, 1fr)`, so it stretches to the container. The main column's existing `max-w-2xl w-full mx-auto` then centers the card within that full-width track exactly as the feed does, and the card's own `px-3` gutter is untouched.

Desktop is unchanged: `xl:grid-cols-7` still wins at `xl`, and `justify-center` keeps doing its job for the 7-column layout.

## Feed parity

`src/pages/Feed.tsx:618` has the same latent bug — it is masked only because its column happens to hold wide children. Add the same `grid-cols-1` there so the two surfaces are structurally identical and the feed can't regress if its tab bar ever changes. No visual change expected on the feed.

## Not changing

`FeedCollage` / `PostMediaDisplay` sizing (portrait media stays as designed — the `287px` / `408px` / `518px` caps are intentional and any change there is a separate app-wide decision), the card's `px-3 sm:px-4` gutter, the guest layout, desktop widths, the sidebar sticky offset, and the header row.

## Verification

At 425px (your DevTools width) and 390px, on the detail page:

1. The main column div and the post card both report the same width as the grid container (425px), with `left: 0`.
2. Compare the same post on `/home` — avatar left edge and card edges match to the pixel.
3. Confirm a post with no media and a post with a landscape image both go full width.
4. Re-check `xl` desktop: three-column layout and card width unchanged.
