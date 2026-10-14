# Phase 2 check, then Phase 3: post video linking in one save

## Phase 2 check
The server rules are live and match the plan. Checked read-only:
- The post rules trigger is in place.
- The 60-second "new uploads only" flag and its guard are in place.
- Video state is rebuilt on the server on every save.
- The trusted Mux patch only accepts the expected change.
- The two old stuck posts are untouched.

One leftover: after the database test was fixed, the full 31-test run was never repeated in one go. The earlier "31/31" combined two separate runs. Step 0 reruns it properly. Phase 2 counts as complete only if that run passes. If a correct test exposes a real bug, I fix the rules themselves, not the test, and rerun everything.

## Phase 3: what changes
Today, after you press Post (or save an edit), the app saves the post and then makes a second, separate request to "link" the video. If that request fails, the video can stay on "processing" on a saved post. The two old stuck posts may have a different cause (their videos may have been deleted), so I'm not claiming this explains them.

After Phase 3, linking happens inside the same save, the way review videos already work. Either both succeed or neither does.

- /create looks and behaves the same: upload, processing, Ready, the Post button, X, and the preview that keeps playing.
- No more "Video sync pending" message.
- Old posts, old stored-file videos and the two known stuck posts are never repaired or relinked.
- Review videos stay OFF.

## Safeguards (from review)
- **Deleting posts:** posts are deleted by setting `is_deleted` (confirmed), and can also be hard-deleted. The new step runs when `media` or `is_deleted` changes, and on hard delete. A delete always retires the post's active video links, even if media didn't change.
- **No loops:** I checked: today's linking function can rewrite the post's media while catching up, and that would fire the new step again. The save path only updates link records and never rewrites the post, so there's nothing to loop on. A ready video's link is marked done directly, because the save already rebuilt trusted video state. I'm not using a blanket "skip when nested" rule, since that could leave a legitimate save unlinked. Tested, including saves made from inside other database steps.
- **Old browser tabs:** the two old linking requests stay for one release, but they ignore the list the browser sends. The database locks the post, reads it as saved right now (including whether it's deleted), and reconciles in that same step. A stale request can never bring back a removed video, retire its replacement or relink a deleted post, even when it races a save.
- **Internal helper is server-only:** signed-in and anonymous users can't call the new low-level linking helper. Only the save step and the checked server functions use it. Tested.
- **Only saved content can bring a link back:** a link is restored only when the successfully saved post contains that video. Late Mux messages and stale requests never restore removed media.
- **Old videos stay protected:** editing an old post saves normally, for example removing a photo next to a historical video that has no link record. The edit doesn't repair, relink or change that video.
- **A save that worked never looks failed:** the linking retries and messages go away, but the saved-post recovery stays. If the read-back after saving fails, the saved post is kept and never posted twice.

## Steps
0. Rerun the full Phase 2 database tests in one run (made-up records, rolled back). Report passed, failed and blocked.
1. Add the "link after save" step and the locked reconcile function, following the safeguards above.
2. Remove the two follow-up requests from the post composer (create and edit). Keep the read-back and the saved-post recovery.
3. Point the two old linking functions at the locked reconcile function, so they follow the saved post instead of the browser's list.
4. Tests:
   - Create: with a video, with a video plus photos, photos only.
   - A failed save leaves no link behind.
   - Edits: caption-only, remove the video, replace it, re-add it.
   - Soft delete and hard delete.
   - A late Mux message after removal or deletion.
   - A stale old-tab request, including against a deleted post.
   - No loop.
   - Saves made from inside other database steps still link.
   - Signed-in users can't call the internal helper.
   - Old-video edit protection.
   - The two historical posts unchanged.
   - Then the app's full test suite and type check. Report passed, failed and blocked.
5. Stop before Phase 4. After that, one controlled real test once you authorize it: upload → Ready → publish → plays in the feed right away, then remove or replace, then delete.

## Technical details
- New trigger `zz_posts_media_mux_after`:
  - `AFTER INSERT OR UPDATE OF media, is_deleted OR DELETE ON posts`. The trigger function is `SECURITY DEFINER` with `SET search_path=public`.
  - No depth guard. Recursion can't happen because the trigger path (`p_patch=false`) never writes `posts`.
  - Delete, or `is_deleted` going true: active mappings become `removed` with `last_error='content_deleted'`. This branch runs before the "media unchanged" shortcut.
  - Otherwise: skip if media is unchanged, or if there's no Mux video before or after. Build `{mux_upload_id, media_index}` from `NEW.media` and call the core.
- `sync_mux_post_mappings` is refactored into the core `sync_mux_post_mappings_core(p_content_id, items, p_patch boolean)` plus a wrapper:
  - Steps (a)–(e) stay unchanged. Step (f), the catch-up patch, runs only when `p_patch` is true.
  - The trigger passes `false`. It sets `status='patched', patched_at=now()` for mappings whose item in `NEW.media` already has `mux_status` ready or errored, matched by upload id.
  - Pending mappings stay `pending` for the webhook. Its patch rewrites media once, and the resulting trigger pass is a mapping-only no-op.
- The core is server-only: `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. Only the owner, service_role and definer callers can run it.
- New `reconcile_post_mux_mappings(p_post_id)`, service_role only:
  - Takes the advisory lock, then `SELECT ... FOR UPDATE` on the post.
  - If the post is missing or `is_deleted`, it retires the mappings and never reactivates them.
  - Otherwise it derives items from the locked `media` and calls the core.
- Compatibility edge functions `mux-register-mappings` and `mux-sync-post-mappings`: keep their ownership check, ignore `body.items`, and call `reconcile_post_mux_mappings`.
- Grandfathered items (no upload row, or no mapping and not changed) are skipped when building items, so the existing before-trigger byte-identical rule stays intact.
- Client (`EnhancedCreatePostForm`): delete both `functions.invoke` blocks and their retries and toasts. Keep `savedPostIdRef` and `refreshSavedPostMedia` with their non-failure fallback.
- Tests: `supabase/tests/post_video_phase3.sql` (fixtures only, rolled back), a client test that save never invokes either function, then the full suite and typecheck.
- `AGENTS.md`: replace the post-linking rule with "post Mux mappings are synced by a DB trigger in the same save; compatibility endpoints reconcile against the locked persisted post".
- Roadmap: tick Phase 3 and add a later item to remove the old functions.
