# Media cleanup: correct the record, audit every case, deletion approved separately (3D separate)

## What is happening, in plain words

Uploading a photo puts a file in storage right away, before you press Save. Saving a review or update only stores a link to that file. When the link goes away, the file stays unless something deletes it. A file with no link left is an orphan.

## Correcting my last report

I said all three sessions "uploaded 4 and saved 2", with the extras being over-limit uploads. That was wrong:
- **Oct 6 session (8162b991…):** 4 uploaded, all orphans. The draft was left without Save or Cancel.
- **Oct 8 sessions (8d661012…, 3acac8bc…):** each had 4 uploaded, 2 saved and 2 removed before Save. This "removed before Save" gap is now fixed.

The totals still stand: 12 files, 4 to keep and 8 orphans.

## How each case behaves in the code today (to be confirmed by the audit)

| Situation | Today |
|---|---|
| More than 4 picked | Extra files are refused with a warning and never uploaded (3B). |
| Upload finishes after you left | Deleted if the draft was left unsaved. Kept if a save was in progress or unclear. |
| New upload removed, then Save confirmed | Deleted after a confirmed save (3C). |
| Cancel | Only this visit's new uploads are deleted. Earlier saved media is untouched. |
| Save result unclear | Nothing is deleted. |
| **Saved photo/video removed during Edit, then saved** | **The file is left behind.** The cleanup deliberately skips earlier saved media. |
| Tab closed or reloaded mid-draft | Files may be left behind (known gap). |
| Videos | Not checked yet. Hosted video, preview image and poster may each need their own deletion. |

## Steps in this approval (read-only, except the notes correction)

1. **Correct the verification notes** with the true Oct 6 and Oct 8 causes.
2. **Deletion report only, no deletion.**
   - Give the bucket and the full, unabridged paths of the 8 candidates and the 4 files to keep.
   - Run a fresh reference check, listing every place checked: posts, reviews (media and cover image), timeline updates, entity photos, entity images, video upload records, profile pictures, and any other media field found.
   - Match web addresses and storage paths in every form they're stored, including inside structured media lists.
   - Any check that errors counts as "unknown", not "safe".
   - Deleting the 8 files becomes a separate approval after you see this report.
3. **Photo and video lifecycle audit.** Confirm each row of the table above for both the old pop-up forms and the new pages. Report which gaps affect which.
   - **Videos:** map out exactly what is saved (storage file, hosted video ID, playback ID, preview, poster) and which deletion each part needs.
   - **Shared files:** check whether one file can legitimately be linked from more than one place, for example copied posts, entity photos taken from reviews, or cover images.
   - **Existing cleanup tools:** check the existing admin orphan-cleanup tools. They wait until files are 7 days old, and they may not cover video records or profile pictures. Decide whether they can become the reliable sweep.
4. **Propose, don't build, the "removed during Edit" fix.** Removed saved media only becomes a *candidate* after a confirmed edit. The server then:
   - re-checks every reference across all places media can be linked from;
   - deletes only files with zero references;
   - retries failures;
   - keeps anything whose ownership or save result is uncertain.

   Server-side is preferred over cleanup in the browser, which can be interrupted or race with another save. Videos stay on their own route until the audit proves photo deletion is safe for them.
5. Report back and stop.

## About 3D

Cleanup is tracked separately from 3D. My recommendation is to decide on the Edit-removal fix before 3D makes the new page the default, because that gap grows with normal use. You choose whether it actually blocks 3D after seeing the audit.

## Technical details
- Gap source: `committedLeftovers()` in `uploadSession.ts` excludes stored media (`ReviewComposerScreen.tsx:391`, `TimelineComposerScreen.tsx:244`).
- `cleanup-orphan-media` (dry-run) only collects posts.media, reviews.media/image_url, review_updates.media, entity_photos.url and entities.image_url. Coverage gaps such as `mux_upload_mappings`, `mux_uploads` and profile avatars are to be verified.
- Any later deletion uses the storage API on `post_media`, never SQL on `storage.objects`.
- roadmap.md gets this task once out of plan mode (plan mode only allows plan edits).
