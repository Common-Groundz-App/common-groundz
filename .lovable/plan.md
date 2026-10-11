# Phase 1 close-out: strict one-hour rule + real concurrency tests

## My view

I agree with you and both reviewers. The "remove broken video after the hour" exception should go.

- One rule is easier to explain and safer to maintain: **edit for 1 hour, then the entry is locked**.
- The owner still has real options: delete the whole timeline update (or the whole review), or add a new timeline update.
- A failed video harms nobody: other people never see it, and the owner sees "Couldn't process this video".
- Mux finishing its processing after the hour is a **system update**, not an author edit. That stays allowed and still does not touch edit times.

Phase 2 stays on hold until everything below passes.

## 1. Remove the exception

- Remove the "remove broken video" server action entirely, including signed-in users' access to it.
- Keep all other Mux failure handling unchanged: failed and too-long videos never play, stay hidden from others, and show the failed state to the owner.
- Keep the internal Mux "video ready / failed" update working after the hour, limited to the playback fields and cover, with edit times unchanged.
- Update the earlier plan wording: the "Remove video" button after the hour is dropped. Within the hour the author removes or replaces a video through normal Edit.

## 2. Tests (root reviews and timeline updates alike)

Re-run the existing 31 database tests, adjusted:
- Drop the 3 tests for the removed action. Add: calling it now fails because it no longer exists.
- New: after the hour, a signed-in owner trying to change media directly (API, not the screen) is rejected for **root reviews and timeline updates**, including removing only a failed video and swapping a video.
- New: after the hour, the internal Mux update still marks a video ready or failed and updates the cover, with edit times unchanged.
- Within the hour: normal Edit can remove or replace a video.
- Deleting a whole timeline update or review with a failed video still works after the hour, and its video link is marked removed.
- Regression checks: photo-only timeline create and edit, post videos unchanged, D2 photo cleanup does not queue anything from Mux updates.

## 3. Real concurrency tests: how, before anything is installed

I don't have a direct database connection in this workspace, so the database can't currently open two connections to itself without an add-on.

**Preferred approach (no add-on):** run two real requests at the same moment from this workspace through the app's normal API, each on its own connection, signed in as a test account. To make the two requests reliably overlap, I'd add **one temporary test-only helper** that does the operation and then holds its lock for a few seconds. It is:
- callable only by that test account, used only for the test run;
- deleted straight after the tests in the same session;
- unable to change how the app behaves for anyone else.

Cases:
1. Making a review private vs saving a timeline update with a video: exactly one succeeds; a private review never ends up with a video.
2. Mux "video ready" vs removing that video: the removed video never comes back and the cover is never left showing it.
3. Mux "video ready" vs reordering items: the cover always matches the final first item.

Test rows are created on a test account and deleted after.

**Fallback, only if you approve it separately:** the `dblink` add-on (built into Postgres; lets the database open a second connection to itself). Installed only for the test run, then removed. It doesn't change app behaviour, but it widens what the database can do while installed, so I'd avoid it unless the first approach fails.

## 4. The earlier timeline-save outage (~20 minutes)

- Report the exact time window and the cause (a review-only check ran on timeline updates) and fix (already applied).
- Check the database for that window: list any timeline updates actually saved then, and any visible gaps, so nobody is told to retry something that did save (avoids duplicates).

## 5. Report and stop

Update the Phase 1 verification note and roadmap with results, then stop. Phase 2 needs your separate approval.

## Not touched

Posts, legacy popup/inline forms, rollout switch, D2 photo cleanup, existing unlinked Mux videos, review screens (video stays off).

## Technical details

- Migration: `DROP FUNCTION public.remove_broken_review_video(text, uuid, uuid)`; remove any trigger branch that recognised its bypass so only `app.mux_review_patch` + `is_trusted_server_context()` + `review_mux_patch_is_valid` remains. Edit-window and media triggers otherwise unchanged.
- `supabase/tests/review_video_phase1.sql`: remove removal tests; add expiry tests on `reviews` (direct UPDATE as authenticated, via `enforce_review_edit_window`) and `review_updates` (`edit_latest_review_update` returns `expired`; direct UPDATE has no policy).
- Concurrency harness: temporary `SECURITY DEFINER` function `zz_test_hold_*` granted to the test user only, doing the action then `pg_sleep(3)` inside the transaction; two parallel PostgREST calls via Python with the minted session; function dropped afterward and its absence verified.
- Outage check: query `review_updates` by `created_at` in the window between the faulty and fixed migration timestamps.
