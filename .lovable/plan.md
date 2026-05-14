# Composer media preview fix

## Root causes (verified)

1. **The grid CSS classes don't exist.** `TwitterStyleMediaPreview` in grid mode applies `twitter-media-two` / `twitter-media-three` / `twitter-media-four`, but none of those classes are defined in `src/index.css`, `src/App.css`, or anywhere else. Result: tiles render as unstyled stacked divs, so X buttons overlap neighboring tiles (your 3-media screenshot) and the layout looks broken.

2. **Videos in multi-media grid lose their player.** Lines 562–574 of `TwitterStyleMediaPreview.tsx` render videos as a plain thumbnail `<img>` with a `Maximize2` icon overlay (the "double arrow" you see). No `FeedVideo`, no autoplay, no mute control — only when there's exactly 1 media item does it use `FeedVideo`.

3. **Clicking a tile breaks everything.** `handleImageClick` (line 154) flips `viewMode` to `'carousel'` when no `onImageClick` prop is passed (composer doesn't pass one). The carousel branch:
   - shrinks the layout via `getOrientationStyles()` (the "everything shrinks" effect),
   - renders a grey background while items load (the "grey thumbnail"),
   - hides the "back to grid" button (it only shows when `onImageClick` is set, line 710), so the user is stuck,
   - and the X button styling is z-fighting with the carousel overlay.

The carousel mode is built for the **public feed**, not the composer. It should never engage inside `EnhancedCreatePostForm`.

## Fix

Create a small, dedicated composer-only preview component and use it in the composer. Leave `TwitterStyleMediaPreview` untouched (it's used by `PostMediaDisplay`, `ProfilePostItem`, and the feed-side copy).

### New file: `src/components/feed/composer/ComposerMediaPreview.tsx`

A presentational component built specifically for the composer:

- **Props:** `media: MediaItem[]`, `onRemove: (item: MediaItem) => void`.
- **Layout** (Tailwind grid, no missing custom classes):
  - 1 item → full width, max-h ~480px, `object-contain`.
  - 2 items → `grid-cols-2 gap-1`, each `aspect-square`.
  - 3 items → `grid-cols-2 gap-1` with first tile spanning `row-span-2` (`aspect-[1/2]`), other two stacked square. This matches the layout intent and keeps each X inside its own cell.
  - 4 items → `grid-cols-2 grid-rows-2 gap-1`, each `aspect-square`.
- **Image tiles:** `<img>` with `object-cover` (or `object-contain` on the single-item case), rounded.
- **Video tiles:** render `<FeedVideo item={item} source="post" objectFit="cover" />` so autoplay / mute / duration badge keep working in **every** count, including multi-media. For the 1-item case use `objectFit="contain"` to match current single-video behavior.
- **Remove (X) button:** absolutely positioned `top-2 right-2` inside each tile with `z-10`, `bg-black/60`, `rounded-full`, identical visual to today's button. Because each tile is a real grid cell with `overflow-hidden`, the X can no longer sit on top of an adjacent image.
- **No click-to-expand.** Tiles don't switch modes. The only interactive element on top of a tile is the X (and the FeedVideo's own controls). This eliminates the "click → everything goes messy" bug entirely.
- **Wrapper:** `mt-3 rounded-xl overflow-hidden`, no extra background tint, matches current spacing.

### Edit `src/components/feed/EnhancedCreatePostForm.tsx`

- Replace the import on line 31 with `import { ComposerMediaPreview } from './composer/ComposerMediaPreview';`.
- Replace line 1158 `<TwitterStyleMediaPreview media={media} onRemove={removeMedia} />` with `<ComposerMediaPreview media={media} onRemove={removeMedia} />`.

That's the entire change set.

## Out of scope

- No changes to `TwitterStyleMediaPreview` itself, `PostMediaDisplay`, `FeedItem`, `ProfilePostItem`, or any feed-side rendering — the published-post preview already looks correct per your screenshots.
- No changes to `MediaUploader`, the upload pipeline, `FeedVideo`, `useVideoAutoplay`, `useVideoMute`, or the in-flight upload row work from prior turns.
- No new dependencies, no schema changes, no design-token changes.

## Verification

On `/create`, with viewport at desktop and mobile widths:
1. Upload 1 video → autoplay + mute toggle + duration badge present (unchanged).
2. Add 1 image (now 1 video + 1 image) → both render side-by-side as squares; the video tile keeps autoplay/mute/duration; both Xs sit cleanly inside their own tile; clicking either tile does **nothing** (no carousel, no shrink, no grey state); X removes the correct item.
3. Upload 1 video + 2 images → 2-column layout with the first tile (video) spanning two rows; X buttons no longer overlap the second image.
4. Upload 1 video + 3 images → 2×2 grid; every tile has a working X; video keeps playing.
5. After posting, the feed page render is unchanged (still uses `TwitterStyleMediaPreview`).
