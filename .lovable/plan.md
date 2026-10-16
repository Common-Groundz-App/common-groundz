# Mobile feed video reliability (iPhone + Android)

Goal: a visible feed video starts playing on phones, with no regression on desktop. The normal desktop path is unchanged, but the fallback applies at every screen size, so a short desktop window where no video reaches 60% may now activate one. This is a testable fix for the shared symptom (a tall video on a phone screen may never reach 60% visible). It is not yet proof of the root cause. Automated tests check the logic; only real-device checks can confirm mobile playback.

## What changes

1. **Active video selection**
   - The normal rule stays: a video that is at least 60% visible can become active.
   - If no video reaches 60%, choose exactly one fallback: the most visible video at 35% or more, closest to the screen center.
   - Precedence (defined and tested):
     - A 60%+ candidate always replaces a 35–59% fallback once it qualifies (the existing hysteresis still applies between two 60%+ candidates).
     - Between two fallback candidates, the current one stays until a challenger beats it by the existing hysteresis margin.
     - Below 35%, nothing becomes active through the fallback.
   - The same rule applies at every feed position and screen size. No top-of-feed or browser-specific exception.

2. **No circular waiting**
   - Choosing the active video, getting a loading slot and calling play do not wait for the browser to report a ready frame (`loadeddata`/`canplay`). Those events only decide when the poster is replaced by the video frame.
   - Browser frame readiness stays separate from Mux processing readiness (`status === 'ready'`).

3. **Poster-first display**
   - A valid poster stays visible while the video is waiting or buffering. The skeleton is used only when there is no poster.
   - A small spinner shows only while an active video is actually buffering.
   - The frame is revealed once one is available, including on a paused video.

4. **Manual Play as a saved user request**
   - A Play button is available before the video has loaded.
   - When tapped:
     - the request is saved as `userRequestedPlay` for that exact stable slot;
     - activation is requested through FeedVideoManager;
     - a loading slot is requested through the existing Fix 2 coordinator (two-source cap unchanged);
     - if the source is already attached, play is called immediately;
     - otherwise play is called as soon as the source is attached. It does not wait for `loadeddata`, `canplay` or a decoded frame, because on mobile the play call itself may be what makes the browser load those. Readiness events (`loadeddata`/`canplay`/`playing`) only control when the poster is swapped for the video and the buffering display.
   - We do not assume a delayed play call still counts as the original tap. If play is rejected, the existing muted fallback applies. If that also fails, the Play button stays usable and the failure is not hidden.
   - The saved request is cleared when the user pauses or cancels, another slot becomes active, the item is removed, or the component unmounts.
   - Tapping Play does not open the lightbox (the event does not bubble to the card or tile click).

5. **Unchanged**
   - Global mute and session-sound behavior; no `defaultMuted` as a second source.
   - `preload="metadata"`.
   - The hard two-source loading cap, handoff pins and grace.
   - One video playing at a time.
   - Lightbox behavior and Fix 1 ordering.
   - No desktop regression (normal 60% path unchanged).
   - Saved paused intent and the Fix 2 generation guards.
   - Composer, Reviews/Timeline, database, analytics, Mux assets.

6. **Diagnostics**
   - `[feed-video-mobile]` logs appear only in development or with an opt-in debug flag.
   - Logged on events only, not per frame: visibility ratio, selected/active id, fallback used, load reservation, HLS path (native or hls.js), readiness events, play result.
   - No signed URLs or tokens are logged.
   - The logs are removed or turned off after device verification.

## Tests

- Selection logic: single fallback; 60% overrides fallback; competing fallbacks with hysteresis; below-35% ignored; tall-card geometry.
- Rendered: a loading video becomes active, gets a loading slot and calls play before any readiness event.
- Rendered: poster stays visible while waiting; skeleton only without a poster; spinner only while active and buffering.
- Manual Play: saved request when the source is not attached, play once attached; immediate play when attached; rejection falls back and the button stays usable; request cleared on pause, slot change, removal or unmount; budget never goes past two; tap does not open the lightbox.
- Paused intent survives reselection; lightbox handoff regressions still pass.
- Then the full Vitest suite and typecheck, with actual results reported.

## Device checklist (after implementation)

Run on Android Chrome, iPhone Safari, iPhone Chrome and desktop Chrome:
- cold entry
- restored scroll
- forward and back scrolling
- tall portrait posts
- manual Play recovery
- mute toggle
- lightbox open and close

Pass condition: playback actually starts, not just a poster in place of the skeleton.

## Technical notes

- Selection lives in the existing FeedVideoManager visibility path. The fallback is computed from the same geometry, after the 60% pass finds no candidate.
- The pending play request is a per-slot ref in FeedVideo. It is checked when the source attaches and on readiness events, with generation guards from Fix 2 so stale callbacks are ignored.
