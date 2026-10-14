# Restore playable video arrival after saving

## Verified findings
- The reported Post (`89e2af5f-ac2e-4eef-83a5-e671a0628b06`) was saved at 08:34:16 UTC. Mux reported Ready at approximately 08:34:29; its saved media was patched to Ready at 08:34:30. It is now linked and playable. This was real processing, not a missing link.
- Phase 2 deliberately clears playable addresses and thumbnails while a Post video is processing. The former saved preview cannot be restored by trusting a client-supplied video address.
- The home feed subscribes to Post inserts, not updates. A processing item already fetched into the feed therefore does not refresh from that subscription when its saved media becomes Ready.
- The Post composer has a local video preview. New review and timeline composers currently leave after a successful save without a readiness wait. The timeline preview hook loads updates once per review-list change.

## Intended experience
Keep the upload and preview experience intact. When Save succeeds but a **newly added Mux video** is still processing, briefly keep the composer visible with a finishing indicator. Open the feed, review, or timeline destination as soon as the **saved content** is confirmed playable, using the existing autoplay and one-player-at-a-time behavior.

Immediate Mux playback cannot be promised before Mux finishes. This changes the short post-save transition, not the upload flow or the server protections.

## Changes
1. Add a shared, bounded post-save readiness check for newly added/replacement Mux videos in Posts, new-page Reviews, and Timeline Updates, including their edit saves. Photos, text-only saves, and unchanged saved videos leave exactly as before.
2. Save only once. Preserve the local preview during the brief wait, prevent duplicate submission, and distinguish “saved, finishing video” from an unsuccessful save. Confirm readiness by rereading the persisted content through its normal access rules—not by merging raw upload playback data into a viewer.
3. Wait up to 30 seconds. Ready opens the destination with fresh saved media. Failure exits the wait and uses the existing unavailable tile and owner guidance. A timeout, offline state, or prolonged processing offers “View now” and never traps the user or resubmits the content. Processing remains honestly labelled if the user continues early.
4. Ensure processing media already visible in the destination refreshes automatically from persisted content. Use narrowly scoped content updates plus a bounded fallback where needed; cover the home feed, review display, and timeline preview/viewer. Do not create upload-table subscriptions on viewer cards.
5. Add targeted tests for processing-to-ready, already-ready, failed, duration-rejected, timeout, offline/reconnect, leaving during the wait, duplicate-submit protection, and mixed photo/video saves. Verify fresh destination playback and existing player coordination.

## Technical safeguards
- Read trusted **content-level** media: an upload can be Ready while the saved content correctly rejects its duration. Never override that rejection with `mux_uploads` playback fields.
- Timed refresh uses visibility/online-guarded `setTimeout`, cancels on unmount, and is bounded. Background read failures stay silent; existing access controls remain authoritative.
- Keep local preview URLs alive only until navigation/unmount; never persist them or insert them into feed caches.
- Refresh the relevant content/cache before navigation, including when Mux was already Ready before saving.
- No new SQL rules, mapping redesign, upload fallback, analytics changes, or Phase 3 work. Retain server-owned Mux fields, duration/ownership checks, one-hour policy, visibility rules, and current media ordering.
- Leave both excluded historical Posts untouched and unlinked. Leave old stored-file videos, legacy review popups, Mux assets, and the Review-video switch untouched.

## Verification and stop
Run targeted composer, readiness, feed-refresh, review/timeline, and player tests; check preview build diagnostics. Verify the transition using controlled Ready/Processing/Failed test responses without uploading real assets or enabling Review videos. Report what was actually verified and any live-upload checks still needed, then stop before Phase 3.