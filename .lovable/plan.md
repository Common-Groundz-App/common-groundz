# Finish 3B — photos step parity, upload fix, navigation protection (revised)

Only the new review page changes. The legacy popup, entry points, switch, database and 3C stay untouched.

## 1. Uploader fixes (confirmed in code)
- **Lost photos:** each finished upload adds to the photo list as it stood when that upload started. When several photos finish together, they overwrite each other. Fix: a new store action `MEDIA_ADDED` (session-keyed, so late results are dropped) appends to the latest state. It also skips duplicate URLs, renumbers `order`, and never goes past 4. Removing a photo uses `MEDIA_REMOVED` the same way.
- **Stuck Next:** right now, any upload row counts as "uploading", including failed ones. Now only rows still preparing, uploading or finalizing count, so a failed upload no longer blocks Next.
- Tests:
  - Three photos finishing at once keeps all three.
  - Mixed success and failure.
  - Remove, then add again.
  - Adding at 4 is refused.
  - A late upload from an old session is ignored.
  - A step change keeps the photos.

## 2. Photos step matches the popup
Same order as today's popup:
1. Location prompt
2. Subject preview card (read-only) and its context line
3. Legacy read-only title/place
4. "Your media (n/4)" grid
5. "Add photos & videos" uploader at full width
6. Helper text

How it's built:
- Built from the same low-level pieces (EntityPreviewCard, LocationAccessPrompt, CompactMediaGrid, MediaUploader) with the stable 3A upload session. It doesn't render StepThree itself.
- The location prompt shows when the subject's questionnaire settings say so, not from a new list of types. The snooze rules stay the same (24h, or 2h after Skip).
- One deliberate fix to the copied logic: the popup records "last shown" based on old state, so it is often skipped. The new page records it when the prompt actually appears.

## 3. Navigation protection
Three states:

| State | Back / leaving |
|---|---|
| Clean | Normal |
| Dirty | "Discard your draft?": Keep editing / Discard |
| Saving or ambiguous | Stronger warning: "We couldn't confirm whether your review was saved. Leaving now will close this form before the save status is resolved." Stay here / Leave anyway |

Uploads are never cleaned up while saving or ambiguous, including after Leave anyway.

**How Back works with the app's current router** (it can't block navigation itself):
- When the form first gets unsaved changes, the page adds one extra history step at the **same address**, marked as its own (`{ __reviewGuard: sessionId }`).
- It adds this at most once per session: if the current step is already its marker, nothing is added. Going dirty and clean repeatedly never stacks entries.
- Pressing Back moves from that extra step to the real one. The address doesn't change, so the router keeps the page open. The page sees the move and acts on the state:
  - **Dirty or ambiguous:** show the matching dialog and put the extra step back. Repeated Back → Keep editing is safe because of the at-most-once rule.
  - **Clean again:** quietly step back once more, so the user never has to press Back twice.
  - **Discard / Leave anyway:** step back once more, past the real entry.
- **Save success:**
  - If the extra step exists, the page first steps back off it, then replaces the address with the destination. No duplicate review address stays in history.
  - Cancel-confirmed works the same way.
- **Leaving the page** without Back removes the listener. Any extra step left behind has the same address and is skipped on the next visit, because its session doesn't match.
- **Forward:** after Keep editing, the forward history is gone. That's the browser's normal rule, and it's documented.
- **Direct page entry** (no earlier history): Discard and Leave go to the Cancel destination instead of stepping back out of the app.
- **Tab close:** keeps the browser's own warning, in both the dirty and ambiguous states.

**Every way out of the composer, all guarded the same way:**
- Cancel
- Browser Back
- Leaving through the existing-review notice: "View it" and Add timeline update
- Evidence-panel links
- Close/logo, if shown

The state panels (not found, unauthorized and so on) have no form, so they stay unguarded. While building, I'll list every link reachable from the screen in the verification doc.

## 4. Verification
- Unit tests:
  - Guard decisions for each state
  - Adding the extra step at most once
  - Upload cases from section 1
  - Photos-step contents per subject type
- **Real-browser test** (Playwright, signed in with a minted session; nothing is saved to production):
  - Clean → dirty → clean, then Back
  - Back → Keep, repeated three times
  - Back → Discard
  - Direct `/review` entry
  - Save success with the guard active, using a mocked save
  - Cancel-confirmed
  - Leaving through a link
  - Dirty → ambiguous → Stay / Leave anyway, with a mocked timeout
  - Forward after Keep
  - Check `history.length` and the address after each step
- Screenshots of the photos step at 390 and 1280.
- Full suite, typecheck, build.
- Update `docs/verification/review-composer-3b.md`: the navigation design, the link list, and a short signed-in re-test list for you (media uploads and navigation protection).
- 3B stays "in progress" until you pass that list.

## Extra suggestions included
- When an upload fails, the uploader's existing error row stays visible, and Next isn't blocked by it.
- A guard marker left behind can't trigger a dialog on a later visit, because it is tied to one session.
- The ambiguous dialog never offers "Discard", so the wording never suggests that nothing was saved.

## Not included
3C, entry points, flag default, legacy forms, database, the 428 older warnings.

## Technical details
- `store.ts`: `MEDIA_ADDED` / `MEDIA_REMOVED` actions, plus reducer tests.
- `screen/ReviewComposerScreen.tsx`: photos-step markup, active-upload filter, and dialogs.
- New files:
  - `screen/useHistoryGuard.ts`: pure `decideOnPop(state)` plus a small hook.
  - `screen/locationPromptPolicy.ts`: copied snooze logic.
  - `__tests__/composerPage3bParity.test.tsx`
- Real-browser script in /tmp only, not committed.
