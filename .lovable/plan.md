# Post video Phase 4 — Step 3: stable-identity app/UI work (revised)

Phase 4 Steps 1–2 are complete and accepted. This is the revised Step 3 plan, incorporating both reviewer corrections. **No implementation yet.** Remaining sequence after this plan: Step 3 implementation → focused Step 3 regression/manual QA → Phase 4 close-out. There is no Step 4/Step 5 feature phase; post view-tracking work is out of Phase 4 scope.

## Goal
Post media is addressed by its stable media ID everywhere in the app layer, not by array position. A removed neighbour can never make the wrong video play, the wrong tile open, or the wrong item resume. `/create` looks and works the same. Autoplay, feed→lightbox handoff, reverse handoff/resume, one-at-a-time playback, and mute sync keep working exactly as today. No reorder UI. No Review/Timeline changes.

## Current state (verified in code 2026-10-15)
- Composer generates `item.id || uuidv4()` per item; removal uses `mediaIdentity` (id → mux_upload_id → url); **local preview blob URLs and frozen preview items are keyed by `item.id`** (`localPreviewUrlsRef`, `frozenPreviewItemsRef`, `previewSrcOverride`); preview tiles key by `item.id || index`.
- `session_id` exists on `MediaItem` but the composer's `sessionId` is one-per-composer-mount, not per-item — **not suitable** as a per-item render identity.
- FeedCollage keys tiles by `item.id` but passes `originalIndex` on click; PostMediaDisplay opens the lightbox by position and tracks resume as `{ index, handoff }`; LightboxPreview navigates by `currentIndex`, applies entry handoff by `entryIndexRef`, and emits numeric `entryIndex`/`currentIndex` in `VideoExitHandoff`.

## What we build

1. **Shared media-identity helper (`src/utils/mediaIdentity.ts`, new).**
   - `mediaKey(item): string | null` — the item's stable `id` when present and non-empty; otherwise `null`. Never `''`, never a positional fallback.
   - `findByMediaKey(media, key)` — resolves the current index at the moment of use only; identity is the ID, position is derived, never stored.
   - Missing loaded IDs remain absent. Items without an ID (grandfathered historical) keep today's positional behavior, and only those items.

2. **Composer: separate immutable local render identity (`clientKey`).**
   - Each composer media item gets a local-only `clientKey` (uuid, generated at pick/load time, never persisted, never sent to the server).
   - React tile keys, `localPreviewUrlsRef`, `frozenPreviewItemsRef`, `previewSrcOverride` lookup, and X-removal all use `clientKey` for the lifetime of the composer session.
   - `item.id` remains the persisted stable media identity and may be replaced by the authoritative server ID from the save readback.
   - **Server-ID adoption updates only the `id` field.** It must not revoke/recreate the object URL, reset playback, restart upload state, reorder media, or remount the preview tile — because nothing keyed by `id` is used for rendering anymore.
   - On edit-load, existing saved items get a `clientKey` assigned once at load.

3. **Viewer/lightbox opens and tracks by media ID.**
   - FeedCollage `onItemClick` carries the clicked item's media ID; PostMediaDisplay resolves the open index via `findByMediaKey` at open time.
   - LightboxPreview accepts `initialMediaKey?: string`; the **active item is tracked by its key for the whole session**, not just resolved at mount: the displayed index is derived from the key on every render, so a media list change while open can't silently show the wrong item.
   - If the tracked item disappears from the list while the lightbox is open: close the lightbox (explicit behavior) — never fall back to "whatever is at that position now" and never resume a different video.
   - Items without an ID keep the current index path unchanged.

4. **Resume/handoff by media ID.**
   - `VideoExitHandoff` gains additive `entryMediaKey?: string` / `currentMediaKey?: string`; numeric fields kept so Review/Timeline/entity/Story callers are untouched.
   - PostMediaDisplay's `videoResume` becomes `{ mediaKey, handoff }`; FeedCollage matches by media key instead of index equality.
   - Timestamp/play resume applies only when `entryMediaKey === currentMediaKey`; mute stays global. Missing keys must never compare equal (no `undefined === undefined` match applying a handoff to the wrong item); numeric fallback only for genuinely ID-less items.
   - Handoff invariants at the top of LightboxPreview (seek-before-play, iOS early-play, HLS attach order) are preserved verbatim — only the identity used to decide *which* item gets the handoff changes.

5. **Shared-component compatibility.**
   - FeedCollage, LightboxPreview, PostMediaDisplay, FeedVideo are shared with Review/Timeline/entity surfaces. All new props are optional; existing callers' behavior is byte-identical (verified by their existing tests passing unmodified).

6. **Tests.**
   - Rendered: lightbox opens the correct item by ID when a same-type neighbour was removed before open.
   - Rendered: item removed *while the lightbox is open* → lightbox closes, no wrong-item playback.
   - Rendered: exit handoff resumes the correct feed video by ID after a removal; no wrong-item resume; missing keys never match.
   - Rendered: composer adopts a changed server ID while the same video element keeps playing — no reload, no pause, no remount; X-removal still removes the correct item.
   - `mediaKey` never returns `''`; ID-less items behave exactly as today.
   - Full suite + typecheck.

## Explicitly not in scope
- No media reordering UI. No Review/Timeline/Story changes. No DB, Edge Function, Mux, analytics, view-count, or rollout-setting changes. No `/create` appearance changes.
- Historical posts `d4941fd5…` / `3e5b7e00…` untouched. Previously blocked DB checks and concurrency exceptions stay recorded; this UI work does not resolve them.

## Verification
- Full app suite + typecheck, then focused Step 3 manual QA (owner): open lightbox from a video, navigate, close — handoff smooth both directions; edit a post, remove a photo, confirm the right video plays.
