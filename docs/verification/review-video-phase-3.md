# Review video — Phase 3 (display surfaces)

Date: 2026-10-12. Closed 2026-10-13. `reviews.video_enabled` still **OFF**.

**Status: complete.** Real-browser checks (off-screen stop, one-at-a-time with posts, hover pre-load, scroll restore, no playback behind the viewer, failed poster never a cover) and the timeline-viewer coordination fix moved to Phase 4.

## Built
- One display rule (`src/utils/reviewMediaDisplay.ts`) used by every review media surface: entity review card, entity timeline card (review + each update), profile/My Stuff review card, review timeline viewer (display part), entity Photos tab and media preview.
  - Ready Mux video and photos/legacy stored videos: everyone.
  - Processing: author only ("Processing" poster); hidden for others.
  - Failed / too long: hidden for others with no details; author sees a note — within that entry's hour "Edit to remove or replace it", after it "delete this review/update or add a timeline update".
  - Timeline updates use their own hour + latest-update rule, never the parent review's.
- Stable media identity `kind:ownerId:(mux_upload_id|id|url)` for player slot, pause/resume memory, grid selection and viewer start.
- `ReviewMediaBlock`: grid + full-screen viewer share one filtered list; video time hands in and back out like the feed; the page's video manager pauses while the viewer is open; mute is shared.
- Player: the feed's `FeedVideo` reused (no second player). Audit: the only post-specific behaviour was view counting; `useVideoViewTracker` got an `enabled` option and is off for `source="review"` (posts and entity media unchanged). Error telemetry and pause/resume memory are generic.
- Entity reviews list wrapped in the shared one-at-a-time video manager.
- Photos tab: only playable videos; kept as videos (type, playback id, review / update id); Mux posters used as tiles (Mux items may have an empty address); legacy stored videos unchanged. Tab label stays "Photos" (works as media gallery; rename later).
- Covers: no screen computes or writes a cover; cards keep reading `reviews.image_url` (server-owned).
- Side fix: timeline card used to open the review's own media when an update photo was tapped; each entry now opens its own media.

## Tests
- Full app suite: 76 files, 1,060 passed, 3 skipped. Typecheck clean.
- New: `reviewVideoPhase3.test.tsx` (18) and `useVideoViewTracker.phase3.test.tsx` (2).
- Correction to Phase 2 record: `reviewVideoPhase2.test.ts` was not registered in the test config, so the Phase 2 count did not include it. It is now registered and passes (14/14).
- Gallery privacy through its real query path: signed-out requests to the same tables return 0 non-public reviews and 0 updates of non-public reviews (1 private review exists). The gallery has no cache layer; it refetches on each open. Videos can only exist on public reviews (Phase 1 rule).

## Not done / carried to Phase 4
- Browser and signed-in checks (Phase 2 composers + Phase 3 playback): autoplay in view, off-screen stop, pre-load, real lightbox handoff, scroll restore.
- Timeline viewer opened from the entity header (outside the reviews list) uses the player's unmanaged mode: autoplay works but isn't coordinated with other videos.
- Phase 1 concurrency overlap remains unverified.
