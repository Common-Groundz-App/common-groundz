# Post video — two manual-QA refinements (lightbox return + post-edit feed player)

Scope: Posts only. No changes to Reviews/Timeline, composer upload, database, Edge Functions, analytics, Mux assets, the two-source loading budget, autoplay selection or mute behavior.

## Issue 1 — Lightbox: going video → photo → back to the video restarts it paused at 0:00

Expected: coming back to the video inside the lightbox continues from where it was left, in the same play/pause state the user left it in (it was playing, so it keeps playing), with the shared mute setting.

Plan:
1. Confirm the cause first in the lightbox: check whether navigating away unmounts the video element (losing its position) and whether the return path is treated as a "non-entry item" so neither the handoff seek nor autoplay runs. The diagnosis is not confirmed yet; this step names it before any change.
2. Inside the lightbox, remember per media item (by stable media ID, falling back to position only for ID-less items) the last position and whether it was playing when the user navigated away.
3. On return to that item, reuse the existing one-time seekability-aware seek and play path (same helper used for the feed→lightbox handoff); do not add a new unmute path; muted-fallback stays as-is.
4. The feed→lightbox entry handoff and the lightbox→feed exit resume stay unchanged. Exit resume still applies only if the user closes on the item they opened from; the remembered in-lightbox position updates what is handed back.
5. Memory is cleared when the lightbox closes.

## Issue 2 — After editing a post to remove its photo, the feed video is stuck paused and the Play button does nothing (lightbox works; refresh fixes it)

Expected: after saving an edit, the feed card behaves exactly like a freshly published post — video autoplays per normal rules and the Play button works.

Plan:
1. Confirm the cause first: after the edit, the card re-renders with new media (media count/layout changes from collage to single video). Check whether the old player's registration with the feed video manager / loading budget is left behind (stale slot, stale loading reservation, or stale pin) while the new player is registered under the same stable slot ID, leaving the new player without a source or never selected. Record the actual cause before changing code.
2. Fix at the category level: when a feed player for a slot unmounts and a new one mounts for the same slot (layout change after edit), the old registration, loading reservation, pending Play request and generation are fully released, and the new player registers fresh — the same state as first mount on a newly published post.
3. Manual Play on that card must obtain activation and loading permission through the existing coordinator (no budget bypass).
4. Check sibling paths with the same assumption: post edit from the post detail page and profile feed.

## Tests
- Rendered: lightbox video → photo → back resumes at the remembered time and playing state; paused stays paused; mute preserved; ID-less fallback.
- Rendered: feed card whose media changes from photo+video to video-only re-registers cleanly, receives a loading reservation, autoplays per rules, and Play works; no leftover slot/reservation from the old player; two-source cap still holds.
- Existing handoff, budget, selection and Review/Timeline tests unchanged and passing.
- Full Vitest suite + typecheck; then stop for manual QA of both scenarios on desktop and phones.

## Technical notes
- Likely files: `src/components/media/LightboxPreview.tsx`, `src/components/media/FeedVideo.tsx`, `src/hooks/useFeedVideoManager.tsx`, `src/hooks/feedVideoLoadBudget.ts`, `src/components/media/FeedCollage.tsx`.
- Reuse `lightboxHandoffSeek.ts` and `mediaIdentity.ts`; no new playback mechanism.
