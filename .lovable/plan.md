# Media next steps: delete the 8, design the edit cleanup, settle review videos (3D separate)

## My take on the two reviews

Both are right, and they agree on almost everything. Where they differ:
- **Does the edit-removal gap block 3D?** Codex's view is best: 3D can be *built* with the switch off, while *turning the switch on* waits for the media checks. Nothing is lost by building in parallel.
- **Race condition (Codex).** "Check references, then delete" alone isn't safe, because another save could attach the same file between the check and the delete. The cleanup design must close that gap, not just retry.

## What I found about videos

- The review and timeline forms use the same uploader as posts, so **people can pick a video in reviews today**. This is true for the old pop-up and the new pages alike, and the uploader even says "Add photos or a short video".
- With Mux switched on, the video goes to Mux. But the step that connects a finished Mux video back to its content only knows about posts. So a review video may stay stuck on "preparing" and never play. This is my reading of the code; I haven't tested it yet.
- One old review from May 2025 has a video stored directly in storage, from before Mux. It still plays as a normal file.

## Mux for reviews: now or after 3D?

**My recommendation: after 3D, as its own phase, with a small safety step now.**
- Adding reviews and updates to Mux is real work:
  - registering review videos with Mux;
  - matching finished videos back to the right review or update;
  - playback on review cards and the timeline;
  - deleting the hosted video together with its preview;
  - the 1-hour edit rules;
  - tests.

  Bundling all that into 3D would make 3D riskier and slower.
- What must not happen is 3D making the new page the default while videos can be picked but may never play. So before the switch is turned on, review and timeline forms either get working video or hide the video option.

## Steps in this approval

1. **Delete the 8 orphan photos** (exact list in the audit notes):
   - re-check every reference first;
   - delete only those 8 through the storage service;
   - confirm the 8 are gone, the 4 saved photos still open, and no saved content changed.
2. **Test review video today** on a test account with the switch off. Attach a video to a timeline update on the new page, save, and watch whether it ever becomes playable. Report the result. Nothing is changed.
3. **Write the design** (no build) for cleaning up saved photos removed during Edit. It covers:
   - candidates only after a confirmed edit, one shared path for review and timeline edits;
   - a reference check across every place found in the audit, using one standard form of the file's address;
   - **race protection:** the server re-checks and deletes in one guarded step after a short grace period, and a file attached again in the meantime is skipped;
   - files linked from more than one place;
   - unclear saves, and retries that are safe to repeat;
   - a widened weekly cleanup that stays report-only, plus a dry run proving known saved files (including the entity-suggestion photo) are kept.
4. **Propose the video decision** based on step 2:
   - (a) hide video in review and timeline forms until a later "Mux for reviews" phase; or
   - (b) build Mux for reviews now.

   I'll recommend (a) unless the test shows it already works. Nothing is hidden or changed without your approval.
5. Stop. 3D can then start, built with the switch off. Turning it on waits for the photo fix and the video decision.

## Technical details
- `uploadMedia` sends videos through `uploadVideoViaMux` when the Mux upload switch is on, otherwise to `post_media`.
- `mux-register-mappings` rejects any content type other than `post`, so there's no Mux mapping for reviews or review updates.
- Concurrency idea for the design: a `media_deletion_candidates` table (path, source, enqueued_at, attempts, status). A service-role job claims each candidate with a row lock, re-runs the full reference query inside the same transaction, deletes through the storage API, and marks the outcome. Any new save of a candidate path cancels the candidate (save RPC hook or trigger).
- Step 2 needs a signed-in test session. If automatic sign-in isn't available, it becomes a short checklist for you to run.
