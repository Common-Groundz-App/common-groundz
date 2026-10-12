# Review video — Phase 2 (new Review / Timeline composers)

Date: 2026-10-12. Setting `reviews.video_enabled` added and left **OFF**.

## Built
- New Review page, Timeline Update page and both edit pages accept photos plus one video (4 items, 1 video, 100 MB browser-reported, 60 s) when the setting is ON, Mux uploads are ON and the review (or parent review) is public.
- Videos upload through Mux only (`uploadMedia(..., { videoMuxOnly: true })`, sends `declared_size`); no storage fallback. Mux off → picking disabled with a message.
- Live status chip on video tiles (Processing → Ready / Upload failed) via `useMuxStatus`, no reload.
- Save blocked while a file is transferring; allowed while processing; blocked for a failed NEW video; a saved video that failed later does not block unrelated edits.
- Cancelling a transfer drops its late result (slot released once, preview image removed, Mux video kept).
- Review visibility: Private/Circle disabled with a reason when the review or any of its timeline updates has a video. Server rule stays authoritative; Phase 1 error codes mapped to friendly messages.
- Saving: kept saved videos are sent exactly as loaded; new videos without trusted Mux fields; cover left to the server whenever a video is present. Uncertain-save comparison ignores server-filled Mux details.
- Setting OFF only stops new picks; uploads already in progress finish; saved videos remain visible and removable within the hour.
- Admin: "Review videos" switch in Feature flags → Reviews.

## Tests
- App suite: 73 files, 1026 passed, 3 skipped (includes new `reviewVideoPhase2.test.ts` and all legacy photo-only tests).
- Database, rolled back, made-up Mux details (`supabase/tests/review_video_phase2.sql`): 8/8 passed — ready, processing and failed saved videos survive unrelated edits; replacement removes old link and links new (pending); removal marks link removed (review and timeline); no upload rows deleted.

## Not done / open
- Browser checks of the four modes: not run. This environment has no signed-in session for the app (external Supabase), so the composer pages can't be opened here. Needs your separately authorised signed-in run.
- Phase 1 concurrency overlap remains **unverified**; Phase 2 testing does not change that.
- Display surfaces (cards, entity pages, lightbox, autoplay) are Phase 3.
