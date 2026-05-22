# Phase 4.1 — Hotfix: FeedVideo Rules of Hooks violation

## Problem

`src/components/media/FeedVideo.tsx` places two early `return`s **before** any hook calls:

```tsx
export function FeedVideo({ item, ... }) {
  if (isMuxErroredOrBroken(item)) return <MuxPreparingPoster ... />;  // early return
  if (isMuxPreparing(item))        return <MuxPreparingPoster ... />;  // early return

  const videoRef = useRef(...);          // hooks start here
  const [muted, toggleMute] = useVideoMute();
  // ... 10+ more hooks
}
```

If the same `<FeedVideo>` instance ever transitions across Mux states (preparing → ready via Phase 3B realtime reconciliation, ready → errored, ready → preparing, etc.), the number of hooks invoked changes between renders. React throws:

> Rendered fewer hooks than expected. This may be caused by an accidental early return statement.

This is a real regression from Phase 4 and will fire the first time a feed item open at the moment of webhook reconciliation flips state.

## LightboxPreview scan — clean

`src/components/media/LightboxPreview.tsx` was scanned for the same pattern. All Mux predicate checks (`isMuxErroredOrBroken`, `isMuxPreparing`) live inside the JSX return as a ternary (line ~286+), **after** all 6+ hooks have run. No early-return-before-hooks. No change required.

## Fix (one file)

Split the early-branch UI out of `FeedVideo` into an internal `FeedVideoPlayer` so hook order stays stable.

1. Rename the existing `FeedVideo` body to `FeedVideoPlayer` — same props, owns all hooks and the `<video>` element.
2. Reintroduce `FeedVideo` as a **zero-hook** dispatcher above it:

   ```tsx
   export function FeedVideo(props: FeedVideoProps) {
     const { item, className, objectFit = 'contain' } = props;
     if (isMuxErroredOrBroken(item)) {
       maybeEmitBrokenReady(item, (e, p) => analytics.track(e, p));
       return <MuxPreparingPoster item={item} className={cn('rounded-md', className)} objectFit={objectFit === 'contain' ? 'contain' : 'cover'} />;
     }
     if (isMuxPreparing(item)) {
       return <MuxPreparingPoster item={item} className={cn('rounded-md', className)} objectFit={objectFit === 'contain' ? 'contain' : 'cover'} />;
     }
     return <FeedVideoPlayer {...props} />;
   }
   ```

3. Because React identifies components by element type, switching between `<MuxPreparingPoster>` and `<FeedVideoPlayer>` unmounts/mounts a fresh tree on either side of every transition. Hook count inside `FeedVideoPlayer` is invariant for its lifetime — Rules of Hooks satisfied by construction.

4. Minor cleanup: replace the inline poster ternary on the `<video>` tag with `muxPosterUrl(item)` for parity with `LightboxPreview`.

## Files touched (1)

| # | File | Change |
|---|---|---|
| 1 | `src/components/media/FeedVideo.tsx` | Rename inner function → `FeedVideoPlayer`; add zero-hook `FeedVideo` dispatcher; swap inline poster URL for `muxPosterUrl(item)`. |

No new files, no prop changes, no call-site changes, no new deps.

## Locked branching order preserved

```
errored-or-broken → preparing → (FeedVideoPlayer handles playable + legacy)
```

`renderBranching.test.ts` still describes the full 5-state matrix.

## Verification

1. **TypeScript** — `tsc --noEmit` clean.
2. **Static check** — `FeedVideo` body contains zero `use*(` calls; only branches + `<FeedVideoPlayer ... />`.
3. **Functional smoke**
   - Legacy `.mp4` → plays as before.
   - Mux ready+playback_id → HLS plays.
   - Mux preparing → preparing poster, no `<video>` mounted.
   - Mux errored → errored poster.
4. **🚧 Bidirectional hook-order regression gate** (the key new check)
   - **Forward**: open a preparing post, trigger reconciliation flipping `mux_status` to `ready` → must transition to playing HLS with **no** "rendered fewer hooks" console error.
   - **Reverse a**: ready → preparing (simulate by mutating cached item) → must transition back to preparing poster cleanly.
   - **Reverse b**: ready → errored → must transition to errored poster cleanly.
   - **Reverse c**: ready → ready-but-broken (drop `mux_playback_id`) → must transition to errored poster and fire `mux_ready_without_playback_id` exactly once.
   - All four transitions verified in the same browser session (single `FeedVideo` instance lifetime) with the console open. Before this fix, the forward case throws; after, all four are clean.
5. **iOS handoff** — unchanged (`LightboxPreview` not touched).
6. **Bundle** — no new chunks, no new deps.

## Rollback

Revert the single file.

---

Approve to implement. After verification you'll define Phase 5 scope.
