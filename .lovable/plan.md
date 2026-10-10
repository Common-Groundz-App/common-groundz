# Step 3D — send every review button to the new review page

This follows the 3D plan you approved earlier for reference, with the reviewers' corrections added. The rollout switch stays OFF while this is built. You turn it on after your signed-in test.

## What changes for you (once the switch is on)
- **Write a review, edit a review, add an update, edit an update:** every button opens the full review page instead of the popup. That covers the home "+" button, the entity page (write / already reviewed), review cards, the owner "..." menu, the profile reviews tab, the timeline, and the popup's own "add update" hand-off.
- **Timeline:** becomes read-only. "Add update" and "Edit" open the page. Undo and delete stay where they are.
- **Switch off:** everything works exactly as it does today, with the popup.
- Delete, visibility, admin moderation, the one-hour edit rule and the "only the newest update can be edited" rule don't change.

## Where you land after Save or Cancel (same as the earlier approved table)
| Action | Save | Cancel |
|---|---|---|
| Write review | entity page of the saved review | where you came from (if the app knows it), else Home |
| Edit review | entity page | where you came from, else entity page |
| Add / edit update | entity page, timeline reopens once | entity page, timeline reopens once |

"Where you came from" means only a page the app itself passed along, never a guess from browser history.

## Page addresses
- The review page addresses keep using permanent database IDs: `/review`, `/review?entityId=<entity ID>`, `/review/<review ID>/edit`, `/review/<review ID>/timeline/new`, `/review/<review ID>/timeline/<update ID>/edit`.
- The entity's web-address name (slug) is used only to build the entity page you return to. It is never used to find the review or update.

## Old "add update" links (`?compose=update`)
- Switch on, and you own the review: you go to `/review/<review ID>/timeline/new`.
- Switch on, and you aren't the owner or the link is invalid: you see the normal entity page.
- Switch off: works exactly as it does today.
- This compatibility goes away in 3E together with the popup.

## How it works
1. **One routing decision.** A single helper takes the action and the switch state and returns either "go to this page" or "use the popup".
2. **Taps while the switch is loading.** The first tap waits, and the button shows as busy. Later taps are ignored. That waiting tap is cancelled if you leave that screen or the review it was for changes. If loading fails, the popup is used once. One tap never does both.
3. **Every button uses that helper:** SmartComposerButton, EntityV4 (including `?compose=update`), ReviewsSection, ReviewCard, ReviewOwnerMenu, ProfileReviews, ReviewTimelineViewer and openExistingReviewTimelineUpdate. A final search confirms nothing else opens the popup. The full list goes into the verification notes.
4. **Page gate.** The temporary "admins can always open it" rule is removed, so the page follows the switch only.
5. **Turning the switch off mid-session doesn't lose work.** An open review page stays usable: your draft, Save, Cancel and "couldn't confirm" all keep working. The page only stays open this way once it has confirmed the switch is on. A page that is still loading, or failed to load, never stays open this way. Opening a new page checks the switch again. An open popup or timeline form also keeps its draft if the switch changes. New taps follow the new setting right away.

## Checks
- **Tests:**
  - the routing helper for every action with the switch on, off, loading and failed;
  - every button goes to the page when the switch is on, and does exactly today's popup action when it's off;
  - one tap gives one action, and a waiting tap is cancelled when you leave the screen;
  - the `?compose=update` link for owner, non-owner and invalid review, with the switch on and off;
  - the timeline is read-only when the switch is on and unchanged when it's off;
  - the admin-only rule is gone;
  - an open page survives the switch turning off, and a new page checks the switch again.
- **Browser checks** at phone and desktop width, with a faked sign-in and saving blocked: every button with the switch on and with it off, the Save/Cancel table above, and Back/Forward.
- Full test suite, type check and build.
- **The earlier edit failure is already fixed and confirmed.** Your signed-in edit (removing 2 photos) saved during the cleanup test. Your checklist re-checks a text-only edit and a photo-removal edit on the page.
- **Your signed-in checklist:** turn the switch on and try every button, including the Save/Cancel destinations and an old "add update" link. Then turn it off and confirm the popup is back. 3D counts as done only after your check.

## Not included
- Turning the switch on.
- Deleting the popup, the switch or `?compose=update` (that's 3E).
- Video for reviews.
- Any change to the database or the photo cleanup.

## Technical details
- New `src/services/review/composerRoutes.ts`: a pure function `resolveComposerTarget(action, implementation)` that returns `{ to, state }` or `'legacy'`, with ID-based paths only.
- A hook `useReviewComposerNavigate` is the only reader of `useReviewComposerImplementation`. It keeps a pending-action ref tied to the target IDs, which is cleared on unmount or when the target changes.
- Return destinations use the existing persisted-slug builder and the one-time timeline-reopen state.
- `ReviewComposerPage.tsx`: drop the admin branch of `canUseReviewComposerPage`. Remember the switch state per session only after it is confirmed on.
- `ReviewTimelineViewer.tsx`: only the switch-on path changes. The legacy inline form keeps its mounted state.
- The list of buttons is recorded in `docs/verification/review-composer-3d.md`. Roadmap updated. No AGENTS.md changes.
