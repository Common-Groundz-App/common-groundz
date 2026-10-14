# Composer video readiness — implementation verification

Date: 2026-10-14. Stops before Post Phase 3.

## Delivered
- Posts and the new Review/Timeline pages, including edit modes, block new/replacement Mux publishing until owner-visible server truth reports Ready with asset/playback identity and valid duration up to 60 seconds.
- Actual upload progress is separate from indeterminate processing. Local composer previews remain local; verified Ready previews use the shared player without view counting. Review preview media order is preserved.
- Failed, too-long and incomplete-ready states block publishing. Removing the new video frees the slot without removing text. Kept saved videos retain their previous save contract, including when Review videos are OFF.
- Owner/composer status rechecks are bounded and visibility/online guarded. No feed/viewer-wide polling was added.
- Successful saves retain their identity and read persisted media after the existing linking step. Readback/linking problems report saved status rather than inviting a duplicate insert. Ambiguous saves retain the existing evidence flow.
- Readiness does not extend edit windows; server rejection retains the draft. Existing server rules, legacy forms, historical Post exclusions and Mux assets are unchanged.

## Checks performed
- Full automated suite: **1092 passed, 3 skipped**, 80 files.
- Controlled hook tests cover initial/realtime readiness, duration, stale fetches, selection removal, reconnection/manual recheck and cleanup.
- Shared readiness tests cover six composer modes, replacements versus kept videos, invalid Ready states, too-long/failure blockers and composer-only preview projection.
- Actual Timeline page tests (mocked owner/status/save responses): create/edit transfer and processing gates, Ready preview, duplicate clicks, failed-video removal with text retained, post-insert readback failure without another insert, and Ready-after-expiry rejection with draft retained.
- Preview harness reports build OK; public browser screens produced no runtime errors. `/create` correctly redirected while signed out. This public smoke is **not** signed-in composer verification.

## Explicitly pending
- Authenticated real-Mux upload → processing → Ready → publish → destination playback round-trip across Post/Review/Timeline create and edit. Managed test-session restoration is unavailable (`external_unmanaged`); no credentials requested, no real uploads performed, no Review-video setting changed.
- Controlled hook/page tests do not establish live Mux or hosted authenticated behavior. Do not treat this implementation as real-Mux acceptance.
- Phase 1 true simultaneous race overlap remains unverified. Post Phase 3 atomic linking and broader viewer refresh remain outside this change.