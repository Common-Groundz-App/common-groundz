# Post video Phase 4 — Step 3: stable-identity app/UI work

Phase 4 Steps 1–2 are complete and accepted (migration live, 29/29 + 8/8 + 27/0/7 DB suites, both Edge Functions deployed, owner smoke test passed, app suite 1,097 passed, typecheck clean). This is the plan for Step 3 only — **no implementation yet**.

## Goal
Post media is addressed by its stable media ID everywhere in the app layer, not by array position. A removed neighbour can never make the wrong video play, the wrong tile open, or the wrong item resume. `/create` looks and works the same. No reorder UI. No Review/Timeline changes.

## Current state (from code, confirmed 2026-10-15)
- Composer already generates `item.id || uuidv4()` per media item (EnhancedCreatePostForm ~line 609) and keys local preview URLs and X-removal by `item.id`. Good — kept.
- FeedCollage tile keys already prefer `item.id` (fallback `${url}-${index}`). Clicks, however, pass `originalIndex` (position in the pre-reorder array).
- PostMediaDisplay opens the lightbox by `activeImageIndex` (a position) and tracks video resume as `{ index, handoff }`.
- LightboxPreview navigates by `currentIndex`, applies the entry handoff by `entryIndexRef`, and emits `VideoExitHandoff` with `entryIndex`/`currentIndex` numbers.
- `VideoExitHandoff.entryIndex/currentIndex` are numeric positions; resume matching in FeedCollage is `videoResume?.index === originalIndex`.

## What we would build

1. **Shared media-identity helper (new small util, e.g. `src/utils/mediaIdentity.ts`).**
   - `mediaKey(item): string | null` — returns the item's stable `id` when present and non-empty; otherwise `null` (never `''`, never a positional fallback for identity decisions).
   - `findByMediaKey(media, key)` — resolves an item index at the moment of use only; identity is always the ID, position is derived, never stored.
   - Missing loaded IDs remain absent: no `?? ''` coercion anywhere; an item without an ID simply has no stable identity (grandfathered historical items) and falls back to today's positional behavior only for those items.

2. **Viewer/lightbox opens by media ID.**
   - PostMediaDisplay: `handleImageClick` receives the item's media ID instead of (or alongside, during transition) the index; `activeImageIndex` becomes derived via `findByMediaKey` at open time.
   - FeedCollage `onItemClick` carries the media ID (from the clicked entry's item) rather than `originalIndex`. Items without an ID keep the current index path unchanged.
   - LightboxPreview accepts `initialMediaKey?: string`; when present it resolves `initialIndex` from it once at mount. `entryIndexRef` becomes `entryKeyRef` (the media ID), so "the item I opened on" survives a neighbouring removal between open and close.

3. **Resume/handoff by media ID.**
   - `VideoExitHandoff` gains `entryMediaKey?: string` and `currentMediaKey?: string` (additive; numeric fields kept for one release so review/entity callers are untouched).
   - PostMediaDisplay's `videoResume` becomes `{ mediaKey: string; handoff: VideoExitHandoff }`; FeedCollage matches `videoResume.mediaKey === mediaKey(item)` instead of index equality.
   - Timestamp/play resume applies when `entryMediaKey === currentMediaKey`; mute stays global. Index fields remain as fallback only for items with no ID.

4. **Composer adopts the authoritative server ID after save/readback without resetting the local preview.**
   - After save, `refreshSavedPostMedia` readback is reconciled by identity: for each composer item, match the saved item by `mux_upload_id` (Mux videos) or canonical storage path (photos), then adopt the saved `id` in place.
   - The adoption updates only the `id` field — `url`, local preview object URLs, upload state, and order are untouched, so the visible preview never flickers or resets.
   - A server-generated ID that differs from the client-sent one is adopted silently (server is authoritative); no re-upload, no re-render of the tile beyond the key.

5. **Tests (Vitest, jsdom where needed).**
   - Lightbox opens the correct item by ID when a same-type neighbour was removed before open.
   - Exit handoff resumes the correct feed video by ID after a removal; wrong-item resume is impossible.
   - Items without IDs behave exactly as today (positional fallback, grandfathered).
   - Composer readback adopts a server ID without changing `url`/preview state (assert object URL identity preserved).
   - `mediaKey` never returns `''`; missing IDs stay absent.
   - Full suite + typecheck.

## Explicitly not in scope
- No media reordering UI.
- No Review/Timeline/Story changes (they already have stable IDs via `ReviewMediaBlock`).
- No DB, Edge Function, or Mux changes. No view-tracking changes (Step 4 decision pending).
- No changes to `/create` appearance or behavior beyond invisible ID adoption.
- Historical posts `d4941fd5…` and `3e5b7e00…` untouched.

## Verification
- Full app suite + typecheck.
- Owner check deferred to Step 5 (edit a Post with photo+video, remove photo, confirm the right video plays and stays linked) — unchanged.
