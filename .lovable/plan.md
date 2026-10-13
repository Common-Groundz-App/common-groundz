# Post and Review video: closing the gaps

## My view on the feedback

- **Placeholder instead of hiding:** I agree. Hiding the video leaves an entry that looks half-finished (your "ok" screenshot). Other people get a small neutral tile, and the author keeps the detailed message.
- **All six post gaps:** I agree. I left stable video IDs out of my first fix list by mistake, and the one-save linking should be a required step, not an optional one.
- **Review video views:** I agree, with one condition. The view counter already accepts "review" as a type, but it has no type for timeline updates. That needs adding first, so update views never get counted as post or review views.

## Your /create question

**This is a server-only change, and nothing on /create will feel different.** While you're writing a post, the upload progress, preview, autoplay and "Ready" state all come from the upload's own status. That status doesn't depend on the linking step at all. Linking only happens after you press Post. The change just moves that step into the same save, so the separate request after it goes away.

## Display rule (Posts, Reviews and Timeline Updates)

| State | Other people | Author |
|---|---|---|
| Processing | Small "Video processing" tile | Current processing state |
| Failed or too long | Small "Video unavailable" tile | "Couldn't process this video" plus their allowed options (the one-hour rule is unchanged) |
| Ready | Normal player | Normal player |

- The tile is compact: same corners as the media, a muted background, a video icon and one line of text. It's not a big black player.
- It never plays, has no controls, isn't counted as a view and never becomes the cover. The cover rules stay the same.
- It shows only to people who can already see the post or review.
- The photo gallery keeps showing only videos that are ready.

## Phases (one at a time, each reported before the next)

1. **Shared display tiles.** One tile used for posts, reviews and updates, replacing the hide rule and the post badge everyone sees today.
2. **Post server rules.** I'll check existing posts first, read-only. Then I'll add the review-style rules: max 4 items and 1 video, over 60 s marked "too long", only the server can set video state, and the uploader must be the author. Existing posts are never blocked or changed, and an unrelated edit to an old post is never refused.
3. **Linking in one save for posts.** Linking happens inside the post save, and the two separate requests are retired. This covers: video ready before saving, a failed save, removing or replacing a video, deleting a post, and duplicate or late Mux messages.
4. **Stable video IDs for posts.** Each post video gets an ID based on its own upload, never its position in the list. That ID drives resume-playback, the full-screen viewer and view counts. Old posts work without being rewritten.
5. **Review and update view counts.** The post view rules are reused (same watch threshold and duplicate rules). A view isn't counted twice when you open a video full-screen from the card. Each count goes to the right type: post, review or timeline update. Counting a view never changes edit times, reopens the edit window or touches photo cleanup.
6. **Recheck.** Full automated suite, plus one short signed-in check covering the new tiles, a post video upload and one review view. The earlier Phase 4 results stay valid. Only the checks these changes affect are rerun, and Review video is marked as reopened until this passes.

## Stays the same

Public playback links, the one-hour rule, no reordering, privacy and Circle rules, legacy forms, Mux asset deletion (the later cleanup project), and Review videos staying off for everyone.

## Technical details

- Display: replace `displayStateFor` 'hidden' for non-owners with `viewer_processing` / `viewer_unavailable`; new shared `VideoUnavailableTile`; `FeedVideo`/`MuxPreparingPoster` gain an `isOwner` input (posts via `isPostOwner`).
- Posts: a BEFORE trigger on `posts.media` that mirrors `review_media_mux_before` and is scoped to rows where the media changed. Existing over-limit rows pass when their media is unchanged. Add `duration > 60` → errored/too_long in the post branch of `patch_content_media_from_mux`. An AFTER trigger syncs `mux_upload_mappings`. `mux-register-mappings` / `mux-sync-post-mappings` are kept as no-op-safe callers for one release, then removed.
- IDs: `stableMediaId('post', postId, item)`, generalised from `stableReviewMediaId`.
- Views: `track-media-view` source enum gains `review_update`, and `media_views` accepts it. `FeedVideo` tracking is enabled when a valid source and id are present and the item is playable.
- Tests: SQL tests on made-up records, rolled back; unit and rendered tests for the tiles, IDs and view attribution; the post composer's existing tests must stay green.
- roadmap.md gets this work added as a new item once the plan is approved.
