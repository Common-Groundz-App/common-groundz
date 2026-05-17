## Goal

Add a Twitter-style seekable progress bar to feed videos. Subtle by default (hairline), full controls on hover/focus/paused/scrubbing. Single-file change in `src/components/media/FeedVideo.tsx`. No other files touched.

## Visibility model

`isActive = isHovered || isFocused || isScrubbing || !isPlaying`

- **Idle (playing, not hovered/focused/scrubbing):** only a hairline progress line at the bottom (`h-0.5`, low-opacity white track + white fill). No buttons, no time text, no backdrop.
- **Active:** play/pause (left) · `currentTime / duration` (center-left, `tabular-nums`) · mute/unmute (right) · thicker progress bar (`h-1`) with a small thumb · subtle bottom gradient backdrop for legibility.

Auto-hide: when the video resumes playing and pointer is no longer over the container, fade back to idle after a 2s grace period. Timer cleared on any new interaction and on unmount (per project setTimeout policy — no setInterval).

Mobile: no tap-to-show-controls mode. Tapping the video body continues to open the lightbox exactly as today. Mobile users see controls when the video is paused or while scrubbing the bottom bar.

## State to add in `FeedVideo`

- `currentTime: number` — updated from `<video>` `onTimeUpdate`
- `duration: number` — captured in `handleLoadedData` (already exists)
- `isHovered: boolean` — `onPointerEnter` / `onPointerLeave` on container
- `isFocused: boolean` — explicit `onFocus` / `onBlur` on container (container already has `tabIndex={0}`)
- `isScrubbing: boolean` — set by scrubber pointer handlers
- `hideTimerRef: useRef<number | null>` — for the 2s auto-hide; cleared on cleanup

Autoplay hook receives `enabled={autoplayEnabled && !isScrubbing}` so it doesn't fight the scrubber.

## Scrubber interaction

New small `VideoProgressBar` subcomponent co-located in the same file, using Pointer Events for unified mouse + touch:

- `onPointerDown`: `setPointerCapture`, record `wasPlaying`, pause video, `setIsScrubbing(true)`, seek to click x.
- `onPointerMove` (while captured): seek to `clientX` relative to bar's `getBoundingClientRect()`, clamp 0..duration.
- `onPointerUp` / `onPointerCancel`: release capture, restore play if `wasPlaying`, `setIsScrubbing(false)`.
- All handlers call `e.stopPropagation()` so they never bubble to the container's lightbox handler.

**Mobile hit target:** the visible bar is `h-0.5` (idle) / `h-1` (active), wrapped in a transparent `h-3` (≈12px) padded hit zone with extra vertical padding so finger taps land reliably even when the line is hairline-thin.

Keyboard: when the scrubber is focused, ArrowLeft/Right seek ±5s.

A11y: `role="slider"`, `aria-valuemin=0`, `aria-valuemax={duration}`, `aria-valuenow={currentTime}`, `aria-label="Seek video"`.

## Control buttons in the bar

- Play/pause → reuses existing `togglePlayPause()`.
- Mute → reuses existing `toggleMute()`.
- Both call `e.stopPropagation()` on click (matches the existing pattern already used by the centered play button and current mute button).

Time text: `text-xs font-medium text-white tabular-nums`, formatted via existing `formatDuration` helper.

## Lightbox-safety verification (must hold after change)

The container's `onClick` is the only path that calls `onTap()` → lightbox. Therefore:

- Scrubber pointer down/move/up/cancel + click → `stopPropagation` → no lightbox.
- Play/pause button click → `stopPropagation` → no lightbox.
- Mute button click → `stopPropagation` → no lightbox.
- Tapping anywhere on the video body outside these controls → bubbles to container `onClick` → opens lightbox (unchanged).

Will be verified after implementation by clicking each control in the preview and confirming the lightbox does not open, then tapping the video body and confirming it does.

## Removed (replaced cleanly by the new bar)

- Top/bottom-left **duration badge** (`{formatDuration(item.duration)}` block).
- Floating **bottom-right mute button** — moves into the bar.

Both are removed only after the new bar is rendering correctly, so there is no intermediate state without mute or duration affordances.

## Kept

- Big centered play/pause button (Phase 1 keeps the obvious paused-state affordance).
- All existing hooks: `useVideoMute`, `useVideoAutoplay`, `useVideoMilestones`, `useVideoViewTracker`.
- All existing behaviors: autoplay-on-visibility, mute persistence, view tracking, object-fit, loop, poster fallback, error/unsupported overlays, retry, visibility-change pausing.
- Container `onClick` → `handleContainerClick` → `onTap()` → lightbox. Unchanged.

## Out of scope

Fullscreen, volume slider, speed control, captions, settings, PiP, buffered-range UI, chapter markers. No changes to `FeedCollage`, `MediaLightbox`, post detail, other feed variants, hooks, backend, or analytics.

## Risk

Low. Single-file change. No new dependencies. `stopPropagation` discipline already proven for the existing mute and centered play buttons in this file. Auto-hide uses `setTimeout` with cleanup per project policy.
