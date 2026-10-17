# Post video Phase 4 — stable Post media IDs (complete 2026-10-16)

## What shipped

### Step 1 — read-only audit
- Catalogued how Post media IDs were created (composer `crypto.randomUUID()`), where removal/readback used ID vs position, feed/lightbox/collage keying, video view-tracking columns, every consumer of `mux_upload_mappings.media_index`, and data checks on all saved Posts (duplicate IDs, non-UUID IDs, duplicate storage objects, signed URLs, unresolvable objects, misaligned Mux link slots, deleted-flag items). View tracking was already keyed by storage path/playback ID — not array index — so Step 4 was dropped.

### Step 2 — database rules & Edge Functions
- `post_media_assign_ids` migration: server owns the ID rule on every Post save. Existing items matched by `mux_upload_id` (videos) or canonical storage object (photos/old videos). Valid client IDs on new items kept; forged/changed IDs on existing items restored; duplicate IDs refused; ambiguous historical data grandfathered byte-identical.
- `mux_upload_mappings.media_id` column (nullable): new links record `media_id`; webhook/catch-up/legacy patch checks `media_id` when present; old NULL links keep prior slot rule. No backfill.
- `mux-register-mappings` and `mux-sync-post-mappings` Edge Functions updated to exclusively invoke server-authoritative `sync_mux_post_mappings` catch-up RPC (no direct table inserts).
- Phase 3 lock order, atomic rollback, `app.mux_system_patch` exemption and "removed upload can't move to another Post" rule preserved exactly.
- `supabase/tests/post_video_phase4.sql` database suite passed.

### Step 3 — stable-identity app/UI work
- `mediaIdentity.ts`: `mediaKey()`, `findByMediaKey()`, `ensureClientKey()`, `reconcileComposerMedia()`.
- Composer uses `clientKey` (immutable local render identity) for list keys, X-button, and preview registry; `id` (server-authoritative) adopted after save/readback without remounting tiles, revoking blob previews, or resetting playback.
- Lightbox entry, exit handoff and resume keyed by stable media ID. Legacy numeric callers unchanged.
- Missing/absent IDs stay absent — no positional fallback.

### Fix 1 — shared Post display ordering & canonical Mux URL
- `postDisplayMedia.ts`: video-first display order helper consumed by both feed card (`PostMediaDisplay`) and lightbox. Persisted DB order untouched.
- `lightboxHandoffSeek.ts`: `resolveVideoSrc()` — one canonical Mux playback URL path for feed, prewarm and lightbox. Removed forced `min_resolution=720p` from lightbox. Old `getLightboxPlaybackOpts()` deleted.
- Seekability-aware one-time seek: keeps one pending target, rechecks seekable ranges on readiness events, executes the actual `currentTime` assignment once when target becomes seekable. 2.5-second escape hatch reveals controls without forcing playback or overwriting `wasPlaying`/mute.
- User intent inferred from trusted pointer/keyboard interaction correlated with actual play/pause/seek — not from generic poster/container taps or programmatic media events. Explicit user actions cancel pending automatic handoff.
- `completeHandoff()` preserves existing global mute state and muted-autoplay fallback; no new unmute path.

### Fix 2 — viewport-aware HLS loading coordinator
- `feedVideoLoadBudget.ts`: hard two-source managed-feed budget. Active video always attached; at most one nearest upcoming preload candidate. Far-offscreen players actually stop HLS manifest/segment traffic after real teardown (not just pause).
- Attachment cycle uses generation tokens; stale HLS/native/prewarm/seek/play callbacks cannot affect a demoted or removed player.
- State (currentTime, user-paused intent) snapshotted before teardown and restored without unwanted autoplay.
- Handoff pins and grace-retained players count toward the budget. A live handoff reservation preempts speculative preload.
- Scroll-direction-aware selection (upcoming preferred over passed); nearest eligible stable slot as fallback. Stable slot/media identity only — never array index or DOM order.
- Prewarm shares the managed-feed cap; dedicated lightbox is separately budgeted.
- Standby videos show poster (not Skeleton) while budget-blocked; Skeleton only when no poster exists.
- Immediate first-slot loading eligibility on cold mount without changing autoplay arbitration.

### Fix 3 — concurrent Post upload pipeline
- Posts-only explicit opt-in (`isPostComposer`); Review/Timeline keep legacy serial upload path.
- Validate file → immediately start both `mux-create-upload` and one poster-generation task concurrently → start direct XHR PUT to Mux as soon as upload URL arrives (does not wait for poster storage).
- Poster failure non-fatal: Mux upload continues, local preview kept, eventual Mux thumbnail fallback. Stored poster cleaned up if Mux creation fails.
- Exactly one canvas/video decode per selected video shared between MediaUploader and mediaService.
- Cancellation/generation scoped to `(clientKey, attemptId)`: abort active XHR, cancel poster/network work, invalidate late callbacks, revoke object URLs, clean storage artifacts.
- Truthful progress: byte-level 0–100% → "Upload sent — finishing…" → "Processing video…" → Ready.
- Finalization waits at most 1.5 s for poster, then relies on Mux metadata.
- Strict Ready-before-Publish: status=ready, asset ID present, playback ID present, finite authoritative duration > 0 and ≤ 60 s.

