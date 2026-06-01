## Phase 3.1 v2.4 — Final plan

This is the final clean scope for the bug you reported.

### Goal
Restore the intended feed behavior:
- Fresh app/page open: first active feed video autoplays muted and the icon shows muted.
- If the user unmutes in the feed, later feed videos in the same session should try to autoplay with sound.
- If the browser blocks that unmuted autoplay, only that video falls back to muted; the session preference stays intact.
- Refresh/new session starts muted again.

## What will change

### 1) `src/hooks/useVideoMute.ts`
Add a small in-memory session flag for feed sound unlock.

#### New module state/helpers
- `feedSessionSoundEnabled = false` on page load
- `isFeedSessionSoundEnabled()`
- `markFeedSessionSoundEnabled()`
- `markFeedSessionSoundDisabled()`
- a small window event so `useVideoMute()` subscribers re-render when the session flag changes

#### `useVideoMute()` behavior
Keep the persisted store exactly as the raw global mute preference, but expose an effective UI value:

```ts
effectiveMuted = persistedMuted || !feedSessionSoundEnabled
```

That gives us:
- old `localStorage video.muted = false` + fresh session → UI still shows muted
- after user unmutes in this session → UI shows unmuted

#### `toggle(next?)` rule
`toggle()` must operate from the effective value, not just raw localStorage.

Behavior:
- user unmutes → `markFeedSessionSoundEnabled()` + `setGlobalVideoMuted(false)`
- user mutes → `markFeedSessionSoundDisabled()` + `setGlobalVideoMuted(true)`

This avoids the cold-open bug where persisted `false` could otherwise make the first speaker tap behave incorrectly.

### 2) `src/components/media/FeedVideo.tsx`
Update only the manager-driven autoplay branch.

Current bug source is here:
```ts
el.muted = readGlobalVideoMuted();
el.play();
```

That lets stale persisted `false` attempt autoplay with sound on a fresh load, which browsers may block.

#### Replace with session-gated autoplay intent
Managed autoplay should use:

```ts
const shouldTryUnmuted =
  isFeedSessionSoundEnabled() && !readGlobalVideoMuted();
const wantMuted = !shouldTryUnmuted;
el.muted = wantMuted;
```

#### On `play()` rejection
If `play()` rejects with `NotAllowedError` while `shouldTryUnmuted` is true:
- guard against stale async state first
- retry muted for that video only

Required stale guards:
```ts
if (!slotIsActiveRef.current) return;
if (videoRef.current !== el) return;
if (typeof document !== 'undefined' && document.hidden) return;
if (userPausedRefManaged.current) return;
```

Then:
```ts
el.muted = true;
markSystemPlay();
el.play();
```

Do not:
- call `setGlobalVideoMuted(true)` in this fallback
- call `markFeedSessionSoundDisabled()` in this fallback

### 3) Keep these paths unchanged
No changes to:
- `src/hooks/useFeedVideoManager.tsx` — already has shared `computeSlotVisibility()` and the manual promotion logic is correct
- lightbox reverse handoff mute behavior
- `requestActivate` / manual play promotion
- Mux/HLS logic
- Phase 2 resume store
- Phase 3 manual pause intent
- composer/upload/admin/DB code

## Important scope clarification
I audited usage of `useVideoMute` / mute helpers.

Relevant consumers found:
- `FeedVideo.tsx`
- `PostMediaDisplay.tsx` (raw read/write only for lightbox exit handoff)
- `useVideoAutoplay.ts` (legacy unmanaged autoplay path)

`useVideoMute()` is not widely used across unrelated surfaces, so changing its returned value to the session-aware effective muted state is safe for this patch.

Also, the actual feed speaker button lives in `FeedVideo` and already uses `useVideoMute()`:
```ts
const [muted, toggleMute] = useVideoMute();
```
So the session-unlock path stays consistent for the feed controls.

## Technical details

### `useVideoMute.ts`
Implement roughly this shape:

```ts
const STORAGE_KEY = 'video.muted';
const EVENT = 'video-mute-change';
const SESSION_EVENT = 'video-session-sound-change';

let feedSessionSoundEnabled = false;

export const isFeedSessionSoundEnabled = () => feedSessionSoundEnabled;
export const markFeedSessionSoundEnabled = () => { ...dispatch SESSION_EVENT... };
export const markFeedSessionSoundDisabled = () => { ...dispatch SESSION_EVENT... };
```

`useVideoMute()`:
- keep a state for raw persisted muted
- subscribe to both `EVENT` and `SESSION_EVENT`
- compute `effectiveMuted`
- return `[effectiveMuted, toggle]`

`toggle(next?)`:
```ts
const currentEffective = readInitial() || !isFeedSessionSoundEnabled();
const value = typeof next === 'boolean' ? next : !currentEffective;
if (value) {
  markFeedSessionSoundDisabled();
  setGlobalVideoMuted(true);
} else {
  markFeedSessionSoundEnabled();
  setGlobalVideoMuted(false);
}
```

### `FeedVideo.tsx`
Only change the managed autoplay effect around the `canAutoplay` branch.

Use:
```ts
if (el.paused) {
  const shouldTryUnmuted =
    isFeedSessionSoundEnabled() && !readGlobalVideoMuted();
  const wantMuted = !shouldTryUnmuted;
  try { el.muted = wantMuted; } catch {}
  markSystemPlay();
  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err: any) => {
      const name = err?.name;
      if (name === 'AbortError') return;
      if (name === 'NotAllowedError' && shouldTryUnmuted) {
        if (!slotIsActiveRef.current) return;
        if (videoRef.current !== el) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        if (userPausedRefManaged.current) return;
        try { el.muted = true; } catch {}
        markSystemPlay();
        const p2 = el.play();
        if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
        return;
      }
    });
  }
}
```

## Hard rules for this patch
- No `localStorage` writes at module import.
- Only the user mute/unmute toggle flips the session flag.
- Explicit user mute clears the session flag.
- Autoplay fallback never clears the session flag.
- Autoplay fallback never rewrites the global mute store.
- Keep all other playback systems untouched.

## Known acceptable limitation
If the browser blocks a later unmuted autoplay, that one video may temporarily be muted while the icon still represents the user’s session preference. That is acceptable for this patch because preserving session intent is more important than resetting the whole feed back to muted.

## Verification checklist
1. Clear storage, reload → first dominant feed video autoplays muted, icon muted.
2. Set `localStorage['video.muted']=false`, reload → still autoplays muted, icon muted.
3. Tap speaker in feed → current video unmutes.
4. Scroll to next feed video → it tries unmuted autoplay.
5. If browser blocks that attempt → that video retries muted only; session/global preference remains unchanged.
6. Tap speaker again to mute → next videos autoplay muted.
7. Refresh → cold open muted again.
8. Manual play promotion still works.
9. Phase 1 single-active still works.
10. Phase 2 resume and Phase 3 manual pause still work.