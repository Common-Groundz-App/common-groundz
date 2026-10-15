# Post video Phase 4 — Step 3: stable-identity app/UI work (revised v2)

Phase 4 Steps 1–2 are complete and accepted. This is the revised Step 3 plan, incorporating both review rounds. **No implementation yet.** Remaining sequence: Step 3 implementation → focused Step 3 regression/manual QA → Phase 4 close-out. There is no Step 4/Step 5 feature phase; post view-tracking work is out of Phase 4 scope.

## Goal
Post media is addressed by its stable media ID everywhere in the app layer, not by array position. A removed neighbour can never make the wrong video play, the wrong tile open, or the wrong item resume. `/create` looks and works the same.

**The only intended change is *which* media item receives the existing playback/handoff behavior — from index to stable ID. How playback works is not rebuilt.**

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
   - Each composer media item gets a local-only `clientKey` (uuid), generated **once** when the item enters local state (pick time, or edit-load time for saved items).
   - `clientKey` is preserved through all state reconciliation and readback; never regenerated because `item.id` changes; never regenerated during render.
   - `clientKey` is **strictly UI-only**: explicitly stripped from save payloads — never persisted to `posts.media`, never sent to the server.
   - React tile keys, `localPreviewUrlsRef`, `frozenPreviewItemsRef`, `previewSrcOverride` lookup, and X-removal all use `clientKey` for the lifetime of the composer session.
   - `item.id` remains the persisted stable media identity and may be replaced by the authoritative server ID from the save readback.
   - **Server-ID adoption updates only the `id` field.** It must not revoke/recreate the object URL, reset playback, restart upload state, reorder media, or remount the preview tile. A stable React key alone is not sufficient: the frozen preview item and player-registration/source dependencies must also stay stable across the ID change (they key off `clientKey`, not `id`).

3. **Viewer/lightbox opens and tracks by media ID — path-isolated.**
   - FeedCollage `onItemClick` carries the clicked item's media ID; PostMediaDisplay resolves the open index via `findByMediaKey` at open time.
   - LightboxPreview accepts `initialMediaKey?: string`. **The keyed path activates only when a valid media key is supplied.** Callers without a media key (Review/Timeline/entity/Story) execute today's numeric/index path completely unchanged — no partially-applied identity logic.
   - Two concepts are tracked explicitly:
     - **entry media key** — the item that initiated the lightbox/handoff (retained for handoff bookkeeping);
     - **active media key** — the item currently displayed. Next/previous navigation updates the active key to the newly displayed item's key, then derives its index from the media array. Model: `stable key → derive index → navigate → replace active key`, never "entry key forever + separate index".
   - If the active item disappears from the list while the lightbox is open: close the lightbox immediately — never fall back to "whatever is at that position now", never briefly resume another player, never resume a different video.
   - Late load/play callbacks after an item's removal or lightbox closure are ignored (stale-callback guard).

4. **Resume/handoff by media ID.**
   - `VideoExitHandoff` gains additive `entryMediaKey?: string` / `currentMediaKey?: string`; numeric fields kept so existing callers are untouched.
   - PostMediaDisplay's `videoResume` becomes `{ mediaKey, handoff }`; FeedCollage matches by media key instead of index equality.
   - Timestamp/play resume applies only when `entryMediaKey === currentMediaKey`; mute stays global. Missing keys must never compare equal (no `undefined === undefined` match applying a handoff to the wrong item); numeric fallback only for genuinely ID-less items.

5. **Existing playback systems preserved verbatim.**
   Step 3 must not alter:
   - `FeedVideoManager` registration or active-video arbitration;
   - IntersectionObserver/autoplay eligibility rules;
   - one-video-at-a-time behavior;
   - global mute state/event synchronization;
   - unmuted-autoplay → muted fallback behavior;
   - HLS attach/detach sequencing;
   - seek-before-play / iOS early-play handling (LightboxPreview header invariants stay verbatim);
   - feed→lightbox timestamp/play-state handoff mechanics;
   - lightbox→feed resume semantics (only the identity comparison changes);
   - scroll-lock/lightbox close behavior;
   - composer local-video playback behavior.

6. **Tests.**
   New identity behavior:
   - Rendered: lightbox opens the correct item by ID when a same-type neighbour was removed before open.
   - Rendered: active item removed *while the lightbox is open* → lightbox closes, no wrong-item playback, no resume flash.
   - Rendered: exit handoff resumes the correct feed video by ID after a removal; no wrong-item resume; missing keys never match.
   - Rendered: composer adopts a changed server ID while the same DOM `<video>` element keeps playing — no reload, no pause, no remount; blob URL, current time, playing/paused state and upload state survive; X-removal still removes the correct item.
   - `clientKey` survives ordinary state updates, is never regenerated, and never reaches the persisted/server payload.
   - `mediaKey` never returns `''`; ID-less items behave exactly as today.
   Existing smooth-behavior regression:
   - Playing feed video → lightbox receives correct timestamp/state; paused stays paused per current semantics.
   - Lightbox close → same Post video resumes from the correct timestamp; mute survives both directions.
   - Opening one video does not cause another feed video to autoplay; neighbour removal does not transfer autoplay/resume to another video.
   - Review/Timeline/entity shared-caller regressions run unmodified.
   - Full suite + typecheck.

## Explicitly not in scope
- No media reordering UI. No Review/Timeline/Story changes. No DB, Edge Function, Mux, analytics, view-count, or rollout-setting changes. No `/create` appearance changes.
- Historical posts `d4941fd5…` / `3e5b7e00…` untouched. Previously blocked DB checks and concurrency exceptions stay recorded; this UI work does not resolve them.

## Verification
- Full app suite + typecheck, then stop for focused manual QA (owner checklist):
  - `/create` video keeps playing through Ready without reset;
  - video → lightbox → video preserves position and mute, both directions;
  - nothing plays behind the lightbox;
  - removing a neighbouring photo doesn't change which video opens or plays;
  - Review/Timeline playback unchanged.
- "No impact" is an acceptance requirement verified by the tests and this checklist, not assumed before testing.
