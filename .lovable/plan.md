# Step 3D complete — plan for 3E (remove the old popup)

## 3D is done
Your signed-in test passed every check, including the final three:
- Old `?compose=update` link: owner → your timeline page; non-owner → normal entity page.
- Switch off mid-draft: draft survived, Save worked; new taps used the popup.
- Timeline Undo/Delete still work inline in the read-only viewer.

3D is complete and verified. Remaining bookkeeping (marking it in the verification doc and roadmap) happens as the first step of 3E.

## What 3E is
Now that the review page is proven with the switch ON, we remove the old system so there is only one way to write reviews. After 3E the switch is gone and the page is simply how reviews work.

## What changes for you
- The rollout switch disappears from the admin page — the review page is always on.
- The old popup form is deleted. Every review button keeps doing exactly what it does today with the switch ON.
- Old `?compose=update` and `?compose=review` links stop doing anything special — they just show the normal entity page.
- Nothing else changes: timelines, delete, visibility, the one-hour edit rule, photo cleanup (D2) and the admin cleanup tab all stay as they are.

## How it works
1. Mark 3D complete in `docs/verification/review-composer-3d.md` and the roadmap.
2. Delete the legacy popup composer (ReviewForm and its dialog wiring) and the legacy inline timeline form in the viewer.
3. Delete the switch: the `composer_page_enabled` config key, `useReviewComposerImplementation`, `useReviewComposerNavigate`'s legacy branch, and `resolveComposerTarget`'s 'legacy' result — entry points navigate directly.
4. Remove the `?compose=review` / `?compose=update` handling from EntityV4.
5. Remove the popup hand-off helper (`openExistingReviewTimelineUpdate`) and any now-dead code, tests and doc references.
6. Update tests: 3D's on/off matrix collapses to the page-only path; inventory test asserts the popup is gone.

## Checks
- Full test suite, type check and build.
- Browser checks (fake sign-in, writes blocked) at phone and desktop width: every entry point opens the page; old compose links show the entity page; no popup code remains.
- Your signed-in spot-check: write, edit, add update, edit update, timeline undo/delete — same flows you just ran.

## Not included
- Any change to photo cleanup (D2), the weekly sweep, or the admin tab.
- Video for reviews.
- Any database change.
