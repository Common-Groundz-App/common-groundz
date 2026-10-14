# Restore playable video arrival after saving

## Verified findings
- The reported Post (`89e2af5f-ac2e-4eef-83a5-e671a0628b06`) was saved at 08:34:16 UTC. Mux reported Ready at approximately 08:34:29; its saved media was patched to Ready at 08:34:30. It is now linked and playable. This was real processing, not a missing link.
- Phase 2 deliberately clears playable addresses and thumbnails while a Post video is processing. The former saved preview cannot be restored by trusting a client-supplied video address.
- The home feed subscribes to Post inserts, not updates. A processing item already fetched into the feed therefore does not refresh from that subscription when its saved media becomes Ready.
- The Post composer has a local video preview. New review and timeline composers currently leave after a successful save without a readiness wait. The timeline preview hook loads updates once per review-list change.

## Intended experience
Finish both uploading and Mux processing **before a newly picked video becomes playable in the composer or can be published**. Apply this to Posts and the new Review / Timeline Update pages, including replacement videos in edit mode.

Keep the selected video's still-image preview visible while it transfers and processes. Once Mux confirms a valid, playable video, show the normal playable preview and enable publishing. Save then redirects normally—no routine post-save wait and no temporary local video carried into the feed.

This is preferable to the temporary-feed-preview approach: it is simpler, lets the author preview the processed video before publishing, and avoids a local-to-Mux player handoff. The tradeoff is a longer preparation stage before publishing.

## Changes
1. Reuse the existing uploader and owner-facing Mux status hook. Separate **Uploading → Processing → Ready** explicitly. Transfer percentage reflects bytes uploaded; processing has an indeterminate finishing indicator, not an invented encoding percentage. Show completion only after authoritative readiness checks pass.
2. Keep new videos represented by a still preview during processing; do not play the original local file early. Once Ready, preview the actual Mux video using the existing shared player. Extend the status read with server-measured duration; require Ready, asset ID, playback ID, and verified permitted duration. Unknown/not-yet-returned server duration stays pending, and a new video over 60 seconds is refused even if Mux calls its asset Ready. Backend validation remains the final authority.
3. Block Post/Review/Timeline save while a **new or replacement video** is uploading, processing, unverified, or failed, with clear state-specific copy. Enforce this in submit handlers as well as button states. Photos, text-only saves, unchanged saved videos, and existing stored-file upload behavior retain their current rules. Existing broken videos do not suddenly prevent unrelated permitted edits.
4. Handle failure, long processing, offline/reconnect, cancellation, and replacement safely. Keep remove/cancel available; explain prolonged processing and allow status retry or removing the video to publish without it. Never auto-publish, pretend Ready, abandon the draft, delete a Mux asset, or resurrect a cancelled selection after a late status event. Preserve admitted uploads if the Review-video switch changes mid-session.
5. Save once and use freshly persisted media at the destination. Where Post linking patches media after the initial insert response, reread the saved Post after the existing linking step rather than seeding the feed with the stale insert result. Reviews and updates likewise refresh their destination content/cache. Do not navigate to a playable-looking item based only on local status.
6. Fix automatic transitions for processing media already visible to viewers using narrowly scoped persisted-content updates and a bounded refresh fallback. Cover home feed, Review display, and Timeline preview/viewer. Other viewers still see the neutral Processing tile until the saved content is playable; no upload-table playback overrides on viewer cards.
7. Test every affected create/edit mode: uploading/processing blocks, Ready unlocks and previews Mux, failure/removal/replacement, missing status/duration, server duration rejection, cancellation and late events, offline/retry, switch-off mid-session, mixed media, and unchanged saved-video edits. Verify immediate destination playback after a Ready save and existing player/lightbox coordination.

## Technical safeguards
- Read trusted **content-level** media: an upload can be Ready while the saved content correctly rejects its duration. Never override that rejection with `mux_uploads` playback fields.
- Timed refresh uses visibility/online-guarded `setTimeout`, cancels on unmount, and is bounded. Background read failures stay silent; existing access controls remain authoritative.
- Keep local still-preview URLs only for their composer lifetime; never persist blob URLs or insert them into feed caches. No temporary video playback registry or navigation handoff is needed.
- Refresh the relevant content/cache before navigation, including when Mux was already Ready before saving.
- No new SQL rules, mapping redesign, upload fallback, analytics changes, or Phase 3 work. Retain server-owned Mux fields, duration/ownership checks, one-hour policy, visibility rules, and current media ordering.
- Leave both excluded historical Posts untouched and unlinked. Leave old stored-file videos, legacy review popups, Mux assets, and the Review-video switch untouched.

## Verification and stop
Run targeted composer, readiness, feed-refresh, review/timeline, and player tests; check preview build diagnostics. Verify the transition using controlled Ready/Processing/Failed test responses without uploading real assets or enabling Review videos. Report what was actually verified and any live-upload checks still needed, then stop before Phase 3.