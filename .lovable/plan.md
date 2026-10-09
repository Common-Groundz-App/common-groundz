# Fix: editing a review to remove saved photos fails to save

## What we know (checked)
- The Afnan review (created 14:58 UTC) still has its 4 photos and was never updated. The edit was refused, not partly saved.
- Nothing was added to the new photo-cleanup list, so the cleanup step either rejected the save or never ran.
- The edit was ~11 minutes after posting, well inside the 1-hour edit window, so "edit window closed" is not the cause.
- The server logs available to me were empty for that time, so the exact error is **not yet confirmed**. The prime suspect is the new photo-cleanup check added today, which runs when photos are removed. It could also be an older problem with removing saved photos on the new edit page, which hadn't been tried before.
- Selecting 6 and getting 4 is expected: the limit is 4, and the extras are refused before upload.

## Decision on the old pop-up form
Agreed: don't audit it. It's being deleted soon, and there are no real users.

## Steps
1. **Reproduce safely and capture the exact error.** On the preview, signed in as your account, create a throwaway test review with 2 photos. Edit it, remove 1 photo and save. Record the exact server error (code and message), not the generic toast. The real Afnan review is not touched.
2. **Fix the actual cause** shown by step 1, in the smallest change. If it's the new cleanup rules, correct them with a database change that keeps processing OFF. Add a local regression test for "edit review, remove a saved photo, save succeeds and the photo is queued".
3. **Verify end to end:** the test review saves with the photo removed. That photo appears once in the cleanup list as "queued" and is **not** deleted (processing is off). The kept photos still display.
4. **Clean up the test review** using the normal Delete in the app. Its photos get queued, not deleted.
5. **Hand back to you:** retry the Afnan edit yourself (remove 2, Save changes) and confirm it saves.

## How you can test it yourself after the fix
1. Open the review, choose Edit and remove 1–2 photos.
2. Press Save changes. It should save and show the review with the remaining photos.
3. Edit again and confirm the removed photos are gone and the rest are intact.

## Still off
Processing, schedule, weekly deletion, the review page rollout and 3D.

## Technical details
- Suspects to check against the captured error: the `reviews_queue_removed_media` AFTER trigger, the `media_guard` BEFORE trigger, and the `media_deletion_candidates_validate` trigger. Also the existing `enforce_review_edit_window` trigger, and the `.select().single()` return after update under RLS.
- Capture the error through the Playwright network response of PATCH `/rest/v1/reviews`.
