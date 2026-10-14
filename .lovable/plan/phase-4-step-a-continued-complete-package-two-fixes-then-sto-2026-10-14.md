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

## 3. Phase 2 suite: production-safe only (decision taken)
- No live-table trigger pause, and no new bypass or weakened rule to make tests runnable.
- For each of the three old-data setups, first try a safe equivalent:
  - set the data up through a normal save, or
  - check the logic through the pure helper (for example `post_mux_truth_item` or the patch-validity check on a hand-built "old" item).

  Each check is labelled either **helper coverage** or **signed-in end-to-end coverage**.
- Any check that still can't keep equivalent coverage is marked **blocked / not rerun in production**. Its earlier 31/31 pass stays in the verification record. Rerunning it is possible only in an isolated, non-production database.
- I'll list exactly which assertions each blocked block covers.

## 4. Show everything verbatim, in numbered parts, then stop
1. The complete forward migration with fixes 1–2, including the full `patch_content_media_from_mux`. Split across messages, nothing shortened.
2. The complete `post_video_phase4.sql`, word for word.
3. The complete `mux-sync-post-mappings` draft.
4. The complete `mux-register-mappings` draft.
5. The Phase 2 blocks that need old data, verbatim. Next to each: its safe replacement, or its blocked status and the assertions it covers.
6. The complete rollback script, verbatim.
7. **Actual** app test and type check results from a fresh run. These check the app code only. They don't check the draft SQL, which stays unexecuted and untested until you approve the run.

Then stop. Running anything on the database, or deploying, needs your separate approval.
