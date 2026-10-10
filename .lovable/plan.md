# Step 3D — send every review button to the new review page

This follows the 3D plan you approved earlier for reference. The plan stays the same. One change: the old popup is going away soon and there are no users yet, so the "switch off" path only needs to keep today's behaviour. It does not need new checks of its own.

The rollout switch stays OFF while this is built. You turn it on after you've tested it signed in.

## What changes for you (once the switch is on)
- **Write a review, edit a review, add an update, edit an update:** every button opens the full review page instead of the popup. That covers the home "+" button, the entity page (write / already reviewed / the "add update" link), review cards, the owner "..." menu, the profile reviews tab and the timeline.
- **Timeline:** becomes read-only. "Add update" and "Edit" open the page. Undo and delete stay where they are.
- **After Save:** you land on the entity page. After an update, the timeline reopens once.
- **After Cancel:** you go back to where you came from. If that's unknown, you go to the entity page or Home.
- **Switch off:** everything works exactly as it does today, with the popup.
- Delete, visibility and admin moderation don't change.

## How it works
1. **One routing decision.** A single helper takes the action and the switch state and returns either "go to this page" or "use the popup". While the switch is still loading, the first tap waits and later taps are ignored. If loading fails, the popup is used. One tap never does both.
2. **Every button uses that helper:** SmartComposerButton, EntityV4, ReviewsSection, ReviewCard, ReviewOwnerMenu, ProfileReviews, ReviewTimelineViewer and openExistingReviewTimelineUpdate. A final search confirms no other button opens the popup.
3. **Page gate.** The temporary "admins can always open it" rule is removed, so the page follows the switch only. A page that is already open stays usable if the switch turns off mid-session: your draft, Save and Cancel keep working.
4. **"Add update" link on the entity page.** The review owner goes to the add-update page. Anyone else goes to the entity page.

## Checks
- Tests: the routing helper for every action with the switch on, off, loading and failed; each button goes to the page when the switch is on; the timeline is read-only when it's on; the admin-only rule is gone; an open page survives the switch turning off; no double action while loading.
- Browser at phone and desktop width, with a faked sign-in and saving blocked: every button with the switch on, plus a quick spot check with it off.
- Full test suite, type check and build.
- Then your signed-in checklist: turn the switch on, try every button, turn it off and confirm the popup is back. 3D counts as done only after your check.

## Not included
- Turning the switch on (you do that after testing).
- Deleting the popup and the switch (that's 3E).
- Video for reviews.
- Any change to the database or the photo cleanup.

## Technical details
- New `src/services/review/composerRoutes.ts`: a pure function `resolveComposerTarget(action, implementation)` for write/editReview/addUpdate/editUpdate. It returns `{ to, state }` or `'legacy'`. A thin hook `useReviewComposerNavigate` sits on top of the existing `useReviewComposerImplementation` and is the only reader of the switch.
- Page addresses come from the persisted entity and parent slugs, plus the one-time state marker for the timeline reopen. The 3B/3C origin rules are reused.
- `ReviewComposerPage.tsx`: drop the admin branch of `canUseReviewComposerPage`, and remember the switch state only after it has been confirmed on.
- `ReviewTimelineViewer.tsx`: only the switch-on path changes.
- The list of buttons is recorded in `docs/verification/review-composer-3d.md`. Roadmap updated.
