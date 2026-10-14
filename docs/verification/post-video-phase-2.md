# Post video — Phase 2 (server rules)

Date: 2026-10-14. No app code changed; /create untouched. Review videos stay OFF.

## Old-posts report (read-only, before enforcement)
161 posts, 38 videos (16 Mux, 22 stored files). Over 4 items: 0. More than 1 video: 0. Over 60 s: 0 (longest 32 s). No stable identity: 0.

Known historical data, excluded by owner decision (not repaired, not relinked; Mux assets may be deleted):
- `d4941fd5-c594-433b-9501-9d339482f55b` (live) — Mux video without link record, stuck "preparing".
- `3e5b7e00-1c4b-49ca-8cc3-9cc1f31b5b6f` (deleted) — same.
Both unchanged after the migration (media checksums unchanged).

## Built
- `mux_uploads.duration_rule_applies`: true for every upload created from now on, false for all 50 existing; no caller can change it.
- `zz_posts_media_mux_before` on posts: 4 items / 1 video (refused only when worse than before); every new or changed Mux video rebuilt by `post_mux_truth_item` from its upload record (playable fields only when ready; processing/failed/too long keep `url=''`, no thumbnail, no playback ID); uploader must be the author; unchanged existing videos kept byte-identical by upload ID.
- Trusted Mux patch: allowed only with `app.mux_system_patch` + trusted context, and only when exactly one video changes to exactly the rebuilt item (ready/errored), nothing else on the post.
- `patch_content_media_from_mux` (post branch) uses the same rebuild — webhook, reconcile and the existing linking call all apply the 60 s rule.

## Tests
- DB (`supabase/tests/post_video_phase2.sql`, made-up records, rolled back): 31/31 passed (30 in the main run, plus the corrected test of the internal update being refused for a signed-in user, re-run on its own). No test rows left.
- App suite 1067 passed, 3 skipped; typecheck clean; build OK.

## Known limitations
- Posts still fall back to stored files when Mux uploads are off; those videos are length-checked in the browser only.
- The browser-captured poster is no longer kept on a saved post while processing (the neutral tile shows); the file stays in storage for the later Mux cleanup. The approved 2026-10-14 composer gate now waits for verified Ready before new/replacement Mux videos publish; this does not change the server rules or close Phase 3 linking.
- One-save linking (Phase 3) and stable IDs (Phase 4) still open.
