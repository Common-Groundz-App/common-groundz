# Media next steps (revision 3): delete the 8, photo-only reviews, corrected cleanup design

## My take on the reviews

I agree with both reviewers. Where they differed, I chose this:
- **No live video test.** The code already shows review videos can't be linked back from Mux, because only posts are supported. A test would also create a hosted video that we can't currently delete. So I'll do a read-only check instead: see whether any review video was ever sent to Mux and left unlinked.
- **Build photo-only reviews now.** It's small, easy to undo, and closes the "broken option" risk before 3D. Posts and the home page are untouched.
- **Cleanup system: corrected design only, no build.** All of Codex's four gaps and ChatGPT's two are addressed below.

## How edited reviews are saved

Timeline edits go through a server function (`edit_latest_review_update`). Root-review edits save straight to the reviews table from the browser, with no server function.

So queueing must not rely on the browser. Instead, a database trigger on both tables queues removed photos in the **same database transaction** as the edit.
- If the save commits, the queue entry exists, even if the browser timed out.
- If the save fails, nothing is queued.

## Approving this plan approves

**A. Deleting exactly these 8 files** (bucket `post_media`):
```text
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/0fd6a00c-1a58-4676-9608-6c03362acbeb.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/dc0c15a1-6a33-403d-a24f-f7e00e0c787f.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/3c58738b-d49b-4e39-818f-7b74cb7a1f00.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/79d638f7-c62e-4a01-a910-da7ba4df8ac3.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/993196a5-d6a4-4253-a940-ea67e7a5326d.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/af8c8aaa-e71f-4bd3-b88f-2a1d689e8118.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/47b425d6-20ae-4878-99af-d278501fe2f1.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/78a542b6-4b1f-41fe-bb49-174b01a55ae8.png
```
- Re-check every reference right before deleting. Skip any file that's linked or whose check is uncertain.
- Report what was actually deleted.
- Confirm the 4 saved photos still open and no content changed.

**B. Photo-only review and timeline forms** (old pop-up and new pages):
- new videos are refused when picked and when dragged in, with a short message. Refused videos never start uploading and never take up a photo slot;
- the wording changes to "Add photos";
- **existing saved videos** (including the May 2025 one):
  - keep playing and count toward the limit of 4;
  - stay attached through ordinary edits, comment-only edits and Cancel;
  - **can't be removed or replaced from Edit yet**: the remove button is hidden for them until video cleanup exists;
- posts and home keep Mux exactly as today;
- tests cover: picking refused, dragging refused, no upload or slot used, photos still work, posts unchanged, an existing video kept through edits and Cancel, and no remove button on it.

**C. Read-only video check:** look for videos sent to Mux but never linked back. Where it can't be proven that a video came from a review, it's labelled "unknown". Report only.

**D. The corrected cleanup design**, written into the audit notes. **Design only.** No table, trigger, worker or automatic deletion is built.

## Corrected cleanup design (D)

1. **Queueing:** a trigger on reviews and review_updates fires after a media change in the same transaction. It queues *old minus new* paths, normalised with one shared path function.
2. **One lock per file:** queueing, the claim before deletion, and every save that *newly adds* a path all take the same short per-file lock. So a save and a deletion can't interleave.
3. **Only newly added paths are checked.** A save that keeps a file it already had is never rejected, even if that file is queued for another record. Shared files stay usable, and unrelated edits never fail.
4. **States:**
   - queued: can't be newly added; the worker re-checks it later.
   - deleting: can't be newly added.
   - deleted: can never be added again.
   - failed / uncertain: can't be added, and an admin reviews it.
   - kept: a reference was found, so the file returns to normal use.
5. **Worker, in two steps:**
   - **Database step:** one transaction holds the file lock only while it runs. It does the final reference check across every listed place, then commits either *kept* or *deleting*. The lock ends with that transaction.
   - **Storage step:** only after *deleting* is committed does it call the storage service. Every save that newly adds a path respects the committed *deleting* state, so no lock needs to span the storage call.
   - An already-missing file counts as success. Errors are retried, then marked *failed*.
   - The design includes tests where a save and a deletion run at the same moment.
6. **Coverage document:** the exact columns and JSON shapes covered:
   - `posts.media[].url/thumbnail_url`
   - `reviews.media[]`, `reviews.image_url`
   - `review_updates.media[]`
   - `entity_photos.url`
   - `entities.image_url`, `entities.stored_photo_urls`
   - `entity_suggestions.suggested_images`
   - `profiles.avatar_url` / `cover_url`
   - Mux records

   It also covers how full addresses, signed addresses and bare paths are normalised, and the tests for shared files and the entity-suggestion photo.
7. **Weekly sweep:** widened to the same coverage, and stays report-only.

## Then stop

I report A–D and stop, with the rollout switch off.

```text
next, separately approved:
D2  build + verify the cleanup system
3D  can be built with the switch OFF in parallel
ON  needs B live + 3D checks passed
    + your decision on whether D2 must be done first
later: Mux for reviews/updates (own phase), then retire the old forms
```

Whether D2 must come before the switch goes on is decided when you approve D2, not in this step. My recommendation is yes, because the new page makes edits the main path.

## Technical details
- B: an optional `allowVideo` prop on MediaUploader, default `true`, so posts are unchanged. It filters both the file input and drop handlers, and existing `initialMedia` videos stay.
- C: `mux_uploads` rows whose upload_id is not in `mux_upload_mappings`, joined against the review composer's session usage.
- D lock: `pg_advisory_xact_lock(hashtextextended(path, 0))`, taken in the guard trigger for added paths, the queue trigger, and the worker claim RPC.
- roadmap.md gets A–D once out of plan mode.
