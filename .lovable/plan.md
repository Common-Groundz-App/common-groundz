# Post video Phase 4 Step 2 — final review package and safe run order

Phase 3 stays closed. True simultaneous races stay unverified. Review videos stay OFF. No Mux assets touched. Nothing below runs until you approve this plan.

## 1. Exact files for review (unchanged, read them in full)
- `docs/drafts/post-video-phase-4-migration.sql` (22 KB) — the complete migration.
- `supabase/tests/post_video_phase4.sql` (21 KB) — the 25 rolled-back checks; no table triggers disabled.
- `docs/drafts/mux-sync-post-mappings.index.ts.txt` (4 KB)
- `docs/drafts/mux-register-mappings.index.ts.txt` (4 KB)

These four files are the exact text that would run or deploy. Together they are about 51 KB, so they can't be pasted into one chat reply without being cut off. On approval, step A below prints each file in full in chat, one file per message, before anything runs. You can stop the run after any file.

## 2. Mixed-version check against the current composer (verified now)
- Edit save (`EnhancedCreatePostForm.tsx` 735-770) calls `mux-sync-post-mappings` with a slot list. It only checks `error`, logs `data`, then rereads the saved Post. If the call fails it shows "Video sync pending", and the save still stands.
- Create (905-935) calls `mux-register-mappings` only when there is at least one Mux item. It retries once on network/5xx errors and only checks `error`.
- Both drafts keep the same request shape, auth, owner check and `{ results }` response. Sync still accepts `items` but ignores it. Register still rejects empty `items`, which the composer never sends. So the old composer works with the new functions, and the new composer is not changed in this step.
- Order: migration first, then deploy the functions. During the gap, the old functions call the RPC. The migration keeps the old RPC signature, but it rebuilds links from the locked saved Post, so stale slot lists can't remove a live link. The 25-check suite covers this as the "old function during deploy" checks.
- After deployment, a real publish and an edit are checked through the app (step E).

## 3. Phase 2 suite that pauses table rules
`post_video_phase2.sql` turns triggers off on `posts` and `mux_uploads` inside its rolled-back transaction (lines 30-34, 149-157, 262-266). Even when rolled back, `ALTER TABLE` takes a full lock on live tables while it runs. It will **not** be run on production.
- Option chosen: rewrite only those three fixture blocks. The seed data would be created through the normal save path, or tested through the pure helper, the same approach as Phase 4. Every Phase 2 assertion and expected outcome stays the same. Before running it, I show you the changed blocks side by side with the originals.
- If a block can't reach the same coverage without pausing a trigger, that check is reported as **blocked**, not run.

## 4. Run sequence (after approval)
A. Print the four files in full in chat (no execution).
B. Run the migration.
C. Run the Phase 4 suite (25), the Phase 3 suite (8) and the revised Phase 2 suite (31) on production. All three are rolled back and none pauses table rules. Stop if anything fails.
D. Copy the drafts into the two Edge Functions and deploy them.
E. Smoke checks: sync and register return 200 for a real owned Post. Publish one Post with a video, then edit it to remove a photo. The saved Post rereads with the same IDs, its link row has `media_id`, and the video becomes Ready.
F. Run the app tests and typecheck. Correct the Phase 3 note about old-tab reconciliation.
G. Report passed / failed / blocked, then stop before Step 3.

## 5. Stop and roll back if
- the migration errors (it runs in one transaction, so nothing is applied);
- any check in step C fails: run the rollback SQL, functions not yet deployed;
- a step E smoke check fails: redeploy the current function code, then run the rollback SQL.

## 6. Rollback procedure
- Edge Functions: redeploy the current `supabase/functions/mux-sync-post-mappings/index.ts` and `mux-register-mappings/index.ts`, unchanged in the repo until step D.
- Database: one rollback migration restores the exact current definitions of the replaced functions (`posts_media_mux_before`, `sync_mux_post_mappings_core`, `sync_mux_post_mappings`, `reconcile_post_mux_mappings`, `patch_content_media_from_mux`). They are captured with `pg_get_functiondef` in step B, just before the migration runs. It also drops the new helper functions and the nullable `mux_upload_mappings.media_id` column. No Post media is rewritten in either direction, so removing the column loses only the new IDs on new links. Old slot-plus-upload-ID patching takes over again.
- The rollback SQL is shown to you before step B.

## Not in scope
Composer/viewer changes (Step 3), view counts, Reviews/Timeline, Stories, the cap, the profile question, reorder UI, a two-session race harness.
