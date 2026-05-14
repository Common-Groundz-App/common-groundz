## Goal

Fix two leftover issues from the previous video composer polish pass. Frontend-only, no backend / schema / behavior changes.

## Issue 1 — Mobile in-flight upload renders inside the sticky toolbar

On desktop the in-flight `UploadRow`s were lifted out of `MediaUploader` and rendered above the toolbar (`EnhancedCreatePostForm.tsx` ~line 1201). On mobile, the composer uses a separate `MediaUploader` instance mounted inside `ComposerBottomBar` (`src/components/feed/composer/ComposerBottomBar.tsx` line 77), which still uses the default `renderUploadsInline=true`. So during upload, the progress row appears stacked on top of the sticky bottom toolbar (matches `mobile.png`), instead of in the content area above the toolbar (where `mobile_preview_final.png` shows the final media preview lives).

### Fix

1. `src/components/feed/composer/ComposerBottomBar.tsx`
   - Add two optional props that simply pass through to the inner `MediaUploader`:
     - `renderUploadsInline?: boolean`
     - `onUploadsChange?: (uploads, cancel) => void`
   - Forward both to `<MediaUploader>` on line 77.

2. `src/components/feed/EnhancedCreatePostForm.tsx`
   - On the `<ComposerBottomBar>` render (~line 1359), pass:
     - `renderUploadsInline={false}`
     - `onUploadsChange={handleUploadsChange}` (the same handler already wired to the desktop `MediaUploader`).
   - The existing in-flight rows block (~line 1201, rendered above both the desktop footer and the mobile sticky bar) already renders `inFlightUploads`, so on mobile the rows will now appear in the same in-content region as the final media preview — matching the desired layout.

No new state, no UI duplication; both desktop and mobile feed the same `inFlightUploads` state.

## Issue 2 — In-flight upload row lingers ~2s after the final preview appears

In `src/components/media/MediaUploader.tsx`, the upload `.then()` callback marks the upload `status: 'success'`, calls `onMediaUploaded(mediaItem)` (which causes `TwitterStyleMediaPreview` to render the final media), and then schedules a `setTimeout(..., 2000)` to remove the row and revoke the local poster URL. The result: for ~2 seconds, the in-flight row and the final preview are both visible (matches `stays.png` / `mobile_preview.png`); after 2s the row disappears (matches `disappears.png` / `Mobile_preview_final.png`). The user wants the handoff to feel instant.

### Fix

In `MediaUploader.tsx`, in the `uploadMedia(...).then((mediaItem) => { ... })` success branch:

- Call `onMediaUploaded(mediaItem)` and update counts as today.
- Remove the upload row **immediately** from `uploads` (single `setUploads` filter call) instead of inside a 2s `setTimeout`.
- Revoke `localPosterUrl` in the same step (the final preview uses the server `thumbnail_url`, not the blob URL, so revoking is safe).
- Drop the `setTimeout` block entirely.

Rationale:
- Final preview already mounts in the same React commit that adds the media item, so the visual handoff is one frame.
- The transient `status: 'success'` state was only ever used to drive the 2s display window; with the row removed immediately, the existing `'✓'` success badge code stays in `UploadRow` but is simply never visible — fine, no other code depends on it.

Error path is unchanged: `status: 'error'` rows still stay until the user dismisses them.

## Out of scope

- No changes to `useVideoMute`, `useVideoAutoplay`, `FeedVideo`, `LightboxPreview`, `MediaCompatibilityBadge`.
- No backend, schema, edge function, view tracking, or Replace-flow work.
- No restyling of the upload row itself.

## Verification

- Desktop (1219×850): upload an MP4 — in-flight row above the toolbar disappears the instant `TwitterStyleMediaPreview` renders the final video; toolbar icons remain aligned throughout.
- Mobile (~390×844): upload an MP4/MOV — the in-flight row now appears in the content area above the sticky bottom bar (not on top of it), and disappears the instant the final preview renders.
- Cancel during upload still works (manual remove path untouched).
- Failed upload still shows the error state until cancelled.
