
# Phase 5 — Processing / errored UI polish (final, v2)

All review corrections incorporated. Verifications from v1 still hold (DB column `error`, enum `waiting|asset_created|ready|errored|cancelled`, feed query keys `['feed', ...]` / `['infinite-feed', ...]`, PostContentViewer uses local `fetchPost` not react-query).

## Files (8)

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useMuxStatus.ts` (new) | Realtime hook. Input: `uploadIds: string[]`. Steps: (a) **initial fetch** via `supabase.from('mux_uploads').select('upload_id,status,playback_id,asset_id,error').in('upload_id', ids)` → seed cache + fire `onReady` for any already-`ready`. (b) Subscribe `postgres_changes` UPDATE on `public.mux_uploads` filtered `upload_id=in.(...)`. Caps at **N=8** ids/channel (one-time `console.warn` above). Normalizes DB → UI. Fires `onReady(upload_id)` **exactly once per upload_id per hook instance lifetime** (internal `Set<string> firedReady`), regardless of whether the first `ready` observation comes from initial fetch or realtime UPDATE. Clean unsubscribe on unmount/id-set change. Empty input → no-op. |
| 2 | `src/lib/isPostOwner.ts` (new) | Shared `isPostOwner(post, user): boolean` used by both PostView gate and MuxOwnerHint internal gate. |
| 3 | `src/components/feed/composer/MuxUploadChip.tsx` (new) | Overlay chip: spinner + "Processing"; checkmark + "Ready" with 1.5s CSS fade-out; ⚠ + "Upload failed". Semantic tokens. **Deterministic dismissal:** module-level `Set<string> dismissedReadyChips` persists "this upload's ready chip already faded" across component remounts within the composer session. On ready+fade, the upload_id is added to the set; subsequent renders skip the ready chip entirely for that id. No timers, no internal state machine. |
| 4 | `src/components/feed/EnhancedCreatePostForm.tsx` | Collect Mux `upload_id`s from in-flight media items → `useMuxStatus(ids)` → render `<MuxUploadChip>` per tile. Submit not gated by UI status. `failed` → existing remove-tile handler. |
| 5 | `src/components/media/MuxOwnerHint.tsx` (new) | Owner-only banner. Props: `post`, `onReady?(): void`. Gates internally via `isPostOwner` + `isMuxPreparing`/`isMuxErroredOrBroken` on `post.media`. Subscribes via `useMuxStatus` only when owner + has preparing/errored Mux items. Copy: "Your video is processing — usually under a minute" (processing) / "Video failed to process. Please edit if allowed or create a new post." (failed, dead-end, no CTA). Auto-unmounts when all observed uploads reach `ready`. |
| 6 | `src/pages/PostView.tsx` | Mount `<MuxOwnerHint post={post} onReady={handleMuxReady} />` above content viewer, owner-gated via shared helper. `handleMuxReady` bumps `refreshTick` state + invalidates `['feed']` and `['infinite-feed']` query keys; schedules a second pass at 1000ms gated by `document.visibilityState === 'visible'`. Emits `mux_ready_refetch_double_fired` on the second pass. |
| 7 | `src/components/content/PostContentViewer.tsx` | Add optional prop `refreshTick?: number`. Add sibling `useEffect(() => { if (refreshTick && refreshTick > 0) fetchPost(); }, [refreshTick])`. No other changes. |
| 8 | `src/hooks/useMuxStatus.test.ts` (new) | Unit tests: (a) `onReady` fires on initial fetch if status already `ready`; (b) `onReady` fires on realtime processing→ready; (c) `onReady` never double-fires for the same upload_id within one hook instance; (d) id-set diffing on prop change; (e) N=8 cap enforced; (f) clean unsubscribe on unmount; (g) UI status normalization for all 5 DB enum values. |

## Scope (locked)

In: useMuxStatus hook, composer per-tile chip, PostView owner hint, ready-state refetch glue.

Out (strict non-goals): re-upload / replaceMediaIndex flow (Phase 3C), edit-window changes, Mux Player swap, captions, signed URLs, backfill, orphan-cleanup cron, realtime on viewer feed cards, DB / edge function / webhook / playback changes.

## Technical design

### onReady contract (clarified)

`useMuxStatus` fires `onReady(upload_id)` **once per upload_id per hook instance lifetime** when it **first observes** `ui_status === 'ready'`. Sources:
- Initial `.in('upload_id', ids)` fetch returns `ready`.
- Realtime UPDATE flips DB status to `ready`.

Internal `firedReady: Set<string>` guards against double-fire from replayed events or rapid state updates.

### Ready-chip persistence (composer)

Module-level `const dismissedReadyChips = new Set<string>()` in `MuxUploadChip.tsx`. Once the ready chip's 1.5s fade completes for a given upload_id, that id is added to the set. On any future render (including after component remount within the same SPA session), the chip checks the set first and skips rendering the ready variant. Reset only on hard page reload — desired behavior.

### Ready-state refetch glue

PostContentViewer doesn't use react-query, so invalidation alone won't refetch the post. Flow:

```
useMuxStatus.onReady(upload_id)
  → PostView.handleMuxReady()
    → setRefreshTick(t => t + 1)        // PostContentViewer refetches via new effect
    → invalidateQueries(['feed'])
    → invalidateQueries(['infinite-feed'])
    → setTimeout(() => {
        if (document.visibilityState === 'visible') {
          setRefreshTick(t => t + 1)
          invalidateQueries(['feed'])
          invalidateQueries(['infinite-feed'])
          analytics.track('mux_ready_refetch_double_fired', {
            delay_ms: 1000,
            had_playback_id_on_first_refetch
          })
        }
      }, 1000)
