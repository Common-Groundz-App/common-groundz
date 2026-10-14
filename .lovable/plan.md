# Phase 4 Step A (continued): complete package, two fixes, then stop

Nothing runs or deploys in this step. No migration, no Edge Function deployment, no database tests. Review videos stay OFF.

## 1. Fixes to the drafts (draft files only)
1. **Old duplicates keep their count (`post_media_assign_ids`).**
   - Today's draft checks only that each item appears somewhere in the saved list. So saved [A, B] sharing one ID could become [A, A] and still pass. Confirmed by reading the draft.
   - New rule: for every ID used more than once, the new items with that ID (ignoring `order`) must fit inside the saved items with that ID, counting copies. Removing a copy is allowed. Repeating one copy, or adding one, is refused.
2. **Marking a link done right after a save (`sync_mux_post_mappings_core`, the `p_patch = false` branch).**
   - Why it is already safe: the same save, under the same locks, has just rewritten every link's `media_index` from the saved Post. So the slot read cannot be stale.
   - The fix anyway: a link that has `media_id` is only marked done when the item at that slot also has a matching ID (`lower(id) = media_id`) and the same upload ID. Links with a blank `media_id` keep today's check. This keeps the "position is only a hint" rule true everywhere, not just in the Mux update path.
3. **Clarify T23.** Rename it and limit it to links created or reactivated in this test run. They must carry `media_id`. Old links with a blank `media_id` stay supported and are never expected to gain one.

## 2. New tests in `post_video_phase4.sql`
- **T26** Saved [A, B] sharing one ID, resent as [A, A]: refused with `post_media_duplicate_id`.
- **T27** Saved [A, B] sharing one ID, resent as [A] (a copy removed): accepted and unchanged.
- **T28** Right after a save, a link whose `media_id` doesn't match its slot item is not marked done.
- **T29** A removed link that comes back on the same Post gains the current `media_id`.

## 3. Show everything verbatim, in numbered parts, then stop
1. The complete forward migration with fixes 1–2, including the full `patch_content_media_from_mux`. Split across messages, nothing shortened.
2. The complete `post_video_phase4.sql`, word for word.
3. The complete `mux-sync-post-mappings` draft.
4. The complete `mux-register-mappings` draft.
5. The Phase 2 fixture blocks that turn table triggers off, shown exactly as they are today. These can't be rewritten without that pause: the database won't let us set `session_replication_role` here. So this part waits on your choice of the three options from my last message.
6. The complete rollback script, built from the captured live definitions and grants, verbatim. It already covers the new trigger and the three helpers. No other trigger changes.
7. App tests and type check rerun after the edits. These touch draft SQL only, so the result is expected to be unchanged: 1097 passed, 3 skipped, type check clean.

Then stop and wait for your approval of the actual run.
