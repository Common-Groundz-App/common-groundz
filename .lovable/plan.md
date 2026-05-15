## Goal

Match Twitter/X behavior for **single media** rendering: the container hugs the media's true aspect ratio (within capped bounds), so there is no grey letterbox, the media is left-aligned, the card feels appropriately big, and video controls sit in clean opposite corners.

## Why our current build looks worse than Twitter

We use a fixed outer aspect box (e.g. `aspect-[4/5]` for portrait, `aspect-[9/16]` for portrait video) and place the media inside with `object-contain`. That fixed box is wider than the media, so the empty horizontal space shows up as grey side gaps. Twitter instead **shapes the container to the media's own ratio** (within sane caps), so the box hugs the media and there is no letterbox to render.

## Single-item rules (count === 1)

Compute `ratio = item.width / item.height`. Fallback when dimensions are missing: portrait→`3/4`, landscape→`16/9`, square→`1`.

Clamp ratio per type:

| Media | Ratio clamp | Hard max-height (safety cap) |
|---|---|---|
| Portrait image | `clamp(ratio, 3/4, 4/5)` | `min(620px, 80vh)` |
| Portrait video | `clamp(ratio, 9/16, 3/4)` (allowed taller than photos) | `min(700px, 80vh)` |
| Landscape image | use intrinsic ratio, clamped to `[5/4, 16/9]` (never narrower than ~5:4, never wider than 16:9) | `min(560px, 80vh)` |
| Landscape video | same as landscape image | `min(560px, 80vh)` |
| Square | `1/1` | `min(620px, 80vh)` |

Apply via inline `style={{ aspectRatio: String(clampedRatio), maxHeight: '...' }}` (dynamic values, not Tailwind aspect classes).

Use `object-cover` on the tile. Because the container already matches the media's ratio, `cover` produces no visible crop — and any tiny clamp-induced edge crop is far better than grey bars.

**Max-height caps are mandatory**, not optional — they prevent ultra-tall media from dominating the feed.

## Left-align, not center

Remove `mx-auto` from the single-item container wrapper. The block fills the post column up to its natural max-width, left-aligned, matching Twitter.

## Video controls — opposite corners

Twitter places the duration badge bottom-left. We will match that and move the mute button to bottom-right so the two never overlap:

- Duration badge → `absolute bottom-2 left-2`
- Mute button → `absolute bottom-2 right-2` (currently bottom-left — moves to bottom-right)

This applies to all video renders (single and multi). Keep the badge visible whenever `item.duration` is set.

Also remove the redundant inner styling on the `<video>` element in `FeedVideo`:
```
isPortrait && 'aspect-[9/16] max-h-[560px] mx-auto'
```
That fragment was a second source of letterboxing and was hiding the badge in some cases. The outer container now drives sizing.

## Square / portrait fix is the same fix

Same aspect-ratio-driven container approach, just with `ratio = 1` for square. Container becomes square at full column width, no grey gaps. Solves the square-image complaint.

## What stays unchanged

- Multi-item collages (2/3/4+) — no layout changes. They will however inherit the **video controls swap** (duration bottom-left, mute bottom-right) for consistency.
- Lightbox — still uses `object-contain`, still shows true uncropped aspect.
- Composer preview — untouched.
- `LightboxPreview`, `FeedVideo` autoplay/mute/analytics — untouched aside from corner repositioning and removing the redundant portrait class.

## Files

- `src/components/media/FeedCollage.tsx` — rewrite single-item branch: compute clamped aspect ratio + hard max-height per type, apply via inline style, use `object-cover`, drop `mx-auto`.
- `src/components/media/FeedVideo.tsx` — (1) move mute button to `bottom-2 right-2`, (2) keep duration badge at `bottom-2 left-2`, (3) remove the `isPortrait && 'aspect-[9/16] max-h-[560px] mx-auto'` class fragment on the `<video>`.

## Verification checklist (visual A/B against Twitter screenshots)

- Landscape image: ~16:9, no regression.
- Portrait image: container is portrait-shaped (3:4 to 4:5), no grey side bars, left-aligned, capped at ~620px / 80vh.
- Landscape video: ~16:9, **duration badge bottom-left**, **mute bottom-right**.
- Portrait video: portrait-shaped container (up to 9:16), no grey bars, left-aligned, capped at ~700px / 80vh, **duration badge bottom-left**, **mute bottom-right**.
- Square image: square container at full column width, no grey bars.
- Multi-item posts: collage layouts unchanged; videos inside them now show duration bottom-left, mute bottom-right.
- Lightbox: still shows full uncropped media.

## On "should the cards be bigger overall?"

Most of the perceived size gap comes from the letterboxing, not the column width. Fixing the aspect-ratio container will close ~90% of it. If after this change the user still wants a wider feed column, that is a separate, larger layout change to evaluate then.
