# Video UI Polish — Final Plan

Frontend-only. No schema, edge function, or business logic changes. Preserves the existing private view tracking pipeline.

## Scope summary

1. Composer video preview row polish
2. Feed video card (skeleton, center play/pause, mute, error/fallback, sizing)
3. Mobile lightbox (safe area, persistent close, portrait/landscape fit, fading nav only)
4. Error / loading / unsupported states
5. Compatibility copy + design-token cleanup

## Guardrails (adopted from review)

- Defer Replace. Keep Remove + re-upload.
- Do not hijack whole-video tap — keep current mute-toggle / lightbox behavior.
- Add a dedicated center play/pause button only.
- Mobile lightbox close button is always visible; only nav arrows + counter dots fade.
- All play/pause goes through the real `<video>.play()` / `.pause()` so `useVideoViewTracker` + milestones keep working untouched.
- Pause the feed video before opening lightbox (no double audio).
- Per-instance `userPausedRef` so manual pause is not immediately overridden by `useVideoAutoplay`; cleared when the element leaves and re-enters the viewport.
- Use `motion-safe:` on fade transitions.
- Replace hardcoded colors (`text-purple-500`, `text-blue-500`, `text-green-500`, `text-red-500`, `border-gray-300`) with semantic tokens.
- Accessibility: `aria-label` + `aria-pressed` on play/pause + mute; Spacebar toggles play/pause when the video container is focused.

## Additional safety nets (new)

- **Single-source mute state.** Continue using `useVideoMute()` so mute is shared across feed videos and survives the lightbox round-trip.
- **Resume policy after lightbox close.** When the lightbox closes, do NOT auto-resume the feed video — let `useVideoAutoplay` re-evaluate on next intersection. Avoids surprise audio.
- **`preload="metadata"` retained**, plus `onLoadedData` to hide the skeleton (don't rely on `oncanplay`, which is flakier on Safari).
- **Error branching** uses `video.error?.code`:
  - `MEDIA_ERR_SRC_NOT_SUPPORTED` (4) → "This video format isn't supported on your device." No retry button.
  - Anything else → "Video failed to load." Retry button calls `video.load()`.
- **Poster fallback** renders a neutral `bg-muted` block with a centered `Film` icon (`text-muted-foreground`) when neither `thumbnail_url` nor a decoded frame is available — prevents black rectangles.
- **Focusable container.** Add `tabIndex={0}` + `role="group"` + `aria-label="Video"` to the FeedVideo root so the Spacebar handler has a target without trapping focus elsewhere.
- **Reduced motion.** Use `motion-safe:transition-opacity motion-safe:duration-200` everywhere we fade. Static otherwise.
- **Mobile safe area.** Use `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` on lightbox chrome only — not the media element itself.

## File-by-file changes

### `src/components/media/FeedVideo.tsx`
- Add state: `status: 'loading' | 'ready' | 'error' | 'unsupported'`, `isPlaying`, `userPausedRef`.
- Render order inside the relative wrapper:
  1. `<video>` (unchanged props; add `onLoadedData`, `onError`, `onPlay`, `onPause`).
  2. Poster fallback: shown when `!item.thumbnail_url && status !== 'ready'`.
  3. `<Skeleton className="absolute inset-0">` while `status === 'loading'`.
  4. Error overlay (`status === 'error'` → message + Retry; `status === 'unsupported'` → message only).
  5. Center play/pause button: 44px, `bg-black/55 hover:bg-black/70`, fades out `motion-safe` while `isPlaying`, instantly visible on hover/focus and when paused. Calls `videoRef.current.play()` / `.pause()`. Sets `userPausedRef.current = true` on manual pause.
  6. Mute button: bump to `min-h-9 min-w-9`, `aria-pressed={muted}`, `aria-label` toggles.
  7. Duration badge (unchanged).
- Update `useVideoAutoplay` integration so it skips `play()` while `userPausedRef.current` is true; reset the ref via `IntersectionObserver` when ratio drops to 0 then crosses threshold again. (Done locally inside `FeedVideo` — no hook signature change.)
- Sizing: portrait videos (intrinsic `videoHeight > videoWidth`) get `aspect-[9/16] max-h-[560px]`; otherwise current sizing.
- Container: `tabIndex={0}`, `role="group"`, `aria-label="Video"`, `onKeyDown` handles Space/Enter for play-pause.

### `src/components/media/LightboxPreview.tsx`
- Before opening (caller side): pause feed video. We'll expose a tiny `onBeforeOpen` hook by simply pausing in `FeedVideo`'s `onTap` right before invoking the existing open handler. (No prop signature changes to LightboxPreview itself beyond the new fade behavior.)
- Close button: `top-[max(env(safe-area-inset-top),0.75rem)] right-3`, `h-10 w-10`, always visible, `aria-label="Close"`.
- Nav arrows + counter: fade after 3s of no interaction using `motion-safe`. Reset timer on pointermove/keydown.
- Portrait media: `object-contain max-h-[100dvh]` with safe-area padding on chrome only.
- Add chrome safe-area: `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]` on header/footer layers.

### `src/components/media/MediaUploader.tsx`
- Replace icon colors:
  - `Film` → `text-muted-foreground`
  - `ImageIcon` → `text-muted-foreground`
  - Success "✓" → `text-success`
  - Error "✗" → `text-destructive`
- `border-gray-300` → `border-border`.
- Row layout: bump preview thumbnail to `w-16 h-16 rounded-md`, add a duration overlay badge (bottom-right inside the thumb) when `upload.item?.duration` known.
- Under filename, render `{type} · {prettyBytes(file.size)} · {formatDuration(duration)}` in `text-xs text-muted-foreground`.
- Keep current Cancel (X). No Replace action.

### `src/components/media/MediaCompatibilityBadge.tsx`
- Compatible copy → "Should play everywhere".
- Risky copy → "May not play on some devices".
- Keep tokens as-is.

### Utility (small)
- `src/utils/videoPoster.ts` — add `prettyBytes(n: number)` helper if not already present (otherwise inline).

## Out of scope (explicit)

- Replace flow
- Backend / edge function changes
- Schema changes
- Public view counts
- Reels feed
- Multi-video posts
- Captions / subtitles
- Trim / crop
- Transcoding

## Verification

- Desktop 1219×850 and mobile 390×844:
  - Upload an MP4 and a MOV → composer row shows thumbnail, duration, size, compatibility badge.
  - Scroll feed → skeleton appears then video plays muted; mute button toggles label + `aria-pressed`.
  - Tap center play/pause → autoplay does NOT immediately resume; scroll out and back → autoplay re-evaluates.
  - Force a 404 video URL → "Video failed to load" + Retry; force unsupported codec → unsupported copy, no retry.
  - Open lightbox → feed video pauses (no double audio); close → feed does not auto-resume until back in view.
  - Lightbox close button stays visible after 3s; nav arrows fade.
  - Spacebar toggles play/pause when the video container is focused.
- Confirm `media_views` rows still insert on real plays (view tracker untouched).