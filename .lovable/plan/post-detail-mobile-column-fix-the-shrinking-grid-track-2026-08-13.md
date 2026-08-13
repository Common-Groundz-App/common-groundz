# Post detail mobile column: fix the shrinking grid track

## What is happening

On the post detail page, the whole post column (header, avatar, name, title, action row, and media) shifts inward together when the post contains narrow portrait media. The issue is not in the media itself — it is one level higher in the grid.

`src/pages/PostView.tsx:224`:
```
w-full mx-auto grid justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

Below `xl` there is no explicit column definition. CSS Grid creates an implicit `auto` track, and `justify-center` (`justify-content: center`) centers that track instead of stretching it. The track width becomes the column's max-content width, and the main column's `max-w-2xl w-full` resolves to 100% *of that shrunk track*. Portrait media is intentionally capped by `FeedCollage` at `287px` (video) / `403px` (image), so the max-content shrinks and the whole card visibly floats. A full-width collage or wide landscape image keeps the track wide, which is why the bug is inconsistent.

The feed has the same grid classes but is hidden because the feed column contains the page heading and "For You / Following" tabs that force the track wide. The detail page lacks those wide children, so the same latent bug becomes visible.

## Approved changes

1. `src/pages/PostView.tsx`, logged-in layout grid container (line 224): add `grid-cols-1` so the mobile track is always full width.

```
w-full mx-auto grid grid-cols-1 justify-center xl:grid-cols-7 gap-4 px-0 sm:px-4 py-6
```

2. `src/pages/Feed.tsx:618`, main grid container: add the same `grid-cols-1` for structural parity. No visual change is expected today because the feed's tabs/heading already keep the track wide.

3. Guest layout: leave it unchanged. The guest container is not a grid and does not use `justify-center`:

```
container max-w-3xl mx-auto py-6 px-0 sm:px-4
```

It does not share the implicit-track pattern, so no change is needed.

## What will not change

- `FeedCollage` / `PostMediaDisplay` sizing and the portrait media caps (`287px` / `403px` / `518px`).
- The card's internal `px-3 sm:px-4` gutter.
- Desktop `xl:grid-cols-7` three-column layout.
- Sidebar sticky offset.
- Compact "Post" header.
- Comments layout.

## Expected result

On mobile:

- The post card, header, avatar, name, title, and actions use the full column width for every post type.
- Portrait media remains intentionally narrower but is left-aligned inside the card, matching the feed.
- Landscape media, collages, and text-only posts are visually unchanged but now use a stable full-width track.
- The feed and detail page left edges match when the same post is viewed on both surfaces.

On desktop:

- No visible change; the `xl:grid-cols-7` rule still takes over.

## Verification

At 425px and 390px:

1. Open a portrait video, a portrait image, a landscape image, a 4-up collage, and a text-only post on the detail page.
2. Confirm the card's left edge is the same in all five cases.
3. Compare the same post on `/home` and confirm the card edges align pixel-for-pixel.
4. Confirm a desktop width (`xl` breakpoint and above) still shows the three-column layout and the same card width as before.
5. (Optional) Run a Playwright measurement pass to log the bounding box of the main column for each post type and assert they are all equal.
