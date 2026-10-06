# 3B audit: "too many photos" warning + why the location prompt didn't show

## What I checked (this turn)

- **Live site has the new code.** The commongroundz.co bundle includes the new page's subject card, the location-prompt rules and the leave warnings. Nothing is stale.
- **The prompt works in a reproduced run.** A test browser (fake sign-in, nothing saved) opened the new page with a **Place** called "Ambur", browser location permission at "Ask", `locationEnabled=false` and no snooze keys. On step 3 the "Location Access" card appeared and `locationPromptLastShown` was written at that moment.
- **The type and question set are right.** "Tell us about your place" on your screen comes from the Place question set, and that set has the location prompt switched on. So "is it a place?" and "is this type allowed?" both pass.
- **Storage keys match the popup:** `locationPromptLastShown`, `locationPromptLastSkipped`.
- **The snooze rule matches the popup exactly** (correcting my earlier wording): if a Skip time is saved, only the 2-hour rule applies. If not, the 24-hour "last shown" rule applies.

## Why it didn't show for you (confirmed by your incognito test)

In incognito, the card shows on both the popup and the new page. Incognito starts with no saved site permissions and no stored data. So the code works. Your normal Chrome profile is the only difference.

In that profile, Chrome already has location set to **Allow** for commongroundz.co. Your storage has `lastPositionTimestamp`, which shows the site got your location before. When the browser already allows location, the card is skipped on purpose, on both the popup and the new page. The card exists to ask for permission, and Chrome already gave it. The page decides this before anything appears, so `locationPromptLastShown` was never written. That's why the key was missing.

**No patch needed for the location prompt.** It behaves exactly like the popup. Location acceptance can be marked as passed based on your incognito result.

## What I'll build

1. **"Too many photos" warning (real bug, from 3B).** When you pick more photos than fit, show "Too many files selected — Only the first N files will be processed." It uses the same wording as the popup, and the popup itself doesn't change.
2. **Regression tests:**
   - Place, location off, permission "Ask", no snooze keys → the card appears on step 3, and "last shown" is saved at that moment.
   - Permission "Allow" → no card. Location on → no card. Movie/book → no card.
   - Skip saved 1 hour ago → no card. Skip saved 3 hours ago → card.
   - The two photo-limit cases.
3. **Browser check:** add the Place location-prompt case to the existing repeatable browser test (fake sign-in, nothing saved).
4. **Corrected manual test** in the 3B verification doc (below). It explains that the card is skipped when the browser already allows location, so testing in incognito is the easy way to see it.

## Corrected manual test (after the build)

1. Open an incognito window, sign in, and start a review of a place or dish. On step 3 the "Location Access" card appears. (Already passed for you.)
2. Tap Skip, go back a step and forward again → no card (snoozed for 2 hours).
3. Pick 6 photos at once → "Too many files selected — Only the first 4 files will be processed." Only 4 upload.
4. In a normal window where location is already allowed → no card. This is expected.

## Open question (not part of this fix)

When the browser already allows location but the app's own location switch is off, neither the popup nor the new page asks. So app location stays off, quietly. This rule is older than 3B. I'll leave it as is unless you want it changed.

After the photo-warning check, 3B is done. Then 3C can start.

## Technical details

- `MediaUploader.handleFileSelect`: on the `reserveSlots` path, reserve `min(files.length, remainingSlots)` and show the toast when `granted < files.length`. The non-reserve branch stays the same.
- New vitest that renders the screen's photos step with a mocked `LocationContext` and a Place subject. Assert the `LocationAccessPrompt` text and the localStorage write. Add policy cases for granted, enabled, ineligible type and the Skip windows.
- `scripts/e2e/review-history-guard.py`: add the intercepted Place entity case and assert "Location Access" on step 3.
- Update `docs/verification/review-composer-3b.md`: replace the stale "Known limits" line about the missing location prompt and subject card, and add the steps above and the "browser already allows" rule.
