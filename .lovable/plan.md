# 3B audit: "too many photos" warning + why the location prompt didn't show

## What I checked (this turn)

- **Live site has the new code.** The commongroundz.co bundle includes the new page's subject card, the location-prompt rules and the leave warnings. Nothing is stale.
- **The prompt works in a reproduced run.** A test browser (fake sign-in, nothing saved) opened the new page with a **Place** called "Ambur", browser location permission at "Ask", `locationEnabled=false` and no snooze keys. On step 3 the "Location Access" card appeared and `locationPromptLastShown` was written at that moment.
- **The type and question set are right.** "Tell us about your place" on your screen comes from the Place question set, and that set has the location prompt switched on. So "is it a place?" and "is this type allowed?" both pass.
- **Storage keys match the popup:** `locationPromptLastShown`, `locationPromptLastSkipped`.
- **The snooze rule matches the popup exactly** (correcting my earlier wording): if a Skip time is saved, only the 2-hour rule applies. If not, the 24-hour "last shown" rule applies.

## Why it didn't show for you

Your screenshot rules out three causes: the subject type (it's a place), the app's location switch (`locationEnabled` is false), and the snooze keys (both are missing). The page writes `locationPromptLastShown` the moment it decides to show the card. That key is missing, so the page decided **not** to show it, before rendering anything.

Only one check is left that a screenshot can't show: **the browser's own location permission.** If Chrome reports it as "Allow" (granted), the prompt is skipped on purpose, on both the popup and the new page. Your storage has `lastPositionTimestamp`, which means this browser shared its location with the site before. So "Allow" is the likely state, even after a reset. One common reason: Chrome's "Reset permission" in the site-info panel doesn't always apply until every commongroundz.co tab is reloaded.

This is likely, not confirmed. The plan adds a way to see the exact reason on your own screen.

## What I'll build

1. **"Too many photos" warning (real bug, from 3B).** When you pick more photos than fit, show "Too many files selected — Only the first N files will be processed." It uses the same wording as the popup, and the popup itself doesn't change.
2. **Show the reason on screen, for admins only.** On the photos step, a small grey line for admins shows why the prompt is or isn't showing: type allowed yes/no, app location on/off, browser permission (ask/allow/block/unknown), snooze times, and the final decision. Other users never see it. It gets removed when the switch to the new page goes live for everyone, together with the other temporary admin pieces.
3. **Regression tests:**
   - Place, location off, permission "Ask", no snooze keys → the prompt card appears on step 3, and "last shown" is saved at that moment.
   - The same, but permission "Allow" → no card. Location on → no card. Movie/book → no card.
   - Skip saved 1 hour ago → no card. Skip saved 3 hours ago → card.
   - The two photo-limit cases.
4. **Browser check:** add the Place location-prompt case to the existing repeatable browser test (fake sign-in, nothing saved).
5. **Corrected manual test** in the 3B verification doc (below).

## Corrected manual test (after the build)

1. On commongroundz.co, open DevTools → Console and run:
   `navigator.permissions.query({name:'geolocation'}).then(p => console.log(p.state))`
   - `granted` → the prompt is skipped by design. Click the site-info icon left of the address → Location → "Ask (default)". Close and reopen the tab, then run the command again until it says `prompt`.
2. In Application → Local Storage, delete `locationPromptLastShown` and `locationPromptLastSkipped`. Make sure `locationEnabled` is `false`.
3. Start a review of a place or dish → step 3. The "Location Access" card should appear at the top. The admin reason line should say "showing".
4. Tap Skip, go back a step and forward again → no card (snoozed for 2 hours).

## Open question (not part of this fix)

When the browser already allows location but the app's own location switch is off, neither the popup nor the new page asks. So app location stays off, quietly. This rule is older than 3B. I'll leave it as is unless you want it changed.

3B stays open until you confirm both checks. 3C stays on hold.

## Technical details

- `MediaUploader.handleFileSelect`: on the `reserveSlots` path, reserve `min(files.length, remainingSlots)` and show the toast when `granted < files.length`. The non-reserve branch stays the same.
- `locationPromptPolicy.ts`: add `explainLocationPrompt(args)`, which returns `{ show, reason }` and is built on the existing rules. `shouldShowLocationPrompt` stays as a wrapper. Render the admin-only line in `ReviewComposerScreen` with `isAdmin` passed from the page.
- New vitest that renders the screen's photos step with a mocked `LocationContext` and a Place subject. Assert the `LocationAccessPrompt` text and the localStorage write.
- `scripts/e2e/review-history-guard.py`: add the intercepted Place entity case and assert "Location Access" on step 3.
- Update `docs/verification/review-composer-3b.md` with the steps above. Update the roadmap's 3B entry with "location prompt acceptance open".
