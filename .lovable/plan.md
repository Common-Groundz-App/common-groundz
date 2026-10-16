# Post video — two manual-QA refinements (lightbox return + post-edit feed player)

Scope: Posts only. No changes to Reviews/Timeline, composer upload, database, Edge Functions, analytics, Mux assets, the two-source loading budget, autoplay selection or mute behavior. Confirm each actual cause before changing code. Phase 4 is not closed until both manual cases pass.

## Must not change (existing continuity)
- Feed → lightbox: same timestamp, play/pause state and mute.
- Lightbox → feed on close: the same Post video resumes at the lightbox position, playing if it was playing, paused if paused, with the current shared mute/unmute. The rule that resume applies only when closing on the item opened from the feed stays as is; the only difference is that the handed-back position can now come from after a return visit.
- One video at a time, muted-autoplay fallback, hard two-source budget.

## Issue 1 — Lightbox: video → photo → back restarts paused at 0:00
1. Confirm the cause (likely: the departing video is unmounted, and the return is treated as a non-entry item, so neither seek nor resume runs).
2. Per-lightbox-session memory, keyed **only by stable Post media key**: currentTime + playing/paused. No position fallback for Post media; legacy non-Post callers keep today's numeric path completely untouched (new behavior enabled only when a media key is supplied).
3. Seed the entry video's state from the feed→lightbox handoff, so entry and later navigation use one state model.
4. Snapshot state **before** navigation pauses/unmounts the departing video; cancel its pending seek/play callbacks (generation token) so they can't affect the new item.
5. On return: reuse the existing seekable-aware one-time seek; play only if it was playing when left; stay paused if paused; existing mute and muted-fallback unchanged; no new unmute path.
6. Exit handoff to the feed reads from this same map, so continuity is preserved. Map cleared on close.

## Issue 2 — After removing the photo in an edit, feed video stuck paused and Play does nothing
1. Confirm the cause (suspected: when the layout changes from collage to single video, cleanup from the old player unregisters/releases the slot after the new player registered under the same stable slot ID).
2. Instance-owned registration: each mounted player gets a registration token/generation. Unregister, loading-reservation release, pin release and pending-Play clearing only act if the token matches, so an old player can never remove its replacement.
3. Old generation fully invalidated: element refs, HLS/source callbacks, prewarm, pending Play request; late callbacks ignored.
4. Same media identity kept: the new player registers under the same stable slot, so saved position and explicit user-paused intent survive (no reset to 0:00, no override of a deliberate pause); global mute/session sound untouched.
5. Manual Play goes through the normal manager + loading-budget path.
6. Verify the same transition on Home, Post Detail and Profile feeds.

## Additional safeguards
- Rapid arrow navigation (video → photo → video quickly) applies only the latest seek/play; no double play, no audio from two players.
- Closing the lightbox while a return seek is pending still hands back the correct, latest position.
- Removed media while lightbox open keeps today's close-immediately rule.

## Tests
- Rendered lightbox: return resumes at remembered time/state; paused stays paused; mute preserved; stale callbacks after fast navigation ignored; non-Post callers unchanged.
- Rendered lightbox → feed exit after a return visit: correct position, play/pause, mute.
- Rendered feed: photo+video → video-only remount; old cleanup cannot unregister new player; new player gets reservation, autoplays per rules, Play works; position and pause intent preserved; two-source cap holds.
- Existing handoff, budget, selection, Review/Timeline tests unchanged.
- Full Vitest suite + typecheck, then report and stop for desktop/iPhone/Android manual QA.

## Technical notes
- Likely files: `LightboxPreview.tsx`, `FeedVideo.tsx`, `useFeedVideoManager.tsx`, `feedVideoLoadBudget.ts`, `FeedCollage.tsx`.
- Reuse `lightboxHandoffSeek.ts`, `mediaIdentity.ts`, and the existing resume/pause stores.
