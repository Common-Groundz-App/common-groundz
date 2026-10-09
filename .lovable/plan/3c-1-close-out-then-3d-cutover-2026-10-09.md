# 3C.1 close-out, then 3D cutover

Strict order, each approved separately: **3C.1 (this approval) → your review of the 3C.1 report → photo cleanup (separate approval) → 3D (separate approval) → your signed-in cutover/rollback test → 3E later.** Approving this plan starts 3C.1 only. The cleanup and 3D sections below are kept for reference and are not carried out.

## Correction from the 3C report

The 8 leftover photos are not invisible: they are in a public photo bucket, so anyone who has the exact web address can open them. Nothing in the app links to them, so they can't be found by browsing.

---

## Step 3C.1 — finish 3C (no routing changes)

1. **Remove the rating "Clear" button** from the timeline page, so it matches today's timeline form exactly. Update the parity table and tests.
2. **Browser-test the two untested cases** on the timeline pages (faked sign-in, writes blocked), at phone and desktop width:
   - the "couldn't confirm" panel: Add (newest entry shown, "Try again" warns about a second update) and Edit (that same update re-checked, edit-specific warning);
   - rapid double-Back on both timeline pages.
   Results are reported as passed or failed. If rapid double-Back escapes, I report it and you decide: accept it as a known limit, or ask for a fix. It is not moved to 3E silently.
3. **Rollout switch:** you turn it OFF in the admin panel (or approve a one-line reset). It stays off through 3D until you approve turning it on.
4. Full tests, type check, build; verification notes and roadmap updated; 3C marked complete only when 1–3 pass.

## Separate cleanup action — the 8 leftover photos (needs your explicit approval)

- Exact list: 4 files under session `8162b991…` (Oct 6, 3B photo-limit test), 2 under `8d661012…` and 2 under `3acac8bc…` (Oct 8, 3C adds). The full file paths are listed for you before anything is deleted.
- Re-check right before deletion that no review, timeline update, post or entity references any of them.
- Delete through the storage service (not by editing the database directly), then confirm that they are gone and that the saved photos in the same folders are still there.
- Not part of any code change. Future leftovers from closed tabs need a server-side sweep (separate future work).

---

## Step 3D — switch normal entry points to the page (revised)

Built with the switch OFF. Turned on only after you approve the tested cutover.

### 1. One flag source, one pure routing decision
- The only flag reader is the existing `useReviewComposerImplementation`. Loading or failure means legacy.
- A pure helper: `action + implementation → { page address + state } | legacy`, for write review, edit review, add update and edit update. No second flag-reading path.
- While the flag is loading, a tap becomes **one** pending action and the button shows as busy/disabled; further taps are ignored. When the flag resolves, that action runs once (page or legacy); if loading fails, the legacy action runs once. One click never opens the legacy popup and also goes to the page.

### 2. Entry-point inventory (exhaustive)
- Every review / timeline composer entry point found by searching the code is listed in the verification notes (starting set: home "+" button, entity page write / already-reviewed / `?compose=update`, entity reviews list and timeline cards, shared owner menu, profile reviews tab, timeline viewer add/edit, the popup's own "add update" hand-offs).
- For each one: correct review/update ids passed, ownership and the one-hour edit rule unchanged, and a test that it goes to the page when the switch is on and does exactly today's action when it is off.
- Delete, visibility and admin moderation stay where they are.

### 3. Return navigation, per action
| Action | Save | Cancel |
|---|---|---|
| Write review | entity page of the saved review | known in-app origin, else Home |
| Edit review | entity page | known origin, else entity page |
| Add / edit update | entity page + timeline reopens once | entity page + timeline reopens once |
- "Origin" is only an address the app itself passed in, never assumed from browser history. The one-time reopen marker and safe fallbacks stay as built in 3B/3C.

### 4. Timeline viewer when the switch is on
- Read-only timeline; "Add Timeline Update" and per-update "Edit" become links to the page. Undo/delete stays.
- Switch off: exactly today's viewer with its form.

### 5. Gate and rollback
- Remove the temporary "admins always allowed" gate; the page follows the switch only.
- **Open sessions are latched — only after the switch is confirmed on:** route opens → switch state resolved successfully → confirmed "page" → only then the session is latched. Loading, failure or the release default never latch anything just because the page mounted. A latched composer keeps working if the switch later turns off: dirty, saving or "couldn't confirm" forms are never replaced by "Not available yet" and can still Save or Cancel. New direct `/review…` visits and all buttons follow the switch at once.
- `?compose=update`: on → owner goes to `/review/:id/timeline/new`, others to the entity page; off → unchanged.

### 6. Checks
- Tests: helper for every action × on/off/loading/failure; each inventoried entry point; viewer read-only on / unchanged off; gate removed; latched session survives switch-off; no double action during loading.
- Browser (faked sign-in, writes blocked) at 390 and 1280: every entry point with on and off; switch turned off mid-session (draft kept, Save/Cancel work); return navigation per the table; Back/Forward.
- Full suite, type check, build. Signed-in cutover and rollback checklist for you. 3D is done only after your check; 3E needs your sign-off and no open blockers, not just a week passing.

## Technical details
- 3C.1: edit `TimelineComposerScreen.tsx` (remove Clear), extend `scripts/e2e/review-timeline-3c.py` (timeout via delayed fake responses; rapid Back), docs and roadmap.
- Cleanup: storage API removal of 8 listed objects in `post_media` after a fresh reference query.
- 3D: new `src/services/review/composerRoutes.ts` + thin hook; call-site edits per the inventory; `ReviewComposerPage.tsx` drops `canUseReviewComposerPage`'s admin branch and latches the switch value at mount; `ReviewTimelineViewer.tsx` gets an on-branch only.
- No database schema changes; no AGENTS.md changes.