```

### Status normalization

```ts
type MuxDbStatus = 'waiting' | 'asset_created' | 'ready' | 'errored' | 'cancelled';
type MuxUiStatus = 'processing' | 'ready' | 'failed';

const normalize = (s: MuxDbStatus): MuxUiStatus =>
  s === 'ready' ? 'ready'
  : (s === 'errored' || s === 'cancelled') ? 'failed'
  : 'processing';
```

### Subscription shape

```ts
supabase
  .channel(`mux-status-${instanceId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'mux_uploads',
      filter: `upload_id=in.(${ids.slice(0, 8).join(',')})` },
    handler)
  .subscribe();
```
Mux upload ids are alphanumeric — no escaping required. Realistic composer range 1–4; cap 8 with warn.

### Analytics

- `mux_upload_status_changed` `{ upload_id, ui_status, surface: 'composer'|'owner_hint' }`
- `mux_owner_hint_shown` `{ post_id, ui_status }`
- `mux_owner_hint_dismissed_ready` `{ post_id, elapsed_ms }`
- `mux_owner_hint_failed_shown` `{ post_id }`
- `mux_ready_refetch_double_fired` `{ delay_ms, had_playback_id_on_first_refetch }`

## Verification

1. `tsc --noEmit` clean.
2. `useMuxStatus.test.ts` passes — all 7 cases including initial-fetch-ready and no-double-fire.
3. Composer smoke: upload → "Processing" chip → DB flip `ready` → "Ready" chip fades after 1.5s → unmount/remount tile (e.g., reorder) → ready chip does NOT reappear.
4. Composer failed path: simulate `errored` → "Upload failed" chip → submit enabled → existing remove-tile works.
5. PostView owner: post a Mux video → banner shows → on `ready`, PostContentViewer refetches via `refreshTick`, FeedVideo (Phase 4) plays HLS, banner auto-dismisses.
6. **Race coverage**: post a Mux video where webhook fires *before* PostView mounts → `useMuxStatus` initial fetch sees `ready` → `onReady` still fires → `refreshTick` bumps → playback works.
7. PostView non-owner: no banner, no `mux-status-*` channel in DevTools.
8. Owner errored: dead-end failed copy, no CTA, no navigation.
9. Tab-visibility guard: background tab during 1s window → no second refetch.
10. Feed cards do not subscribe (grep `useMuxStatus` → only 2 callers).
11. Phase 4 regression: legacy `.mp4`, Mux ready, Mux preparing, Mux errored all unchanged.

## Rollback

Per-file revert. Hook is opt-in; removing the two call sites in `EnhancedCreatePostForm.tsx` and `PostView.tsx` fully disables Phase 5 without touching Phase 4 or DB. PostContentViewer's `refreshTick` prop is optional, so the prop addition is backwards-compatible.

---

Approve to implement.
