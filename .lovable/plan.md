# Portrait media on post detail: the grid track is shrinking, not the media

## What the screenshots actually show

Your correction is a useful clue, but portrait media is the *symptom*, not the cause. Measuring the four mobile shots at the same device width:

| Screenshot | Content | Left edge of the card content |
|---|---|---|
| IMG_2883 (detail, 4-up collage) | full-width collage | ~24px |
| IMG_2884 (detail, portrait image) | capped-width media | ~45px |
| IMG_2886 (detail, portrait image) | capped-width media | ~105px |
| IMG_2881 (detail, portrait video) | capped-width media | ~103px |

The inset is not fixed — it changes with the post's contents, and the avatar, name, title, action row and the "Post" header all shift right by the same amount, not just the media. A media-width bug cannot move the avatar and the header. Something is sizing the whole column to its content and centering it.

That is exactly what the grid does.

`src/pages/PostView.tsx:224` (logged-in layout):
```
w-full mx-auto grid justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

Below `xl` there is **no** column definition, so the grid has a single *implicit* track. Implicit tracks are `auto`-sized, and `justify-center` (`justify-content: center`) then centers that track in the container instead of stretching it. So the track width = the column's max-content width, and the main column's `max-w-2xl w-full` resolves to 100% *of that shrunk track*. Your DevTools shot confirms the container itself is fine: `425 × 1151, padding 24px 0px` — the inset begins one level in.

Why portrait posts look worst: `FeedCollage.computeShape()` caps single portrait media at `287px` (video) / `403px` (image) via `width: min(100%, maxWidth)`. That narrow child lowers the column's max-content width, so the track shrinks and the whole card visibly floats. A 4-up collage renders `w-full aspect-[16/9]`, so max-content stays large and the card looks correctly edge-to-edge. Same mechanism, different content.

Why the feed doesn't show it: `Feed.tsx:618` has the identical grid classes, but its column also contains the full-width tab bar and page heading, which push the auto track out to the container width. Portrait media there is left-aligned inside a full-width card — which is precisely the "left aligned on feed, centered on detail" difference you noticed. It's the same media rule; only the track width differs.

## Fix

`src/pages/PostView.tsx`, logged-in layout grid container: add an explicit single-column track.

```
w-full mx-auto grid grid-cols-1 justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

`grid-cols-1` makes the below-`xl` track `minmax(0, 1fr)` so it fills the container. The card then spans the full mobile width for every post type, its `px-3` gutter is untouched, and portrait media sits left-aligned inside the card exactly as it does in the feed. At `xl`, `xl:grid-cols-7` still wins and desktop is unchanged.

Apply the same one-class addition to the guest layout container in `PostView.tsx` if it uses the same auto-track pattern (verified during implementation), and to `Feed.tsx:618` for parity so the feed can't regress if its tab bar ever changes — no visual change expected there.

## Not changing

`FeedCollage` / `PostMediaDisplay` sizing. The `287px` / `403px` / `518px` caps stay as designed, so portrait media remains intentionally narrower than the card — the same as the feed. If you later want portrait media to fill the card width, that is a separate app-wide media policy decision affecting both surfaces.

Also untouched: the card's `px-3 sm:px-4` gutter, desktop widths, the sidebar sticky offset, and the compact "Post" header.

## Verification

At 425px and 390px on the detail page:

1. Card left edge is identical for a portrait video, a portrait image, a landscape image, a 4-up collage, and a text-only post — and identical to the same post in the feed.
2. Portrait media is left-aligned inside the card (not centered), matching the feed.
3. `xl` desktop three-column layout and card width unchanged.
