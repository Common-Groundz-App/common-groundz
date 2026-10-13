# Phase 4 — Block 2, steps 0–3 results and next steps

## Run record
| Kind | ID | Mux upload | Mux asset | Playback | State |
|---|---|---|---|---|---|
| Review (CHANEL, public) | 0cc9ed7c-8415-4b2c-9fa0-b8f0c7d5ee2d | iHLxrq1e3xp00OcusTaRMoJBulAZ73VyIykqCQ0101He8g | UkBVjFzhnVXgN3m7o00ttxXPUgUUdAt01wYG3iWVKt0284 | b3yGQRsjqlfV7c02Eq2xLCH5jNCZFPw00IRyD6KkyHctM | ready, linked |

Review videos switched ON at 10:55:51 UTC (your 4:25 IST). Review created 10:57:39 UTC — its own hour ends **11:57:39 UTC (17:27 IST)**; steps 5–8 must finish before then.

## Results
| Step | Result | Evidence |
|---|---|---|
| 0 Switch ON | pass | setting ON at 10:55:51 UTC |
| 1 Public + ok-8s.mp4, progress tile | pass | your report; one upload row |
| 2 Save blocked during transfer | pass (partial) | Next was blocked while uploading. The "Wait for your video to finish uploading" message itself was not reported — recorded as untested |
| 3 Save while Processing | **untested** | Mux finished in 6 s (ready 10:57:35) before you saved (10:57:39), so the save happened with the video already Ready. Re-tried in step 9 |
| 3 Ready plays without reload | pass | your report |

## Database check after step 1 — pass, one item to explain
- One active link for the video (status patched, media slot 0, owner Hana). pass
- Mux status, playback, asset and length (8.07 s) set by the server. pass
- Cover = the video's Mux poster, matches the rule. pass
- Visibility public. pass
- To explain: the review's edit time moved 7 s after creation (10:57:39 → 10:57:46). No Mux change came after the save (video was already Ready), so this is not a Mux update. Likely a second save from the app right after publish (e.g. recommendation recompute). I'll confirm read-only before step 8's check; recorded as "under review", not a fail yet.

## Next — steps 4 to 8 (before 17:27 IST)
4. Open the review → Edit → privacy step. Expected: Only me / Circle greyed out with "This review has a video, so it must stay public…". Leave it Public and close without saving. **Tell me, then I check the database.**
5. Edit → add one photo after the video → Save. Expected: order video then photo; cover stays the video's poster.
6. Edit → drag the photo first → Save. Expected: cover becomes the photo.
7. Edit → pick ok-8s.mp4 again — it should be refused or the video slot unavailable (only 1 video allowed). If it's allowed because no other video... note what happens. Then: remove the existing video, pick ok-8s.mp4, and **cancel it while it is still uploading** → the slot frees and you can pick again. Cancel again and close without saving → the saved video must still be there.
8. Edit → remove the video → Save. Then Edit → add ok-8s.mp4 → Save (replace within the hour). **Tell me, then I check the database.**

Report each with pass / fail and anything odd.

## Technical details
- Queries: `reviews` + `mux_upload_mappings` (to_jsonb) for CHANEL; `mux_uploads` created after the snapshot; `app_config` flag.
- `mux_upload_mappings` has no `unlinked_at`; "removed" is read from its `status` column — checklist SQL to be corrected accordingly.
- Edit-time check: compare `reviews.updated_at` with recommendation recompute / timeline triggers before step 8.
