# Unavailable composer Mux video recovery — 2026-10-25

- Frontend-only recovery covers Post, Review and Timeline create/edit. The database attachment barrier remains the sole save authority; no preflight, heartbeat, lease, retention or cleanup changes.
- Recognizes the known `video_unavailable` signal or exact `mux asset has been removed` detail, including wrapped causes, not arbitrary `P0001` failures.
- Rejected upload IDs are UI-only state, independent of text, ratings, answers, photos, trusted media and frozen/local preview registries. Submission stays blocked for that upload, including keyboard submission. Removing it or completing a different upload unblocks normal readiness validation.
- Recovery replaces the healthy-looking player only for the rejected video. Other attachments stay. Replace uses the existing uploader with a video-only picker; cancellation/failure retains the old blocked tile, and successful handoff clears transfer state even though the replacement uploader unmounts.
- Review returns to its media step after rejection. Phone-sized views scroll to media when offscreen and respect reduced motion. Toasts use the approved variable-timing copy.

## Verification

- 59 focused tests passed: all six real submit handlers with simulated barrier responses, draft/photo preservation, unrelated text edits remain blocked, replacement gets a different ID in the next payload, unrelated save errors preserve existing behavior; conservative parser and existing readiness/upload/preview regressions.
- Browser visual fixture renders the real recovery components at 1280×1800 and 390×844. Error and actions fit without horizontal overflow; Remove retains draft and enables submission. Screenshots under `/tmp/browser/video-recovery/` (not a production session).
- Preview build/typecheck reports `build OK`.
- Authenticated real-Mux end-to-end acceptance remains owner QA: this project uses external unmanaged Supabase, so an authenticated sandbox session is unavailable. No real uploads, saves, deletions or flag changes were performed.
- Backend TTL, queue, 24h grace, worker, rescue, destructive barrier and historical assets were not edited.