# Phase 3.3A.1 — Thumbnail polish

Two questions, two different answers.

## 1. Mentions and comments: already covered, nothing to add

Thumbnail eligibility is already **target-based**, not type-based. Any row whose target is a post or a recommendation gets a preview — likes, comments, replies, mentions and comment-likes all qualify, because a comment-scoped row still carries `entity_type = 'post'` plus the parent post id.

Verified against live data: of 82 `comment` notifications pointing at posts, 32 target posts that actually have media. So comment rows without a thumbnail in your screenshot are text-only posts, not a gap in the feature.

That is also the behaviour to keep: Instagram/X show a preview only when the target has visual content, and suppress the slot otherwise. Forcing a placeholder on text-only targets would add visual noise and would tell the user nothing. **No change here.**

## 2. White poster on non-Mux (raw) video uploads: fix it

Raw video uploads do get a stored `_poster.jpg` (client-generated at upload time), and `notificationThumbnail.ts` correctly accepts it as the only safe still for a legacy video. The problem is upstream: that poster is sometimes an effectively blank/white frame, so a valid-looking image URL renders as a white square.

The poster is produced in `src/utils/videoPoster.ts` by seeking to ~0.1s and drawing on the `seeked` event. On some codecs/browsers the frame is not decoded yet at that moment, so the canvas is drawn empty — which is the most likely cause, but it is **not yet confirmed**, so verification is step one.

### Approach

1. **Verify first** — inspect one of the existing non-Mux `_poster.jpg` files to confirm it is genuinely blank (uniform near-white) rather than a legitimately bright frame. This decides whether the rest is needed.
2. **Notification-side guard (safe now, regardless of the cause):** in `src/utils/notificationThumbnail.ts`, stop treating a legacy (non-Mux) video poster as a thumbnail source, and resolve those rows to `null` — the slot then collapses and the row shows no preview instead of a white box. Mux videos keep using the deterministic `image.mux.com` thumbnail and are unaffected. Cover this with unit tests alongside the existing thumbnail tests.
3. **Root fix for new uploads (only if step 1 confirms blank posters):** harden `generateVideoPoster` so it waits for a genuinely decoded frame — prefer `requestVideoFrameCallback` when available, otherwise a short retry/re-seek — and reject rather than upload a blank poster. This improves every surface that uses the poster (feed, lightbox, previews), not just notifications.

Existing blank posters already in storage are not rewritten; step 2 makes them harmless in the notification drawer.

## Why this split

Step 2 is small, reversible and removes the odd artefact immediately. Step 3 is the real cause but touches the upload pipeline, so it stays gated behind evidence and is kept separate from Phase 3.3A's scope.

## Technical notes

- Files touched: `src/utils/notificationThumbnail.ts`, `src/utils/notificationThumbnail.test.ts`, and (conditionally) `src/utils/videoPoster.ts`.
- No database changes, no changes to `NotificationList.tsx` — the empty-slot behaviour it already implements is what handles a `null` result.
