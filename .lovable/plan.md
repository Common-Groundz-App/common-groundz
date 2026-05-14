## Refinements (revised)

All three issues confirmed and approved. Implementation is frontend-only; toolbar layout stays unchanged.

### 1. Composer upload row pushes toolbar buttons up

**Cause:** `MediaUploader` is mounted *inside* the desktop toolbar in `EnhancedCreatePostForm.tsx` via `customButton`. In customButton mode it renders the upload-progress rows directly under the trigger button, inside the toolbar's flex container — so during upload, rows stack on the Image button and visibly shift Image / Smile / More out of alignment.

**Fix — hoist the in-flight rows out of the toolbar without touching the toolbar layout:**

- Add to `MediaUploader`: `renderUploadsInline?: boolean` (default `true`) and `onUploadsChange?: (uploads: MediaUploadState[]) => void`.
- When `renderUploadsInline={false}`, the customButton branch renders only the trigger; uploads are reported via `onUploadsChange`.
- In `EnhancedCreatePostForm.tsx`, lift `inFlightUploads` state into the form. Pass `renderUploadsInline={false}` + `onUploadsChange={setInFlightUploads}` to the toolbar `MediaUploader`.
- Render the in-flight rows in the same vertical region as `TwitterStyleMediaPreview`, immediately above the desktop toolbar (matches `after_upload.png`). Reuse the existing `renderUploadRow` markup unchanged — export it from `MediaUploader` (or a small shared `UploadRow` component) so visuals stay identical.
- The **toolbar markup itself is not modified** — only the source of upload-progress rendering moves.

### 2. Missing thumbnail during upload

**Cause:** Thumbnail only appears when `upload.item?.thumbnail_url` exists, which is set after `uploadMedia()` resolves. Until then the row shows a `Skeleton` (or nothing for `.MOV`), as visible in `During_upload_*.png`.

**Fix — generate a client-side poster from the file before upload starts:**

- Extend `MediaUploadState` in `src/types/media.ts` with optional `localPosterUrl?: string` and `localDuration?: number`.
- In `MediaUploader.handleFileSelect` for video files, call `generateVideoPoster(file)` (already in `src/utils/videoPoster.ts`) in parallel with the existing HEVC compatibility check. On success, set `URL.createObjectURL(posterBlob)` as `localPosterUrl` and `duration` as `localDuration` on the upload state.
- Update `renderUploadRow` thumbnail priority:
  1. `upload.item?.thumbnail_url` (server)
  2. `upload.localPosterUrl` (client)
  3. `Skeleton` while poster is still generating
  4. `Film` icon when poster generation fails
- Show the duration badge as soon as `localDuration` is known.
- **Revoke `localPosterUrl`** in `cancelUpload` and in the existing 2s success cleanup `setTimeout` to avoid memory leaks.

### 3. Mute icon out of sync with actual audio

**Cause:** `useVideoAutoplay.safePlay()` imperatively sets `el.muted = true` to satisfy browser autoplay policy, but the React `muted` state in `useVideoMute` reads from `localStorage`, which can hold `false` from a prior unmute. Result: video is actually silent, but the icon shows `Volume2`.

**Fix — single shared helper, used by both hooks:**

- In `src/hooks/useVideoMute.ts`, extract and export a top-level helper:
  ```ts
  export function setGlobalVideoMuted(muted: boolean) {
    try { window.localStorage.setItem('video.muted', JSON.stringify(muted)); } catch {}
    window.dispatchEvent(new CustomEvent('video-mute-change', { detail: muted }));
  }
  ```
  Refactor `toggle()` to call it (no behavior change).
- In `src/hooks/useVideoAutoplay.ts` `safePlay()`, after `el.muted = true`, call `setGlobalVideoMuted(true)` — but only if the current persisted value is not already `true`, to avoid event spam.
- This guarantees every `FeedVideo` instance renders `VolumeX` whenever autoplay forces mute. The user's first click then deliberately unmutes via the existing `toggleMute` path, which works correctly.

## Out of scope

- No backend / schema / edge function changes.
- No toolbar redesign, view tracking, autoplay threshold, or lightbox changes.
- No Replace flow, multi-video, captions, transcoding.

## Small hardening additions (low risk)

- **Cap concurrent poster generations** — if the user selects 4 files at once, run `generateVideoPoster` calls sequentially per file (they're already called per-file in the loop, so this is automatic; just confirm we don't `Promise.all` them).
- **`useVideoMute` hydration parity** — `useVideoMute` already initializes from `localStorage`, so once the autoplay hook flips storage to `true` and dispatches the event, late-mounting `FeedVideo` instances also see `muted=true`. No extra change needed; just call out for verification.

## Verification

- **Composer alignment (1219×850):** upload an MP4 + a `.MOV` together; the in-flight rows render above the toolbar; Image / Smile / More / Visibility / Cancel / Post stay on a single row throughout the upload; row disappears 2s after success and committed `TwitterStyleMediaPreview` takes its place.
- **Thumbnail during upload:** local poster appears within ~200ms of file select for both MP4 and `.MOV`; duration badge present immediately; no broken-image placeholder.
- **Mute sync (composer):** with `localStorage['video.muted'] = 'false'` from prior session, open `/create` with a video → icon shows `VolumeX`, audio silent; click → `Volume2` + audio; click → `VolumeX` + silence.
- **Mute sync (feed):** scroll to an autoplaying video on `/home` → icon is `VolumeX` regardless of stored value.
- **Memory:** open DevTools Memory; cancel and complete several uploads → no retained `blob:` URLs after cleanup.
