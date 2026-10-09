# Media next steps (revised): delete the 8, safe edit-cleanup design, photo-only reviews proposal

## My take on the reviews

Both are right, and I've folded in every point:
- **Race condition.** My earlier idea (lock a row, re-check, delete) was not truly safe, because deleting a file can't happen inside the same database step as the check. The fix is a simple rule enforced by the database: **once a file is queued for deletion, nothing can link to it again.** With that rule in place, a final check followed by a delete is safe.
- **Video test.** No test writes to live content from my side. It becomes a short manual checklist for you, covering both the review and the timeline paths, plus cleaning up the test video afterwards.
- **Photo-only reviews.** This is proposed with exact behaviour and only built after your OK. Posts and the home page keep Mux unchanged.
- **3D.** It can be built with the switch off. Turning it on waits for the photo cleanup and the video decision.
- **Mux for reviews** becomes its own phase after 3D.

One addition of mine: the old pop-up forms also leave removed photos behind. The same server cleanup will serve them later, at no extra design cost.

## Approving this plan approves deleting exactly these 8 files (bucket `post_media`)

```text
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/0fd6a00c-1a58-4676-9608-6c03362acbeb.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/dc0c15a1-6a33-403d-a24f-f7e00e0c787f.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/3c58738b-d49b-4e39-818f-7b74cb7a1f00.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/79d638f7-c62e-4a01-a910-da7ba4df8ac3.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/993196a5-d6a4-4253-a940-ea67e7a5326d.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/af8c8aaa-e71f-4bd3-b88f-2a1d689e8118.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/47b425d6-20ae-4878-99af-d278501fe2f1.png
c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/78a542b6-4b1f-41fe-bb49-174b01a55ae8.png
```

If you'd rather approve deletion on its own, reject this and I'll split it out.

## Steps

1. **Delete the 8.**
   - Re-run the full reference check right before deleting. If any file shows a link, or the check errors, that file is skipped.
   - Delete only the 8, through the storage service.
   - Confirm the 8 are gone, the 4 saved photos still open, and no saved content changed. Record it in the audit notes.
2. **Video checklist for you** (no automated writes):
   - attach a video on the new review page and on a new timeline update;
   - save, then watch for up to 10 minutes whether each becomes playable;
   - check the old May 2025 review video still plays;
   - delete the test review or update afterwards.

   I'll then check the database and Mux records read-only and report.
3. **Revised cleanup design (written only, not built):**
   - **States:** queued, deleting, deleted, kept, failed.
   - **Rule:** a database check on every place media can be linked from rejects any save that links a file that is queued or deleting. A stale second tab re-saving a removed photo gets a clear "this photo was removed, please re-add it" message. Fresh uploads always get new file names, so normal use never hits this.
   - **Queueing:** files are queued only inside the confirmed edit itself, as part of the same database save. Nothing is queued on Cancel, a failed save, or an unclear save. One shared path serves review and timeline edits.
   - **Worker:** claims a file by moving it to *deleting* (saved first), then runs a final reference check. Still linked → *kept*. Zero → storage delete → *deleted*.
   - **Uncertain outcomes:** an error or timeout leaves the file in *deleting* and it's retried later. Deleting an already-missing file counts as success. It stays *failed* after N attempts, for admin review.
   - **Weekly sweep:** widened to every place found in the audit, and stays report-only. A dry run must show the entity-suggestion photo and the 4 saved photos kept.
4. **Photo-only proposal** (written only, built after your OK):
   - review and timeline forms reject new videos from both picking and drag-and-drop;
   - wording changes to photos only;
   - existing videos still play and stay attached when editing;
   - posts and home are untouched.
5. Stop. Report results 1–2 and the designs 3–4.

## Order after this

```text
approve 3 + 4 -> build photo-only + cleanup
3D built with switch OFF (can run in parallel)
switch ON only after: photo cleanup safe, video hidden or working, 3D checks pass
then: Mux for reviews/updates (own phase), then retire the old forms
```

## Technical details
- The guard is a `BEFORE INSERT OR UPDATE` trigger on posts, reviews, review_updates, entity_photos, entities and entity_suggestions. It extracts the bucket paths from media/url fields and raises when any matches a `media_deletion_candidates` row in `queued`/`deleting`.
- Queueing happens in `edit_latest_review_update` and the review edit path: old minus new media, normalised with the same logic as `extractMediaPath`.
- The worker is a service-role edge function. The claim is an `UPDATE … SET status='deleting' … RETURNING` with `FOR UPDATE SKIP LOCKED`.
- The video restriction would use an optional `allowVideo={false}` prop on MediaUploader, so the default behaviour is unchanged for posts.
- roadmap.md gets these tasks once out of plan mode.
