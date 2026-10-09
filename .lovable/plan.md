# Media cleanup: correct the record, delete the 8, audit every case (stop before 3D)

## What is happening, in plain words

Uploading a photo puts a file in storage right away, before you press Save. Saving a review or update only stores a link to that file. When the link goes away, the file stays unless something deletes it. A file with no link left is an orphan.

## Correcting my last report (Codex was right)

I said all three sessions "uploaded 4 and saved 2", with the extras being "over-limit" uploads. That was wrong:
- **Oct 6 session (8162b991…):** 4 files, all orphans. This was the draft from the photo-limit test that was left without saving or cancelling. None were saved.
- **Oct 8 sessions (8d661012…, 3acac8bc…):** 4 uploaded, 2 saved, 2 removed before Save. This was the "removed before save" gap, which is now fixed.

So the totals stand (12 = 4 to keep + 8 orphans), but the explanation was wrong. The verification notes will be corrected.

## How each case behaves in the code today

| Situation | Today |
|---|---|
| More than 4 picked | Spare slots are reserved before uploading. Extra files are refused with a warning and never uploaded (fixed in 3B). |
| Upload finishes after you left | Deleted if the draft was left unsaved. Kept if a save was in progress or unclear. |
| New upload removed, then Save confirmed | Deleted after the save is confirmed (fixed in 3C). |
| Cancel | Only this visit's new uploads are deleted. Photos saved earlier are untouched. |
| Save result unclear | Nothing is deleted. |
| **A photo/video saved earlier is removed during Edit, then saved** | **Not deleted. The file is left behind as an orphan.** The cleanup code deliberately skips anything saved earlier. |
| Tab closed or reloaded mid-draft | Files may be left behind (known gap, like Oct 6). |
| Videos | Not checked yet. Videos go through a separate video host, and deleting the storage file may leave the hosted video and its preview image behind. |

## Steps in this approval

1. **Delete the 8 orphans.** First, re-check every place media can be linked from. Then delete only those 8 exact files through the storage service. Afterwards, confirm the 8 are gone, the 4 saved photos still open, and no saved content changed.
2. **Fix the record.** Correct how the Oct 6 and Oct 8 orphans came about in the verification notes.
3. **Audit only, no fixes.** For photos and videos separately, confirm each row of the table above from the code and the live data. This includes:
   - the video path (hosted video, preview image, poster file);
   - the existing admin orphan-cleanup tools, which could be the future server sweep.
4. **Propose the fix for "removed during Edit"** for you to approve before anything changes:
   - delete only after the edit is confirmed saved;
   - only files no longer in the saved update;
   - after a fresh check that no other review, update, post or entity still links to them;
   - never on Cancel or when the save result is unclear;
   - same rules for videos, including their hosted copy.
5. Report back and stop. 3D stays untouched.

## Why this order

The 8 files are confirmed unlinked, so deleting them is safe and separate from everything else. The "removed during Edit" gap would leave a new orphan every time someone removes an old photo. That matters most once the new page becomes the default in 3D, so it gets audited and decided first.

## Technical details
- Gap source: `committedLeftovers()` in `uploadSession.ts` excludes the stored update/review media (`ReviewComposerScreen.tsx:391`, `TimelineComposerScreen.tsx:244`).
- Existing pieces to evaluate: `cleanupReviewMedia` in `services/review/core.ts`, and the edge functions `cleanup-orphan-media`, `cleanup-orphan-media-execute` and `admin-media-cleanup-*`.
- Deletion is done with the storage API in the `post_media` bucket, never with SQL on `storage.objects`.
