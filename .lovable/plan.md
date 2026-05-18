# Video Playback Continuity: Feed → Lightbox

## Goal

When a user taps a feed video, the lightbox should open at the same `currentTime`, preserve `wasPlaying`, and inherit the user's mute intent. Images are unchanged.

## Current behavior (root cause)

Feed and lightbox use two separate `<video>` elements:

- `FeedVideo` (`src/components/media/FeedVideo.tsx`) autoplays muted in the feed.
- Tap → `FeedCollage.onItemClick(originalIndex)` → `PostMediaDisplay.handleImageClick(index)` → opens `LightboxPreview`.
- `LightboxPreview` creates a fresh `<video>` with no `currentTime`, no autoplay, native `controls`. Always opens at `0:00`, paused.

No state is currently passed between the two videos.

## Target behavior

| Feed state when tapped | Lightbox opens at | Lightbox plays?         |
|------------------------|-------------------|-------------------------|
| Playing at 0:07        | 0:07              | Yes (muted if blocked)  |
| Paused at 0:07         | 0:07              | No                      |
| Image tapped           | unchanged         | unchanged               |

## Shared contract

Add to `src/types/media.ts`:

```ts
export interface VideoHandoff {
  currentTime: number;
  wasPlaying: boolean;
  muted: boolean;
}
```

Used by every layer (no inline object types).

## Implementation plan

### 1. FeedVideo — snapshot, then pause, then call onTap

Widen `onTap` to `onTap?: (handoff?: VideoHandoff) => void;`.

In `handleContainerClick`, **snapshot first, then pause** (order matters):

```ts
const v = videoRef.current;
let handoff: VideoHandoff | undefined;
if (v) {
  handoff = {
    currentTime: v.currentTime,
    wasPlaying: !v.paused,
    // Use global mute intent, not v.muted — browsers force-mute autoplay
    // even when the user has globally unmuted.
    muted: readGlobalVideoMuted(),
  };
  try { v.pause(); } catch { /* ignore */ }
}
onTap(handoff);
```

Import `readGlobalVideoMuted` from `@/hooks/useVideoMute`.

### 2. FeedCollage — thread handoff through

`onItemClick: (originalIndex: number, handoff?: VideoHandoff) => void;`

All three call sites (lines 65, 80, 393) forward it. Image tiles pass nothing.

### 3. PostMediaDisplay — store handoff, pass to lightbox

```ts
const [videoHandoff, setVideoHandoff] = useState<VideoHandoff | null>(null);

const handleImageClick = (index: number, handoff?: VideoHandoff) => {
  setActiveImageIndex(index);
  setVideoHandoff(handoff ?? null);
  setLightboxOpen(true);
};
```

Clear `videoHandoff` on lightbox close (reset before next open).

Pass as `initialVideoState={videoHandoff ?? undefined}`.

### 4. LightboxPreview — apply once on entry item

Add prop `initialVideoState?: VideoHandoff`.

In the video render:

- Add `ref` to the `<video>`.
- Use an `appliedRef = useRef(false)` flag — apply only once, only when `currentIndex === initialIndex`.
- On `onLoadedMetadata`:
  - Clamp: `seekTime = clamp(initialVideoState.currentTime, 0, max(0, duration - 0.5))`. If `!isFinite(duration)`, skip seek.
  - Set `video.muted = initialVideoState.muted`.
  - Set `video.currentTime = seekTime`.
- On `onSeeked` (one-time): if `initialVideoState.wasPlaying`, try `video.play()`. On rejection, set `video.muted = true` and retry once. If still blocked, leave paused — native controls show play button. Mark `appliedRef.current = true`.
- Navigating next/prev: handoff does NOT apply — those videos behave normally.

### 5. Edge cases / safeguards

- Only initial index gets the handoff; siblings start at 0.
- Clamp prevents opening at end of clip.
- Mute uses global intent, so unmuted users get unmuted lightbox playback (subject to browser policy).
- Images: no handoff sent, behavior identical.
- Don't change feed autoplay, scrubber, or layout.
- Handoff reset on close prevents stale state leaking into a later open of a different post.

## Files to edit

- `src/types/media.ts` — add `VideoHandoff` interface.
- `src/components/media/FeedVideo.tsx` — snapshot (before pause) in `handleContainerClick`, widen `onTap` signature.
- `src/components/media/FeedCollage.tsx` — widen `onItemClick`, forward handoff from `FeedVideo`.
- `src/components/feed/PostMediaDisplay.tsx` — store handoff, pass to `LightboxPreview`, reset on close.
- `src/components/media/LightboxPreview.tsx` — accept `initialVideoState`, apply on `loadedmetadata` + `seeked`, autoplay with muted-retry fallback.

## Out of scope

- iOS scrubber inset (separate ticket).
- `PhotoLightbox` (`src/components/ui/photo-lightbox.tsx`) — not used in feed path.
- Native `controls` in lightbox.
- Feed autoplay logic.

## Verification

1. Desktop Chrome: autoplaying feed video at ~0:05 → tap → lightbox opens at ~0:05 and continues playing.
2. Pause feed video at 0:07 → tap → lightbox opens at 0:07, stays paused.
3. Globally unmuted feed → tap playing video → lightbox opens unmuted and playing (if browser allows).
4. Tap an image → lightbox behavior identical to today.
5. Inside lightbox, navigate next/prev → those videos start at 0 normally.
6. iOS Safari: if unmuted autoplay blocked → muted retry succeeds; if still blocked → paused at correct timestamp with native play button.
7. Close lightbox, open a different post's video → no stale handoff from previous post.
