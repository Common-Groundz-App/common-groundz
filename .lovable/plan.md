# Fix: the new review Edit page can't save (with or without photo changes)

## What I checked
- **Old pop-up vs new page:** both send the same fields: headline, text, rating, cover photo, photos, who can see it, date and extra details. Both leave the subject alone. There's no obvious missing field.
- **Database edit rules:** the save is refused if the subject, author, system fields or non-questionnaire details change, or if it's past the 1-hour window. The Afnan review was created at 14:58 UTC, so both your tries (15:09 and 15:33) were inside the hour.
- **Stored review:** it has no extra details saved yet (empty), no experience date, a 5 rating and 4 photos. It was never updated, so both saves were fully refused.
- **Photos:** the save fails even without photo changes, so photo removal isn't the trigger. The new photo-cleanup rules also run on every save that includes photos, so they're still a suspect.
- I can't see the exact error. Server logs for that time are empty, and I can't sign in to the preview as you on this project.

## Steps
1. **Show the real reason on screen.** For an unrecognised save error, the "Couldn't save your review" toast will also show the server's short reason, such as `review_metadata_locked` or a database message. It never shows personal data. This turns the next failure into an exact diagnosis.
2. **Reproduce locally first.** In my local test database, load the real review edit rules plus the new photo-cleanup rules. Then replay exactly what the new page sends for a review like Afnan's: empty details, no date, 4 photos, unchanged and with 2 removed. Do the same with what the old pop-up sends, and compare which one is refused and why.
3. **Fix the actual cause** with the smallest change, in either the page or the database rules. Processing stays OFF.
4. **Add regression tests:** editing a review with no changes, with text changed, and with photos removed must save. Removed photos must be queued, not deleted.
5. **You test:** open Afnan's Edit, press Save changes with no changes, then again after removing 2 photos. Both should save, and the review should show 2 photos. If it still fails, the toast now shows the reason and you send me a screenshot.

## Old pop-up
Not audited further. It's being removed soon.

## Still off
Processing, schedule, weekly deletion, the review page rollout and 3D.

## Technical details
- Update path: `updateReview()` → PATCH `reviews` + `.select().single()`. Payload from `buildEditReviewPayload`.
- Triggers to replay: `reviews_00_enforce_edit_window` (identity, metadata, system-field locks and window), `media_guard`, and `reviews_queue_removed_media`. Also the SELECT-after-update under RLS.
- Toast change is in `ReviewComposerScreen.tsx` catch for `status === 'error'`. Use error `code` and `message`, truncated.
