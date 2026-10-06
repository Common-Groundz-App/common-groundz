# Finish 3B — photos step parity, upload fix, navigation protection (revision 4)

Only the new review page changes. The legacy popup, entry points, switch, database and 3C stay untouched.

## 1. Uploader fixes
- **Lost photos:** new store actions `MEDIA_ADDED` and `MEDIA_REMOVED`, tied to the session, work on the latest state. They skip duplicates, renumber `order` and cap the list at 4.
- **Stuck Next:** only rows that are still preparing, uploading or finalizing count. A failed row stays visible but doesn't block Next.
- **Slots reserved the moment files are picked:** one counter, held by the page, reserves a slot for each file as it is accepted. Space left = 4 − photos already added − slots reserved.
  - Two quick selections in a row can't both use the last slot.
  - A slot is given back when its upload fails or is removed.
  - The existing video limit and its message stay the same.
- **Late uploads stay with their own session:**
  - Each upload holds on to the session it started in. It finishes against that session, even after the page has closed (a small in-memory list on the page that outlives a single screen).
  - The rules for what happens next:
    - Session still open → added normally.
    - Session open but over the limit → deleted right away.
    - Session left while open → deleted when the upload finishes.
    - Session left while saving or ambiguous → kept and listed as orphaned.
  - The orphan list lives only in memory, for the visit. It is not durable cleanup tracking, and the docs say so. Durable cleanup on the server is separate future work.
- Tests:
  - Uploads finishing at the same time
  - Mixed success and failure
  - Remove, then add
  - Two selections racing for the last slot
  - Video limit
  - Late finish in each of the four session situations, including after the page has closed
  - A step change keeps the photos

## 2. Photos step matches the popup
Unchanged. Order: location prompt → subject preview and context line → legacy read-only title/place → "Your media (n/4)" → "Add photos & videos" uploader → helper text. It's built from the same low-level pieces, uses the stable upload session, and shows the location prompt when the questionnaire settings say so. "Last shown" is recorded when the prompt actually appears.

## 3. Navigation protection

### States and copy (unchanged)
| State | Dialog | Buttons |
|---|---|---|
| Clean | none | — |
| Dirty | "Discard your draft? Your changes will be lost." | Keep editing / Discard |
| Saving | "Your review is still saving. Leaving now may leave its status uncertain." | Stay here / Leave anyway |
| Ambiguous | "We couldn't confirm whether your review was saved. Leaving now will close this form before the save status is resolved." | Stay here / Leave anyway |

- Leave anyway never cleans up uploads.
- **Save finishing after the user left:** it only sends the background "reviews changed" signal. No navigation, no toast, no change to the form. The save handler checks a "still here" flag before doing anything on screen. Tests check that whichever screen is open next gets no toast and no route change.

### History guard: corrected design
- **Marker in the router's state:** the guard entry is `navigate(sameUrl, { state: { ...location.state, __reviewGuard: { sessionId } } })`. The router keeps managing its own key/index fields, and the page never reads or writes raw `history.state`.
- **Entries are identified by the router's location key.** When the guard is added, the page records the key of the entry underneath it (the base entry) and the guard's own key. Moves are checked against these keys, not the address, because both entries share the same address.
- **Adding the guard:** happens when the form becomes dirty, saving or ambiguous, and only if the current entry isn't this session's guard. Going clean again doesn't change history.
- **Waiting for a move (`traverse`):**
  - The page asks the browser to step back and waits for the router to arrive at the expected key, for up to 1 second.
  - **If it doesn't arrive:** the page stops. No replace and no further moves; it stays put and shows "Couldn't leave this page — try again."
  - **If the page closes while waiting:** the wait is cancelled and does nothing.
  - **If it arrives at an unexpected key:** treated the same as a timeout.

**Return destination (direct entry vs in-app):** the page doesn't rely on `location.key === "default"` or the history length.
- **In-app entry:** every in-app link to the composer passes `state.from`. Leaving the page is a history step back only when `state.from` is a valid in-app path (the existing safe-origin rule) and the page saw it on its own base entry.
- **Anything else** (typed address, reload without that state, restored tab, unknown history): use a fixed, safe destination — the entity page for a fixed subject (from saved slugs), otherwise `/home`.
- The browser test checks a typed address, an in-app link, a reload, and arriving through Back/Forward.

