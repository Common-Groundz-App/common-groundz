# Reverse Video Handoff (Lightbox → Feed)

When the lightbox closes, the original feed video should pick up where the lightbox left off: same timestamp, same play/pause state, same mute. Mute is a global preference and syncs even when the user has navigated to a different media item inside the lightbox; timestamp/play resume only applies to the originally-opened item.

Scope is strictly the reverse handoff. No changes to Mux/HLS, sizing, scroll-lock, composer, DB, backend, `photo-lightbox.tsx`, or unrelated feed logic.

## Stable entry index (locked down)

`LightboxPreview` already captures `entryIndexRef` when it mounts (the index the lightbox was opened on). That ref is the **only** source of truth for "did the user close on the same item they opened?"

- The exit handoff snapshot includes both `entryIndex` (immutable, from the ref) and `currentIndex` (where the user is now).
- `PostMediaDisplay` decides resume vs mute-only by comparing those two fields, never by reading any "currently active" state of its own.
- The feed tile that receives `resumeState` is the one whose `originalIndex === entryIndex` — not the tapped/active index, not the lightbox's current index.

## Files touched

1. `src/types/media.ts` — add `VideoExitHandoff`.
2. `src/components/media/LightboxPreview.tsx` — `closeWithHandoff()` + emit.
3. `src/components/feed/PostMediaDisplay.tsx` — handle exit handoff, set resume state, sync global mute.
4. `src/components/media/FeedCollage.tsx` — forward `resumeState` + `onResumeConsumed` to the matching `FeedVideo`.
5. `src/components/media/FeedVideo.tsx` — apply seek + mute + play, then call `onResumeConsumed`.

## Types

```ts
// src/types/media.ts
export interface VideoExitHandoff {
  currentTime: number;
  wasPlaying: boolean;
  muted: boolean;
  entryIndex: number;    // index the lightbox was originally opened on
  currentIndex: number;  // index the user is on when closing
}
```

## LightboxPreview.tsx

- New prop: `onExitHandoff?: (handoff: VideoExitHandoff) => void`.
- `closedRef = useRef(false)` so emission/close is idempotent across overlapping triggers (e.g. ESC during swipe).
- Single `closeWithHandoff()` used by **every** close path: close button, ESC, backdrop click, swipe-to-close.
- Body:
  1. If `closedRef.current` → return.
  2. Set `closedRef.current = true`.
  3. Read `videoElRef.current`. If null (image item, unmounted, etc.) → just `onClose()` and return; never throw.
  4. Snapshot: `{ currentTime: v.currentTime, wasPlaying: !v.paused && !v.ended, muted: v.muted, entryIndex: entryIndexRef.current, currentIndex }`.
  5. `onExitHandoff?.(snapshot)`.
  6. `onClose()`.

## PostMediaDisplay.tsx

- State: `videoResume: { index: number; handoff: VideoExitHandoff } | null`.
- `handleExitHandoff(h)`:
  - **Always** sync global mute: if `h.muted !== readGlobalVideoMuted()` → `setGlobalVideoMuted(h.muted)`. (Runs regardless of index, because mute is global.)
  - If `h.entryIndex === h.currentIndex` → `setVideoResume({ index: h.entryIndex, handoff: h })`. Otherwise leave null (no seek/play resume).
- Pass `onExitHandoff` to `LightboxPreview`.
- Pass `videoResume` + `onResumeConsumed={() => setVideoResume(null)}` to `FeedCollage`.

## FeedCollage.tsx

- Accept `videoResume` and `onResumeConsumed`.
- For the tile whose `originalIndex === videoResume?.index` AND is a video, forward `resumeState={videoResume.handoff}` and `onResumeConsumed`. All other tiles get `undefined`.

## FeedVideo.tsx

- Accept `resumeState?: VideoExitHandoff` and `onResumeConsumed?: () => void`.
- `useEffect` keyed on `resumeState`:
  - If no `resumeState` → return.
  - Define `apply()`:
    1. If `resumeState.muted !== readGlobalVideoMuted()` → `setGlobalVideoMuted(resumeState.muted)` first (before play, so autoplay can't re-mute from stale state).
    2. `v.muted = resumeState.muted`.
    3. Seek: `v.currentTime = clamp(resumeState.currentTime, 0, v.duration || resumeState.currentTime)`.
    4. If `resumeState.wasPlaying` → `v.play().catch(() => {})`.
    5. `onResumeConsumed?.()`.
  - If `v.readyState >= 1` → `apply()` synchronously.
  - Else add a one-shot `loadedmetadata` listener that calls `apply()`. Clean up on teardown.
  - Do NOT call `onResumeConsumed` synchronously before `apply()` runs.

## Verification

1. Playing feed video → tap → lightbox plays → close → feed continues at new timestamp, still playing.
2. Mute/unmute in lightbox → close → feed reflects new mute; other feed videos honor it via global store.
3. Paused feed video → tap → play in lightbox → close → feed resumes playing at new timestamp.
4. Close via X / ESC / backdrop / swipe — all behave identically.
5. Navigate inside lightbox to another item → mute → close → original feed video does **not** seek/play resume, but global mute IS updated.
6. Image-only items → close → no errors.
7. Supabase and Mux/HLS videos both work.
8. Rapid double-close (ESC during swipe) → handoff emits exactly once thanks to `closedRef`.

## Out of scope

- `photo-lightbox.tsx`
- Mux/HLS attach logic, `useVideoAutoplay`, view tracking
- Lightbox sizing, scroll-lock
- Composer, DB, edge functions, feed query logic
