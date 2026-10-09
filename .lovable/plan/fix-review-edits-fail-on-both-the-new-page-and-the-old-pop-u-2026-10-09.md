# Fix: review edits fail on both the new page and the old pop-up

## What we know
- The error you found (`search_funnel_events` check) is unrelated. It's search tracking, and it doesn't block anything.
- Both forms now fail, even with no photo changes. Before today's photo-cleanup change, the old pop-up's edit worked. So the likely cause is one of the new photo-cleanup rules that run on every review save. This is not yet confirmed: the server logs I can reach are empty for that time.
- The Afnan review is unchanged. Each save was fully refused.

## Steps
1. **Capture the exact error, changing nothing.** Replay a no-change save of the Afnan review as your account, inside a test that is always undone. It returns only the database's error message, and no data is changed. I couldn't run this in plan mode.
2. **Fix the actual rule** that error points to, with one small database change. Processing stays OFF. Re-run my local test suite with the real review edit rules loaded too, so this kind of break is caught next time.
3. **Confirm again with the always-undone test:** a no-change save and a save with 2 photos removed both succeed. The removed photos are queued (not deleted).
4. **Show the real reason in the error message.** If a review save fails for an unknown reason, the message will include the short server reason, so we never have to guess again.
5. **You test:** edit Afnan's review, press Save changes (no changes), then remove 2 photos and save. Both should work, and the review should show 2 photos.
6. **Separately (optional):** fix the search-tracking error. It's harmless but noisy.

## Still off
Processing, schedule, weekly deletion, the review page rollout and 3D.

## Technical details
- Step 1: a `DO` block sets `request.jwt.claims` to the owner and `SET LOCAL ROLE authenticated`. It runs the same `UPDATE reviews` (`media`, `image_url`, `description` and `updated_at` unchanged values), catches `SQLSTATE`/`SQLERRM`, and re-raises it so the transaction always rolls back.
- Suspects: `media_guard` (BEFORE), `reviews_queue_removed_media` (AFTER) and their helper calls. That includes function EXECUTE revokes, the function owner, and `jsonb_path_query strict` on the server version. Also their interaction with `reviews_00_enforce_edit_window` and RLS `.select()` after update.
