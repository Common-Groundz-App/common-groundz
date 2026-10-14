# Post video Phase 4 Step 2: review package, rollback, then a separate go-ahead

Phase 3 stays closed, and the true simultaneous races stay unverified. Review videos stay OFF and no Mux assets are touched. This plan covers **review preparation only (Step A)**. Every later step needs a separate written go-ahead from you.

## Step A: review only, then a hard stop
Nothing in Step A changes the database, deploys anything or touches any Post.
1. Print each file in full, one per chat message:
   - `docs/drafts/post-video-phase-4-migration.sql`
   - `supabase/tests/post_video_phase4.sql` (25 rolled-back checks, no triggers turned off)
   - `docs/drafts/mux-sync-post-mappings.index.ts.txt`
   - `docs/drafts/mux-register-mappings.index.ts.txt`
2. Revised Phase 2 fixtures. The three blocks in `post_video_phase2.sql` that turn table triggers off (lines 30-34, 149-157, 262-266) are rewritten to seed data through the normal save path or the pure helper. Old and new are shown side by side. All 31 assertions and their expected outcomes stay the same. A check that can't keep the same coverage without pausing a trigger is marked **blocked** and not run.
3. Rollback package, captured and written before any migration:
   - Read-only capture of the live definitions (`pg_get_functiondef`, the trigger definitions, and function grants from `pg_proc.proacl`) for every object the migration replaces.
   - A complete executable rollback migration, shown in full.
4. Run the app tests and typecheck now, before any deployment, on the current code.
5. **Stop.** Report the results and wait for your approval of the forward migration, the rollback migration and the revised Phase 2 fixtures.

## Full changed-object manifest (rollback must cover all of it)
- **Replaced. The live definition and grants are restored:**
  - `posts_media_mux_before()`
  - `post_mux_link_items(uuid, jsonb)`
  - `sync_mux_post_mappings_core(uuid, jsonb, boolean)`
  - `sync_mux_post_mappings(uuid, jsonb)`
  - `patch_content_media_from_mux(uuid)`
  - `reconcile_post_mux_mappings`, if the final draft touches it. Step A confirms this against the file.
- **New. Dropped by rollback:**
  - helpers `post_media_storage_key(text)`, `post_media_identity(jsonb)`, `post_media_assign_ids(jsonb, jsonb)`
  - function `mux_mapping_require_media_id()`
  - trigger `mux_mapping_require_media_id` on `mux_upload_mappings`
- **New column:** `mux_upload_mappings.media_id`.
- **Rollback order, with no CASCADE:**
  1. Restore the replaced functions, so nothing still references the helpers or `media_id`.
  2. Drop the new trigger, then its function.
  3. Drop the three helpers.
  4. Drop `media_id`.
  5. Reapply the captured grants and revokes exactly.
  6. Check, read-only, that the restored definitions match the captured text.
- Post media is not rewritten in either direction. Dropping `media_id` loses only the IDs on links created after the migration. Those links fall back to the old slot-plus-upload-ID patching.
- **Edge Function rollback:** redeploy the current repo versions of both functions. Those files stay unchanged until deployment.

## After your separate go-ahead (shown now for review, not approved)
- **B.** Run the migration. It runs in a single transaction, so any error means nothing is applied.
- **C.** Run Phase 4 (25), Phase 3 (8) and the revised Phase 2 (31) suites. All are rolled back, and none turns off table triggers. On any failure, stop and run the rollback migration. Functions are not deployed yet.
- **D.** Deploy the two Edge Functions. The old composer stays compatible: it uses the same request shape and `{ results }` response, checks errors only, and the sync function now ignores slot lists. This was verified against `EnhancedCreatePostForm.tsx` 735-770 and 905-935.
- **E. User-run smoke test.** You publish a designated test Post with one video and at least one photo, then edit it to remove the photo. I only verify, read-only:
  - the IDs are unchanged;
  - the link row has the matching `media_id`;
  - the video reaches Ready;
  - nothing else changed.

  I do no sign-in as any account, no uploads and no edits. If this fails, redeploy the old functions, then run the rollback.
- **F.** Rerun the app tests and typecheck, and correct the Phase 3 note about old-tab reconciliation.
- **G.** Report passed / failed / blocked, then stop before Step 3.

## Added safeguards
- **Pre-migration snapshot (read-only):**
  - row counts and a media checksum per Post;
  - mapping counts with `media_id` null and not null.

  These are compared after Step C, which should show no change, and after Step E, where only the test Post may change.
- The two named historical Posts get their checksums rechecked unchanged after B and after E.
- The test Post is left for you to delete when you're done. I never delete Posts myself.

## Not in scope
Composer and viewer changes (Step 3), view counts, Reviews and Timeline, Stories, the cap, the profile question, reorder UI, and a two-session race harness.
