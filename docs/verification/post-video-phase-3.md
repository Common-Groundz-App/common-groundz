# Post video Phase 3 — linking in one save (complete 2026-10-14)

## What shipped
- A Post create/edit/soft-delete/hard-delete updates its Mux links in the same database step. If a required link cannot be created, the whole save is refused (`post_video_already_linked_elsewhere`) and nothing changes.
- Legacy linking (`sync_mux_post_mappings`), catch-up (`reconcile_post_mux_mappings`) and the Mux patch (`patch_content_media_from_mux`) all follow the Post as currently saved; removed videos cannot be revived by late or stale requests.
- One lock order everywhere: Post row → per-Post advisory lock → mapping rows. Missing/hard-deleted Posts retire links without the advisory lock.
- The `app.mux_system_patch` exemption still stops trusted Mux patches from re-running link sync. Review/timeline mappings unchanged. Internal helpers are service-role only. Historical/grandfathered Posts untouched.

## Tests
- `supabase/tests/post_video_phase3.sql`: 8 passed, 0 failed (create conflict, edit conflict, mapping-insert conflict rollback, save→reconcile→save, hard delete→reconcile, webhook→save, removal→late webhook `noop_removed`, helper permissions).
- `supabase/tests/post_video_phase2.sql` rerun after Phase 3: 31 passed, 0 failed. Test-only update: uses links created by the save instead of inserting them, and P2 has its own uploads (`pp_new2`, `pp_b2`). No Phase 2 assertion changed.
- App: 1097 passed, 3 skipped; typecheck clean.
- Owner check: a real Post video was published smoothly after Phase 3.

## Unverified (blocked — single-connection SQL test tool; not a reason to reopen Phase 3)
- Truly simultaneous Post save vs. catch-up request.
- Truly simultaneous Post save vs. Mux webhook patch.

## Compatibility correction (2026-10-15, Phase 4 Step 2)
- The old browser mapping endpoints (`mux-sync-post-mappings` on edit, `mux-register-mappings` on create) were not actually no-op-safe after Phase 3: the old register function still attempted a direct insert into `mux_upload_mappings`, caught the resulting error, marked the item `errored`/`insert_failed`, and returned HTTP 200 — so the Post published, but the redundant post-save call silently failed against the new `media_id` requirement.
- In Phase 4 Step 2, both Edge Functions were formally updated and retired from direct table mapping inserts: they now exclusively invoke the server-authoritative `sync_mux_post_mappings` catch-up RPC derived from the locked, persisted Post.

## Known behavior (keep for now; review in Phase 4 or later)
- A Mux upload removed from one Post cannot be added to a different Post; the save is refused. Current UI is unaffected because choosing a video always creates a new upload.
