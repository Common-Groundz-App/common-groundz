# Phase 2 — Video on the new Review and Timeline pages (create and edit)

Scope: only the new Review page, Timeline Update page and their edit pages. Displaying review videos elsewhere (cards, entity pages, lightbox, autoplay) is Phase 3 and stays out of this phase. Posts, legacy popup/inline forms, photo cleanup, the rollout switch and existing Mux videos are untouched.

## What the author will see

- The media picker says "Add photos or a short video" and accepts one video alongside photos (4 items total, max 1 video, 100 MB, 60 seconds) — same limits and messages as /create.
- Upload stages copied from /create: uploading progress chip, "Processing" chip, cancel, retry, and the same preparing poster in the preview tile.
- Compatibility hint (the existing owner hint) for formats that may not play everywhere.
- Public-only rule shown up front:
  - Review page: if visibility is Private or Circle, the video option is disabled with "Videos are available on public reviews only."; while a video is attached, the Private/Circle choices are disabled with the same reason.
  - Timeline page: video allowed only when the parent review is public; otherwise the same disabled message.
- Edit pages (within the 1-hour window): an existing video shows as a tile with its current state (processing, ready poster, failed/too long). It can be removed or replaced within the hour. After the hour the page stays read-only, as today.
- Failed or too-long video: the tile shows a clear failed state with "Remove video" (inside the hour only). Saving with a failed video is blocked with a plain message.
- Save while still processing is allowed; the server patches the video in when Mux finishes (Phase 1 rules).

## Upload lifecycle rules

- Pick → reserve slot → create upload → progress → "Processing". Cancel or remove releases the slot exactly once (existing upload registry).
- Leaving the page, switching target or turning the switch off cancels a pending upload; drafts keep the photos and drop an unfinished video with a toast-free note in the draft.
- A cancelled or removed video is never deleted from Mux (kept for the later cleanup phase).
- Server error codes from Phase 1 (`review_video_public_only`, `review_video_visibility_locked`, too many items, more than one video, not your upload, `expired`) map to friendly messages in the existing server-error table.

## Rollout

- Behind a new app setting "Review videos" (default OFF), managed in the existing admin feature flags panel. OFF = today's photo-only pages exactly. You turn it on after the checks.

## Tests

- Unit: picker limits, public-only toggling both ways, slot release on cancel/remove/unmount, draft behavior, error-code mapping, switch OFF = photo-only regression, legacy forms still photo-only.
- Browser checks with the switch ON for a test review (public, photo + video, edit within the hour, private blocked).
- Then your signed-in checklist. I stop after Phase 2 and report before Phase 3.

## Technical details

- `ReviewComposerScreen` and `TimelineComposerScreen`: pass `allowVideo={flag && isPublicContext}` to `MediaUploader`; reuse `MuxUploadChip`, `MuxPreparingPoster`, `MuxOwnerHint`, `useMuxStatus`, and `mediaService` Mux upload (with `declared_size`).
- Remove the `canRemove={(m) => m.type !== 'video'}` restriction only when the flag is on and within the edit window.
- Visibility control reads `values.media` for any `type==='video'` item; timeline reads parent review visibility from the existing loader.
- New `app_config` key `review_video_enabled` (boolean, false) via `useAppConfig`; no schema change beyond inserting the config row.
- `serverErrors.ts` gets the new codes; `saveBuilders.ts` sends only `{type, url?, mux_upload_id}` for video — server fills trusted Mux fields.
- No changes to triggers, edge functions or posts.