### Mobile feed reliability
- `feedVideoActiveSelection.ts`: `selectActiveSlot()` with `ACTIVATE_THRESHOLD=0.60`, `FALLBACK_THRESHOLD=0.35`, `KEEP_THRESHOLD=0.35`, `SWITCH_MARGIN=0.20`.
- Universal dominant-visible fallback: when no video reaches 0.60, exactly one candidate at ≥ 0.35 is selected, scored by visibility ratio and viewport-center proximity. Existing hysteresis retained.
- Accessible manual Play button available before `loadeddata`; records `userRequestedPlay` for the exact stable slot; attempts `play()` as soon as source attaches with existing muted-fallback on rejection; cleared on pause/another slot/remove/unmount.
- Poster-first rendering; subtle spinner only for active buffering.

### Final QA refinements (lightbox return + post-edit feed player)
- **Lightbox video → photo → back:** per-lightbox-session memory keyed by stable Post media key (currentTime + playing/paused). Seeded from feed→lightbox handoff. Snapshot before navigation unmounts the departing video; cancel pending seek/play callbacks (generation token). On return: seek to remembered time, play only if was playing, stay paused if paused. Exit handoff to feed reads from same map. Non-Post callers keep legacy numeric path unchanged.
- **Post-edit photo removal (collage → single video):** instance-owned registration token/generation in FeedVideoManager. Unregister, loading-reservation release, pin release and pending-Play clearing act only when token matches — old player cannot remove its replacement. Same stable slot preserved: saved position and user-paused intent survive; global mute/session sound untouched.

## Tests
- Full Vitest suite: **1,138 passed, 3 skipped, 0 failed**.
- TypeScript check: **clean** (0 errors).
- Database suite (`supabase/tests/post_video_phase4.sql`): passed (new-item server ID, valid client ID kept, forged ID restored, duplicate IDs refused, signed-URL matching, ambiguous historical grandfathered, reorder/removal keeps IDs, new link stores `media_id`, webhook patches right item, mismatched ID not patched, old NULL link unchanged, late webhook `noop_removed`, lock order unchanged).
- Phase 2 rerun (31 passed) and Phase 3 rerun (8 passed) after Step 2.
- App-level test coverage for: `mediaIdentity.ts`, `postDisplayMedia.ts`, `lightboxHandoffSeek.ts`, `feedVideoLoadBudget.ts`, `feedVideoActiveSelection.ts`, `feedVideoLoadProvider.test.tsx` (replacement player survives old cleanup), `postVideoUploadFix3.test.ts` (concurrent pipeline, cancellation, poster failure isolation, late callbacks, Ready-before-Publish), `composerVideoReadiness.ts`.

## Debug/diagnostic logging
- `[feed-video-mobile]` gated by `FEED_VIDEO_DEBUG` — enabled only in DEV mode or with `?feedvideodebug=1` query parameter. No output in production builds.
- `[post-video-timing]` is gated by `import.meta.env.DEV` (corrected during Phase 6); browser console verbosity alone was not a production logging gate.

## Code audit — no obsolete paths remain
- No Post video identity by array index where a stable media ID exists (`media_index` used only for Mux mapping position data in save payloads, never identity).
- No forced `min_resolution=720p` or `getLightboxPlaybackOpts` in lightbox/feed path (removed; generic `minResolution` option exists only in unused `muxMedia.ts` utility).
- No superseded loading/preload logic competing with Fix 2 coordinator.
- No stale composer upload path competing with Fix 3 flow.
- No old player cleanup path that can unregister a newer generation (instance-owned registration tokens).
- Review/Timeline behavior unchanged: legacy serial upload path, `ReviewMediaBlock` + `visibleReviewMedia` display, `reviews.video_enabled = false`.

## Intentionally deferred (not in Phase 4)
- Post video view-count work (keyed by storage path/playback ID — already identity-safe; no Phase 4 action needed).
- Review/Timeline video analytics.
- Private/signed Mux playback.
- Mux asset deletion/cleanup.
- Review video rollout (`reviews.video_enabled` remains `false`).
- Historical Post repair/backfill (grandfathered byte-identical; no migration required).
- Reorder UI for Post media.
- Stories.

---

**Post Video Phase 4 — COMPLETE**
