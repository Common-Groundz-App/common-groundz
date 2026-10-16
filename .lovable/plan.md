# Fix 3 follow-up: the gap between "100%" and the video preview

## What is happening (from the code)
- The progress bar is driven by the browser's "bytes sent" events. These reach 100% when the file has been handed to the network layer, not when Mux has received and confirmed it.
- The video tile (local preview + "Processing video…" badge) is only added to the composer after Mux confirms the upload. So the 30–60s wait is the time between "browser says 100%" and "Mux says received".
- For a 5s / 8.9 MB file this most likely means the real transfer to Mux was still running behind a full bar (slow upload speed, buffered bytes), or Mux's upload server was slow to confirm. Which one it is is **not yet confirmed** — step 1 measures it.
- Processing → Ready in 2–5s is normal Mux behaviour and stays as is.

## Plan

### 1. Measure first (no behaviour change)
- Record timings per attempt in dev console only: link received, first byte sent, progress 100%, Mux confirmation, tile shown, Ready.
- Run one real upload on the preview to confirm where the 30–60s goes.

### 2. Show the video tile immediately (Posts composer only)
- Add the tile with the local preview as soon as the file passes checks, with a status of "Uploading… X%", then "Finishing upload…" after 100% until Mux confirms, then the existing "Processing video…" badge, then Ready.
- The tile keeps the same stable local identity throughout, so the preview never restarts.
- Publish stays blocked until the server says Ready (unchanged rule).
- If upload fails: tile shows "Upload failed — remove or retry"; text is kept.

### 3. Honest progress
- Cap the bar at 99% labelled "Finishing upload…" until Mux actually confirms, so the bar never sits at 100% while still waiting.

### 4. Remove-and-replace check
- Removing a video while uploading cancels that upload, frees the slot, drops any late poster/result for it.
- Removing after upload frees the slot; picking a new video starts a fresh attempt with a new identity; status for the old video is ignored.
- Rapid remove → re-add, and remove during "Finishing upload…", must leave exactly one video and the correct preview.

### 5. Tests and checks
- Tests: tile appears before upload finishes; status sequence; preview not restarted on confirmation/Ready; cancel during upload and during finishing; replace with a different video; old video's late events ignored; publish blocked until Ready; over-60s still blocked.
- Full test suite and type check; then a real upload measurement before/after.

## Out of scope
Reviews/Timeline, server rules, database, Mux deletion, feed/lightbox.

## Technical details
- `uploadPostVideoViaMux` gains an `onStarted(placeholder)` callback (Posts path only) fired after validation; the final item is merged into the placeholder by `clientKey`, never by index.
- `putWithProgress`: clamp to 99 until `xhr.onload`; emit `'finalizing'` stage.
- `MediaUploader` / `EnhancedCreatePostForm`: placeholder insertion, cancel via existing `AbortController` keyed by `clientKey`; `useMuxStatus` only subscribes once an `upload_id` exists.