**How each exit tidies up the guard and base entries, without ever stepping out of the app:**

| Exit | In-app entry | Direct / unknown entry |
|---|---|---|
| Save success, Cancel confirmed, Discard, Leave anyway | Step back off the guard (wait for the base key), then replace the base entry with the destination | Same first step: step back off the guard (the page created it, so this stays in the app), then replace the base entry with the fixed destination |
| No guard yet (clean) | Replace with the destination | Replace with the fixed destination |

Either way, history ends up as: previous entries → destination. No review entry is left behind.

**Back behavior:**
- **Back while dirty, saving or ambiguous:** the page lands on the base key and puts the guard back. Then it shows the dialog.
- **Back while clean with a guard still there:** one quiet step back, waited for, so a single press is enough.
- **Leftover guard entries from an earlier session:** shown as a normal fresh page with no dialog. The known cost is one possible extra Back press. There's no automatic skipping.
- **Forward:** after Keep, forward history is cut (normal browser behavior). Forward into an old guard entry opens a fresh, clean form.
- **Rapid double Back:** the browser can step past the base entry before the page puts the guard back, so this is **not** promised. The browser test checks it.
  - If the page can stay open, it's documented as protected.
  - If the second Back escapes, that limitation is reported to you, and browser Back protection is **not** marked complete. Tab close and the in-app exits stay protected either way. A router migration would be the only full fix and needs your decision.
- **Strict Mode:** setting up the guard is safe to run twice, and mount → unmount → mount leaves exactly one guard. Unit-tested.
- **Tab close / reload:** the browser's own warning shows in the dirty, saving and ambiguous states.

### All exits go through `requestLeave(destination)`
- Cancel
- Back
- "View it"
- Add timeline update
- Evidence-panel links
- Any header or logo

The full list of clickable items goes in the verification doc.

## 4. Verification
- **Committed unit tests (vitest):**
  - The guard state machine runs against an in-memory history keyed by location key.
  - The waiting step: timeout, unexpected key, and the page closing while waiting.
  - Every exit and Back sequence in both entry kinds.
  - The leftover marker, Forward, and Strict Mode.
  - The dialog copy for each state.
  - The late-save side effects.
  - All the upload cases.
- **Committed browser test:** `scripts/e2e/review-history-guard.py` (Playwright).
  - **Sign-in is faked** with a stored fake session and blocked sign-in calls. Every write request (database calls other than reads, storage uploads, functions) is blocked before the page loads, and save results are faked. No real session is needed and nothing reaches the database.
  - It covers: a typed address vs an in-app link vs a reload; Back → Keep ×3; Discard; Save and Cancel with the guard active; dirty → saving → ambiguous → Stay / Leave; rapid double Back (the result is recorded, whichever way it goes); a leftover marker; Forward; a late save after leaving (no toast, no navigation).
  - The address and location key are checked after each step.
  - It isn't part of `bun test` (the project has no browser runner); the doc explains how to run it.
- Screenshots of the photos step and the dialogs at 390 and 1280. Full suite, typecheck, build.
- `docs/verification/review-composer-3b.md`:
  - The navigation design and its known limits
  - The rapid double-Back result
  - The list of exits
  - The orphan rule (in memory only)
  - Your signed-in re-test list: real uploads plus navigation protection
- **Roadmap:** 3B stays "in progress" until you pass that list. If the rapid double-Back test fails, it's listed as an open decision.

## Not included
3C, a router migration, entry points, flag default, legacy forms, database, durable orphan cleanup, the 428 older warnings.

## Technical details
- `store.ts`: `MEDIA_ADDED` / `MEDIA_REMOVED`.
- `uploadSession.ts`:
  - Slot reservations: `reserve`, `release`
  - Per-session finish rules
  - A registry that outlives the screen, keyed by session id
- `screen/historyGuard.ts`: pure machine and `traverse` with an expected key, timeout and abort.
- `screen/useHistoryGuard.ts`: router binding (`useNavigate`, `useLocation`).
- `screen/locationPromptPolicy.ts`: location prompt rules.
- `ReviewComposerScreen.tsx`: photos step, slot counting, dialogs, `requestLeave`, the "still here" flag.
- Tests: `__tests__/historyGuard.test.ts`, `__tests__/composerPage3bParity.test.tsx`, `__tests__/uploadSlots.test.ts`.
