# Phase 4 Step 2 — fix the T11b test and diagnose the missing-link result (no deploy)

The migration stays live. Nothing is undone, deployed or smoke-tested in this step. Step 3 is not started.

## 1. T11b fixture only
- In `supabase/tests/post_video_phase2_prodsafe.sql`, give the two fixture videos in T11b different valid UUID media IDs.
- The assertion stays the same: the save must be refused with `post_video_too_many`.
- No production rule is changed, weakened or reordered.

## 2. Diagnose the missing-link discrepancy (read-only first)
The cause has not been confirmed yet. Diagnosis comes before any fix.
- Rerun the full suite with diagnostic `RAISE NOTICE` lines at the failing step only. These lines are test-only. They log the fixture Post's persisted media (ids, `mux_upload_id`) and every `mux_upload_mappings` row for that upload (post_id, media_id, media_index, status).
- Compare that output with the isolated reproduction that found the mapping.
- Test these candidate causes in order:
  1. **Earlier steps in the same `DO` block change the state.** For example, an earlier step reuses or removes the same upload ID, and the Phase 3 rule "a removed upload can't move to another Post" correctly stops the later link.
  2. **The earlier T11b duplicate-ID refusal leaves a different state.** A refusal caught inside a sub-block can leave the next step running against different fixtures than the isolated run.
  3. **The test looks the mapping up with the wrong key.** It may look up by slot where a `media_id` is now stored, or the reverse.
  4. **A real product defect.** This is accepted only if a minimal repro, using normal save paths and fresh fixtures, fails without depending on earlier test steps.
- If cause 1, 2 or 3 is confirmed, the fix is a test-only fixture or lookup change, and I will explain it.
- If cause 4 is confirmed, I stop. I report the defect with evidence and a proposed fix, and make no production change without your approval.

## 3. Rerun and report
- Rerun the complete production-safe Phase 2 suite in one rolled-back run.
- Report every check as PASS, FAIL or BLOCKED. Only the already-agreed historical checks should be BLOCKED.
- Confirm no test rows are left behind.
- Report the exact cause of the missing-link discrepancy, with the logged evidence.

## 4. Old register function: confirm the impact (read-only)
- Read the live `mux-register-mappings` code and its recent logs.
- Check the mapping rows for recent Posts.
- Confirm three things:
  - the failure is only its redundant insert after the save;
  - the save trigger has already created the authoritative mapping, with `media_id`;
  - the composer doesn't block or roll back the published Post because of that failure.
- Report any evidence that contradicts this.

## Stop gate
I stop after the report. Deploying the Edge Functions, the smoke test, app tests, typecheck and Step 3 each wait for your go-ahead.
