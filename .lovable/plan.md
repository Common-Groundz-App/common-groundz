## Why

The composer (`ComposerMediaPreview`) and the feed (`PostMediaDisplay` → `FeedCollage`) use two different layout systems for the same media. That causes three visible problems:

1. **Single portrait video in composer** (`1_media.png`) — the tile is `aspect-auto max-h-[480px]` with `FeedVideo` at `objectFit="contain"`, with no real intrinsic-ratio frame. The bottom control row (play, scrubber, duration, mute) ends up clipped / off the visible video box. The multi-tile case "works" only because those tiles have a real `aspect-square`.
2. **Single portrait video looks zoomed-in** — same root cause: no intrinsic-ratio measurement, so the video is sized by `max-h` only and visually crops.
3. **Multi-item composer collage stretches videos** (`4_media.png`) — `ComposerMediaPreview` forces every tile to `aspect-square` + `object-cover`, while feed `FeedCollage` letterboxes videos on black (`object-contain`). Composer stretches; feed preserves original form. That's the inconsistency you flagged.

Fix: render the composer preview through the same `FeedCollage` used by the feed, so composer and feed are visually identical and the single-video controls problem disappears for free.

## What changes — frontend only

No business logic, no upload pipeline, no Mux, no `mediaService`, no post creation, no feed behavior.

### 1. `src/components/media/FeedCollage.tsx` — backward-compatible extension only

Add two **optional** props. Existing feed callers (`PostMediaDisplay`) pass neither → feed behavior and layout are byte-for-byte unchanged.

```ts
interface FeedCollageProps {
  // ...existing
  renderTileOverlay?: (item: MediaItem, originalIndex: number) => React.ReactNode;
  disableItemClick?: boolean;
}
```

Implementation rules:

- **`renderTileOverlay` always receives the ORIGINAL media index** (the `originalIndex` already tracked on `DisplayEntry`), never the post-sort display index. `FeedCollage` reorders entries internally (it promotes the first video to slot 0 for multi-item posts), so this is the critical guardrail — the composer's remove `X` must operate on the original `media[]` order or it will delete the wrong item.
- Render `{renderTileOverlay?.(item, originalIndex)}` inside both `renderTile` and `SingleMediaTile`, after the media element, inside the same relatively-positioned tile wrapper. This lets the overlay anchor (absolute `top-2 right-2`) against the actual tile box.
- When `disableItemClick === true`: skip the `onClick={() => onItemClick(...)}` and drop the `cursor-pointer` class on both `renderTile` and `SingleMediaTile`. Also do not pass `onTap` to `FeedVideo` in that mode (so tapping the video toggles play/mute inline instead of trying to open a lightbox).
- Both flags are strictly opt-in. `PostMediaDisplay` is not touched.

### 2. `src/components/feed/composer/ComposerMediaPreview.tsx` — thin wrapper

Replace the bespoke 1/2/3/4 grid with:

```tsx
<FeedCollage
  media={sorted}
  source="post"
  onItemClick={() => {}}
  disableItemClick
  renderTileOverlay={(item, originalIndex) => (
    <>
      {overlayForItem?.(item)}            {/* Mux processing/ready/failed chip */}
      <RemoveButton
        onClick={(e) => { e.stopPropagation(); onRemove(item); }}
        aria-label="Remove media"
      />
    </>
  )}
/>
```

- `onRemove(item)` (existing prop) is called with the **MediaItem reference**, not an index — so even though `originalIndex` is what `FeedCollage` exposes, the caller stays index-agnostic and the wrong-item bug cannot happen.
- Keep the existing `X` button styling (`absolute top-2 right-2`, destructive ghost, `z-10`).
- `overlayForItem` (existing prop, used for Mux processing/ready/failed chips) keeps working unchanged through the same overlay slot.
- The single-item branch (`SingleMediaTile` inside `FeedCollage`) already hugs intrinsic ratio and uses `FeedVideo`, so scrubber + mute + duration render correctly and the portrait video stops looking zoomed — without any composer-side ratio logic.

### 3. Nothing else touched

`PostMediaDisplay`, `FeedVideo`, `LightboxPreview`, upload pipeline, `mediaService`, Mux paths, post creation — all unchanged.

## Guardrails (hard requirements)

1. **Feed must not change visually or behaviorally.** No feed caller passes the new props, and the new props default to `undefined` / `false`. Existing feed paths execute the exact same code as today.
2. **Composer remove must target the correct item.** Overlay callback receives the original `MediaItem` + original index; the X handler calls `onRemove(item)` by reference. Verified against `FeedCollage`'s internal video-promotion reorder.

## Out of scope

- Click-to-open lightbox in the composer (composer is preview-only).
- Any change to upload, Mux, post creation, or feed layout.
- Any change to `FeedVideo` controls, autoplay, mute, or HLS attach.

## Verification

1. Composer — 1 portrait video: original portrait ratio, no zoom/crop, scrubber + mute + duration visible, X removes it.
2. Composer — 1 landscape image: ratio looks normal, X works.
3. Composer — 2/3/4 mixed media including a portrait video: collage matches feed style; portrait video letterboxes on black (contain) instead of stretching; X works on every tile; removing tile 2 removes tile 2 (not the promoted-video slot).
4. Post it → feed output is visually identical to the composer preview.
5. Existing feed posts (single + multi, image + video) render with zero visual regression.
