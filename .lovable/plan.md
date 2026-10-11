# Phase 1 close-out: strict one-hour rule + real concurrency tests

## My view

I agree with you and both reviewers, and I accept all their corrections (details below). The "remove broken video after the hour" exception should go.

- One rule is easier to explain and safer to maintain: **edit for 1 hour, then the entry is locked**.
- The owner still has real options: delete the whole timeline update (or the whole review), or add a new timeline update.
- A failed video is never shown to other people, and the owner sees "Couldn't process this video". It isn't free, though: the author loses that video in that entry, and the Mux file is kept (and costs a little) until the later Mux cleanup phase. That's the tradeoff we're choosing for a simpler rule.
- Mux finishing its processing after the hour is a **system update**, not an author edit. That stays allowed and still does not touch edit times.

Phase 2 stays on hold until everything below passes.

## 1. Remove the exception

- I checked the real database code. The function that actually exists is `remove_broken_review_video(text, uuid, text)`. The name `remove_errored_review_video` was only in an earlier plan and was never created. ChatGPT's corrected signature is right; mine was wrong.
- Remove that function. Then check the database's function list for any other version with the same or the old name, and confirm none is left and signed-in users can no longer call it.
- This function didn't use any special bypass of its own (it relied on normal rules), so no bypass logic needs removing. The only bypass left is the internal Mux update, which stays.
- Keep all other Mux failure handling unchanged: failed and too-long videos never play, stay hidden from others, and show the failed state to the owner.
- Keep the internal Mux "video ready / failed" update working after the hour, limited to the playback fields and cover, with edit times unchanged.
- Update the earlier plan wording: the "Remove video" button after the hour is dropped. Within the hour the author removes or replaces a video through normal Edit.

## 2. Tests (root reviews and timeline updates alike)

Re-run the full Phase 1 suite, adjusted:
- Drop the tests for the removed action. Add: calling it now fails because it no longer exists.
- New: after the hour, a signed-in owner trying to change media directly (API, not the screen) is rejected for **root reviews and timeline updates**, including removing only a failed video and swapping a video.
- New: after the hour, the internal Mux update still marks a video ready or failed and updates the cover, with edit times unchanged.
- Within the hour: normal Edit can remove or replace a video.
- Deleting a whole timeline update or review with a failed video still works after the hour, and its video link is marked removed.
- Regression checks: photo-only timeline create and edit, post videos unchanged, D2 photo cleanup does not queue anything from Mux updates.

## 3. Real concurrency tests

**No `dblink` and no other add-on will be installed.**

**Where:** this project has only one database (your live one); there is no separate test copy I can use. So the tests run on the live database, limited to a designated test account and a few throwaway test records created just for the test. Before I run anything I'll show you the exact helper code for approval.

**Test account:** I need you to name one test account to use (not a real person's account). I won't pick or sign in as anyone else.

**Temporary helper rules** (all signed-in users share one database role, so "only the test user" has to be checked inside the helper):
- fixed safe `search_path`;
- checks the signed-in user is exactly the test account's ID, and the target record is one of the fixed throwaway records; rejects everything else;
- does only the one operation being tested, through the **normal save path**, so the same rules and permissions we're testing still apply (it does not skip them);
- then holds its open transaction for a few seconds so the second request has to wait.

**Proving the race really happened:** while the first request is holding, I'll check that the second one is actually waiting on that lock (the database shows this), and record timings. Two requests sent at the same time isn't treated as proof by itself.

**Cleanup:** the helper and test records are removed afterwards even if a test fails, and I'll confirm they're gone.

Cases:
1. Making a review private vs saving a timeline update with a video: exactly one succeeds; a private review never ends up with a video.
2. Mux "video ready" vs removing that video: the removed video never comes back and the cover is never left showing it.
3. Mux "video ready" vs reordering items: the cover always matches the final first item.

## 4. The earlier timeline-save outage (~20 minutes)

I'll report three things separately:
- **Known:** the exact time window (from when the faulty change went live until the fix), the cause (a review-only check ran on timeline updates) and the fix.
- **From the database:** timeline updates that did save during that window.
- **Unknown unless logs show it:** how many saves failed. Failed attempts never reach the database, so missing rows prove nothing. I'll check the server request logs for failed timeline saves in that window; if the logs don't go back that far, I'll say the number is unknown.

## 5. Report and stop

Update the Phase 1 verification note, roadmap and project notes with results, then stop. Phase 2 needs your separate approval.

## My additions

- Add a lasting automated check that fails if any author-callable function can change review media after the hour, so the exception can't quietly come back.
- After removing the function, re-run the security scan and confirm the earlier warning about it is gone.

## Not touched

Posts, legacy popup/inline forms, rollout switch, D2 photo cleanup, existing unlinked Mux videos, review screens (video stays off).

## Technical details

- Migration: `DROP FUNCTION IF EXISTS public.remove_broken_review_video(text, uuid, text);` then query `pg_proc` for `remove_broken_review_video` / `remove_errored_review_video` overloads and drop any found; verify `has_function_privilege('authenticated', ...)` is false or the function is absent. Check whether `mux_upload_is_broken` is still used elsewhere; keep it only if so (revoked from clients).
- `supabase/tests/review_video_phase1.sql`: remove removal tests; add expiry tests on `reviews` (direct UPDATE as authenticated, via `enforce_review_edit_window`) and `review_updates` (`edit_latest_review_update` returns `expired`; no direct UPDATE policy). Add a catalog guard listing SECURITY DEFINER functions executable by `authenticated` that write `reviews.media` / `review_updates.media`.
- Concurrency helper: temporary `SECURITY INVOKER` where possible (so RLS and triggers apply as the test user); if DEFINER is required, `SET search_path = public, pg_temp`, hard-coded test UID + record IDs, EXECUTE granted to `authenticated` only because of that guard. Performs the action, then `pg_sleep(3)` before commit. Overlap proof: a third read checks `pg_locks` / `pg_stat_activity` for `wait_event_type = 'Lock'` on the second backend. Mux side driven via the existing service-only patch path from a server context, not a broadened bypass.
- Cleanup in a `finally` step: drop helper, delete fixed test rows and their mappings, verify absence.
- Outage: window from migration timestamps; persisted rows via `review_updates.created_at`; failures via database/API logs if retained.
