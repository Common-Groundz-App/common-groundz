# Close Phase 1 (review video server foundation)

I checked the cleanup myself: John Carter has 0 reviews, and no test uploads or video links from the run remain.

## What gets recorded

**Verification note** (`docs/verification/review-video-phase-1.md`), new "Phase 1 closed" section:
- Database tests (single connection, rolled back): **39/39 passed**, including the strict one-hour rule for reviews and timeline updates.
- Race 1, private vs timeline video: **functional behaviour passed**. Live run on 2026-10-12 with the throwaway test account; the timeline video was refused with `review_video_public_only`. The reverse case is covered by the test suite (`review_video_visibility_locked`).
- Race 2, Mux "ready" vs removing the video: **functional outcome passed** in the test suite (late event ignored, video not restored, cover recomputed).
- Race 3, Mux "ready" vs reordering: **functional outcome passed** in the test suite (cover follows the first item in every case).
- True simultaneous overlap / lock proof for Races 1–3: **unverified**. The Supabase SQL Editor wouldn't run a second query while the first was still running, even in separate browser sessions.
- The locking design is in place: row locks on the review, a per-review timeline lock, and the Mux update locking the content before its link. It just couldn't be watched directly with two connections in this environment.
- Deliberately not used: dblink or other extensions, temporary helpers, new permissions, local database credentials.
- Test cleanup: exact IDs only, all test-specific counts back to 0 (confirmed by you and re-checked by me).
- Follow-up (optional): re-run the three races if a two-connection test setup becomes available.

**Roadmap** (review video section):
- Mark "Phase 1 two-connection concurrency tests" as closed: functional behaviour passed, overlap unverified because of the SQL Editor limitation.
- Mark Phase 1 complete.
- Leave Phase 2 open and on hold until you approve its plan.

## Then stop
Video uploads stay off on every review screen. After this, I'll write the Phase 2 plan (video on the new Review and Timeline pages) for your approval before building anything.

## Not touched
Database rules, permissions, posts, photo cleanup, legacy forms, review screens.
