# Phase 3.0 verification + Phase 3.3A plan

## Phase 3.0 is complete

- `src/utils/notificationSections.ts` and its test file exist and are registered in `vitest.config.ts`.
- `NotificationList.tsx` owns the `now` state, the local-midnight `setTimeout` re-label, and renders sticky section headers around grouped rows.
- No leftovers: nothing else in the codebase references sectioning, and the whole suite passes (184 tests, 9 files).
- Roadmap already marks 3.0 done and records the two 3.3 prerequisites (avoid `notifications.image_url`; row must stop being one big `<button>` before a Follow-back button lands).

## Next: Phase 3.3A — target thumbnails

Goal: each notification row shows a small preview of the *content it points at* (the liked post's image, the recommendation's image) on the right side, so the user knows which post it refers to without opening it.

### Behavior

- Eligibility is target-based, not type-based: any row whose `entity_type` is `post` or `recommendation` with a valid UUID `entity_id` gets a thumbnail — likes, comments, replies, mentions and comment-likes alike. Confirmed in the data: comment rows carry `entity_type='post'` plus the parent `entity_id`, with `metadata.comment_id` only identifying the comment inside it.
- Excluded: follow rows (`entity_type='profile'`), system rows, and anything without a valid post/recommendation target.
- 40x40 rounded slot on the right. While a known target is still resolving, the slot is reserved to avoid a layout shift; once the query conclusively returns no image, the slot is removed and the text column reclaims the space. No placeholder box, no letter initials, no permanent blank gutter.
- Never render the actor avatar as the thumbnail, and never use `notifications.image_url` (actor-avatar data).
- Aggregated like-groups share one target, so one lookup per distinct target, not per row.

### Data

- New hook `src/hooks/useNotificationTargets.ts`: collects the distinct `(entity_type, entity_id)` pairs from the rows currently loaded in the active lane, sorts them for stable keys, chunks at 200 ids, and issues `ceil(unique/200)` bounded requests per entity type (one query *family* per type — typically one request each):
  - `posts`: `select id, media where id in (...) and is_deleted = false`.
  - `recommendations`: `select id, image_url where id in (...)` (this table has no `is_deleted` column).
- RLS remains the authorization boundary — invisible rows come back absent and render nothing.
- Caching is explicit about being batched: react-query key is `['notification-targets', userId, entityType, chunkKey]` where `chunkKey` is the sorted chunk of ids. `userId` (the current account) is part of the key so RLS-scoped media can never leak across accounts; sign-out/account switch changes the key and the cache is also cleared alongside the existing notification caches.
- Resolution lives in a pure module `src/utils/notificationThumbnail.ts`:
  - posts: first non-deleted media item that yields a *validated image* URL; for Mux video items use `muxThumbnailUrl(playback_id)` directly rather than `muxPosterUrl`, because `muxPosterUrl` falls back to `thumbnail_url ?? url` and `url` can be the raw video file. Legacy video items only qualify via `thumbnail_url`.
  - recommendations: `image_url`, validated.
  - Validation: `http`/`https` only, parseable URL, no `data:`/`blob:`/relative junk; anything else resolves to no thumbnail.

### UI

- `NotificationList` calls the hook once with the flat rows and passes `thumbnailUrl` plus a `targetPending` flag to each `NotificationRow`.
- Row layout: left = actor avatar stack; center = sentence, optional preview, then timestamp with the read/unread indicator adjacent to it (kept visually distinct so unread state stays obvious, not buried in the timestamp line); right = optional 40x40 thumbnail.
- Thumbnail is a decorative non-interactive `<img aria-hidden>` inside the existing row button — no nested interactive element. External hosts route through the existing image proxy path; `loading="lazy"`, `decoding="async"`; `onError` collapses the slot.

### Out of scope (stays for 3.3B)

Follow-back button, the row-structure refactor it requires, any follow mutation, DB migrations, edge-function and notification-producer changes, and anything touching realtime/counts/cursors/read state/retraction/preferences.


### Verification

- New unit tests for `notificationThumbnail.ts` plus a batching test for the id-chunking helper; full suite must stay green.
- Manual: like a post with an image, a post with a video, a text-only post, and a recommendation, then confirm the drawer shows correct previews and clean empty slots.
