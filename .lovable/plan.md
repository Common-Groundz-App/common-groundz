# Phase 2 check, then Phase 3: post video linking in one save

## Phase 2 check
The server rules are live and match the plan. Everything below was checked read-only:
- The post rules trigger is in place.
- The 60-second "new uploads only" flag and its guard are in place.
- Video state is rebuilt on the server on every save.
- The trusted Mux patch only accepts the expected change.
- The two old stuck posts were left untouched, as you decided.

One leftover: after the database test was fixed, the full 31-test run was never repeated in one go. The earlier "31/31" combined two separate runs. Step 0 below reruns it properly before anything new is built. Phase 2 is marked complete only if that run passes.

## Phase 3: what changes
Today, after you press Post (or save an edit), the app saves the post and then makes a second, separate request to "link" the video. If that second request fails, the post is saved but the video stays stuck on "processing" forever. That's how the two old stuck posts happened.

After Phase 3, linking happens inside the same save, the way review videos already work. Either both succeed or neither does.

- /create looks and behaves the same: upload, processing, Ready, the Post button, X, and the preview that keeps playing.
- No more "Video sync pending" message, because there's no second step left to fail.
- Old posts, old stored-file videos and the two known stuck posts are left alone.
- Review videos stay OFF.

## Covered cases (all tested)
- New post with a ready video, with a video plus photos, and with photos only (no link created).
- A failed save leaves no link behind.
- Editing a post:
  - Caption-only edit: the link is unchanged.
  - Removing the video retires its link.
  - Replacing it retires the old link and adds the new one.
  - Re-adding a previously removed video brings its link back.
- Deleting a post retires its links.
- A duplicate or late message from Mux after removal or deletion changes nothing.
- The old linking requests (from a browser tab that hasn't reloaded yet) still work and do no harm for one release.

## Steps
0. Rerun the full Phase 2 database tests in one run (made-up records, rolled back). Fix only the tests if needed, and report.
1. Add a "link after save" step to posts that reuses the existing linking logic. The browser no longer sends the list of what to link; the server reads it from the saved post itself.
2. Remove the two follow-up requests from the post composer (create and edit). Keep the existing read-back of the saved post, so the feed shows the trusted version.
3. Leave the two old linking functions in place but make them harmless: they confirm what the save already did and never change anything differently. They get removed in a later release.
4. Run the database tests for every case above, plus the app's full test suite and type check. Then stop before Phase 4.

## Technical details
- New `AFTER INSERT OR UPDATE OF media OR DELETE` trigger `zz_posts_media_mux_after` on `posts` (`SECURITY DEFINER`, `search_path=public`).
  - It mirrors `review_media_mux_after`: it skips when media is unchanged or no video is involved before or after.
  - Otherwise it builds items `{mux_upload_id, media_index}` from `NEW.media` (provider `mux`, non-empty upload id) and calls `sync_mux_post_mappings(NEW.id, items)` (advisory lock plus park/reactivate already in place).
  - On delete, and on soft delete if posts use `is_deleted`/`deleted_at` (confirm in step 1), it sets active mappings to `removed`, with `last_error='content_deleted'`.
  - It runs after `zz_posts_media_mux_before`, so it sees trusted media only.
- Ownership: `sync_mux_post_mappings` inserts `user_id`. Confirm it uses the post author, which the before-trigger has already validated as the uploader.
- Excluded rows: the trigger only fires on writes, so the two historical posts are never touched unless their media is edited. Their checksums are re-checked after the migration.
- `mux-register-mappings` / `mux-sync-post-mappings`: kept as no-op-safe. Same RPC, same result, and idempotent against trigger-created rows. Removal goes on the roadmap.
- Client (`EnhancedCreatePostForm`): delete both `functions.invoke` blocks and their retry and toast code. `refreshSavedPostMedia` readback stays.
- Tests: `supabase/tests/post_video_phase3.sql` (rolled back, fixtures only), plus a client test that save no longer invokes either function. Then the full suite and typecheck.
- `AGENTS.md`: replace the post-linking rule with "post Mux mappings are synced by a DB trigger in the same save". The roadmap gets Phase 3 ticked and a later item for removing the old functions.
