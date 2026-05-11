# Video Support — Phase 1 (Final)

## Goal
Ship usable, modern short-video support without taking on backend transcoding. Frontend + Supabase Storage only.

## Policy
```
Accepted formats:    MP4, MOV, WebM
Max duration:        60 seconds
Max file size:       100 MB
Max videos per post: 1
Poster thumbnail:    required (auto-generated client-side)
Playback:            muted autoplay in viewport, tap-to-fullscreen
Compression:         deferred to Phase 2
Backend transcode:   deferred to Phase 2
```

## Phase 1 scope (ship together)

### 1. Limits & validation — `src/services/mediaService.ts`
- `MAX_VIDEO_SIZE`: 25 MB → **100 MB**
- `ALLOWED_VIDEO_TYPES`: trim to `video/mp4`, `video/quicktime`, `video/webm`
- Keep `MAX_VIDEO_DURATION` at 60s
- Friendly inline composer messages: "Video selected · 42 MB · 0:38" / "Video too long. Keep it under 60 seconds." / "Video too large. Max 100 MB." / "Format not supported. Use MP4, MOV, or WebM."

### 2. HEVC soft warning (no block)
- For `.mov` selections, run `videoElement.canPlayType('video/mp4; codecs="hvc1"')` and a basic playback probe
- If browser likely can't play it, show a non-blocking notice: "This iPhone video may not play for all viewers. For best results, record in 'Most Compatible' mode (H.264) or upload an MP4."
- Upload still proceeds — Phase 2 transcoding will fix this properly

### 3. Poster thumbnail — new `src/utils/videoPoster.ts`
- Hidden `<video>` → seek 0.1s → draw to `<canvas>` → JPEG ~640px wide, quality 0.8
- Upload to `post_media` at `{userId}/{sessionId}/{uuid}_poster.jpg`
- Persist `thumbnail_url`, `width`, `height`, `duration` on the `MediaItem`
- Extend `MediaItem` type with `duration?: number`

### 4. Composer UX — `MediaUploader.tsx` + `EnhancedCreatePostForm.tsx`
- Live poster preview as soon as the file is picked
- Show duration + file size below the preview
- Replace / Remove buttons
- Skeleton placeholder while poster generates (project standard: skeletons not spinners)
- Helper text: "Images up to 10 MB · Video up to 100 MB, 60 seconds (MP4, MOV, WebM)"
- Use **"experience"** terminology in copy
- Skip `capture="environment"` — it can hijack gallery selection on Android

### 5. Feed & detail playback — `PostMediaDisplay.tsx` + `TwitterStyleMediaPreview.tsx`
- Use generated `thumbnail_url` as `<video poster>` (kills the black-frame problem)
- **Duration badge overlay** bottom-right of the video tile (e.g. "0:38")
- **Vertical-first sizing**: portrait videos get `max-h-[600px]` like portrait images already do
- **Muted autoplay in viewport** via new `src/hooks/useVideoAutoplay.ts`:
  - `IntersectionObserver` at 50% visibility, plays muted on enter, pauses on exit
  - Suppressed when `prefers-reduced-motion`, `navigator.connection.saveData`, or effective connection is `2g` / `slow-2g`
  - On any failure, fall back to tap-to-play (don't break the tile)
- **Persistent mute** via new `src/hooks/useVideoMute.ts`:
  - Global state in `localStorage` key `video.muted` (default `true`)
  - Tap toggles globally; unmute icon shown when muted
  - Reuses existing `useLocalStorage` hook
- **Mobile tap-to-fullscreen**: extend the existing `LightboxPreview` (already wired for images in `PostMediaDisplay`) to render `<video controls autoplay>` for video items — single-tap on mobile opens it

### 6. Lightweight telemetry — `src/services/analytics.ts`
- `video_uploaded` — `{ size, duration, format, orientation }`
- `video_played` — fired once on first `play` event per video instance — `{ autoplay: boolean }`
- That's it. Completion %, watch time, scrub events all deferred to Phase 1.5.

## Files to touch
- `src/services/mediaService.ts` — limits, format list
- `src/types/media.ts` — add `duration`
- `src/utils/videoPoster.ts` — NEW
- `src/utils/codecSupport.ts` — NEW (HEVC probe helper)
- `src/hooks/useVideoAutoplay.ts` — NEW
- `src/hooks/useVideoMute.ts` — NEW
- `src/components/feed/PostMediaDisplay.tsx` — sizing, lightbox-for-video
- `src/components/feed/TwitterStyleMediaPreview.tsx` — poster, duration badge, autoplay hook, mute hook
- `src/components/media/MediaUploader.tsx` — preview, validation messages, helper text, HEVC warning
- `src/components/media/LightboxPreview.tsx` — render `<video>` when item is video
- `src/components/feed/EnhancedCreatePostForm.tsx` — wire video preview
- `src/services/analytics.ts` — two new event helpers

## Phase 1.5 (fast follow, separate work)
- Orphan media cleanup edge function (weekly cron, deletes unreferenced uploads >7 days old)
- Watch-time / completion % analytics
- Any autoplay edge-case polish discovered after launch

## Phase 2 (out of scope)
- Backend transcoding (Mux / Cloudflare Stream / Bunny / Cloudinary)
- HLS adaptive streaming, HEVC → H.264 conversion, multiple resolutions
- Auto-captions (Whisper)
- Multi-video posts
- Full-screen reels-style swipeable feed
- Video trim/crop in composer
- Client-side ffmpeg WASM compression

## Acceptance criteria
- A 60s, 70 MB MP4 from a phone uploads and plays in feed
- A 30 MB AVI is rejected with a clear "use MP4, MOV, or WebM" message
- A `.mov` containing HEVC uploads with a warning shown to the user
- Feed video tiles never show a black frame — always a real poster + duration badge
- Videos start muted and autoplay when ≥50% visible, pause off-screen
- Autoplay is suppressed under data-saver, reduced-motion, or 2G
- Tapping a video toggles mute globally; choice persists across sessions
- Single-tap on mobile opens the video fullscreen in the existing lightbox
- Composer shows poster, file size, and duration immediately on selection
- Portrait videos render up to 600px tall, not capped at 400px
- `video_uploaded` and `video_played` events fire to analytics
