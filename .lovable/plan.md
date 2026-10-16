# Fix 3 follow-up: the gap between "100%" and the video preview

## What we know from the code
- The bar follows the browser's "bytes sent" events. 100% means the browser sent the whole file. It does not mean Mux has confirmed it.
- The video tile (local preview + "Processing video…") is only added after the upload request returns a successful answer. So the 30–60s wait sits somewhere between "bytes sent" and "tile shown".
- **The cause is not confirmed yet.** It could be Mux taking a while to confirm, bytes still leaving the network behind a full bar, or something in our code still waiting (poster, retry, other finishing work). Step 1 measures this before we change anything.
- Processing → Ready in 2–5s is normal for Mux and stays as is.

## Plan

### 1. Measure the whole path first (no behaviour change)
For each attempt, record these times in the developer console only:
link requested / received, poster started / finished, first byte sent, all bytes sent, server response received + its status, upload step finished, tile shown, Processing seen, Ready seen.
- Check whether any code is still waiting after the server responds (poster wait, retries, other finishing calls).
- Report the measured breakdown with the results. If the wait is after the server response, fix that cause directly instead of hiding it.

### 2. One video item from the moment it's picked (Posts composer only)
- Once the file passes checks, add the real composer item straight away: same local identity, same local preview, same poster, same position, plus a fresh upload attempt ID.
- Fill in that same item step by step: upload ID → upload confirmed → Processing → Ready details. The tile never remounts, the preview never restarts, order never changes, its identity never changes.
- It takes the one video slot exactly once (no double counting between "uploading" and "attached").

### 3. Truthful status labels
- **Uploading X%** — real byte progress, never faked or held at 99%.
- **Upload sent — finishing…** — bar full, small spinner, while waiting for the server's answer.
- **Processing video…** — only after a successful server response (not just any reply).
- **Ready** — only from trusted server status (unchanged rule).
- On failure: "Upload failed — remove or try again", text kept.

### 4. Publish and save rules (unchanged, now applied earlier)
- Publish stays blocked during Uploading, Finishing and Processing, until trusted Ready.
- An unfinished item is never sent in the save.

### 5. Remove and replace
Removing at any stage (checks, uploading, finishing, processing, Ready) must immediately:
- remove the item and free the one-video slot;
- stop that exact upload attempt;
- ignore every late result from it (upload, poster, status);
- do the existing best-effort poster clean-up.
A newly picked video starts a fresh identity and attempt. Retrying a failed video also starts a new attempt and cancels the old one.

### 6. Tests and checks
- Tile appears before upload finishes; label sequence; preview not restarted at confirmation or Ready; only a successful response moves to Processing.
- Remove → replace during checks, uploading, finishing, processing and Ready, including late results from the old attempt and retry.
- Slot counted once; unfinished item never saved; publish blocked until Ready; over 60s still blocked.
- Full test suite and type check. Then stop for your real-upload checks, with the timing breakdown reported.

## Out of scope
Reviews/Timeline, feed/lightbox, server rules, database, Mux deletion.

## Technical details
- `uploadPostVideoViaMux` gets an `onStarted` callback (Posts only) after validation; every later callback carries `(clientKey, attemptId)` and is dropped unless both match the current item.
- `putWithProgress`: keep real percentages; report a separate `'sent'` stage on `xhr.upload.onload`; resolve only on 2xx in `xhr.onload`; record timing marks.
- `MediaUploader` / `EnhancedCreatePostForm`: insert the item on start, merge updates in place, abort via the attempt's `AbortController`; slot count uses composer items only; save payload filters items without a confirmed upload; `useMuxStatus` subscribes once an upload ID exists.
- After approval, record this task in `roadmap.md`.
