# 3C closed — orphan-photo cleanup preparation (no deletion yet)

3C is complete. The rapid double-Back escape is accepted as a documented limitation of the current browser-history guard; no router redesign is part of this project.

## 3C close-out record (done, for reference)

- Rating "Clear" button removed from the timeline page; it now matches today's timeline form exactly.
- Browser tests passed: the "couldn't confirm" panel (Add and Edit), normal Back, Keep editing, Cancel, reload.
- **Accepted known limitation:** two browser Back presses fired almost simultaneously can escape the warning. All normal paths are protected: single Back, repeated Back after "Keep editing", Cancel, in-page links, reload/tab close, and the dirty / saving / couldn't-confirm states. Documented in the verification notes. If it ever proves to be a real user problem, navigation architecture is a separate project.
- Full suite, type check and build clean; verification notes and roadmap updated; 3C marked complete.

## This approval — orphan-photo cleanup PREPARATION only (no deletion)

1. List the exact full storage paths of the 8 leftover photos: 4 under session `8162b991…` (Oct 6, 3B photo-limit test), 2 under `8d661012…` and 2 under `3acac8bc…` (Oct 8, 3C adds).
2. Immediately re-check that none of those exact objects is referenced by any review, timeline update, post, entity, or other media reference.
3. Report the list and the reference-check result.
4. **Delete nothing.** Stop for your approval.

Deletion (through the storage service, with a post-delete confirmation that the 8 are gone and neighbouring saved photos are intact) is a separate approval after you see the report.

## Reminder — 3D comes after the cleanup (separate approval)

The revised 3D cutover plan stands as approved-in-principle: one flag source, one pure routing decision, exhaustive entry-point inventory, per-action return navigation, read-only timeline viewer when the switch is on, session latching only after the switch is confirmed on, gate and rollback behaviour, full tests and browser checks with the switch off. 3D is not started by this approval.

## Technical details
- Cleanup prep: storage listing of the three session folders in `post_media` + fresh reference queries across reviews, review_updates, posts and entities. Read-only.
- No code changes, no database changes, no AGENTS.md changes in this step.
