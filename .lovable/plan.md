# Finish 3B — photos step parity, upload fix, navigation protection (revision 3)

Only the new review page changes. The legacy popup, entry points, switch, database and 3C stay untouched.

## 1. Uploader fixes
- **Lost photos:** each finished upload adds to the photo list as it stood when that upload started. When several finish together, they overwrite each other. Fix: new store actions `MEDIA_ADDED` and `MEDIA_REMOVED`, tied to the session, that work on the latest state. They skip duplicates, renumber `order` and cap the list at 4.
- **Stuck Next:** only rows still preparing, uploading or finalizing count as uploading. A failed row stays visible but doesn't block Next.
- **Limit checked before uploading:** the uploader gets "4 minus photos already added minus uploads still running". Picking more than that while uploads are running doesn't start the extra uploads; they're refused with the existing "maximum 4" message.
- **Uploads that finish after leaving, or that end up over the limit:**
  - Any upload that finishes is recorded in the session's upload list first, even when the form then drops it (stale session, or over the limit).
  - So the existing rule applies: delete only while the session is open and unsaved, and never while saving or ambiguous.
  - A photo dropped for going over the limit while the session is open is deleted straight away.
  - An upload that finishes after the user has left an open session is deleted when it arrives.
  - An upload that finishes after leaving during saving or ambiguous is kept and counted as an orphan. Those files are listed in the verification doc. Cleaning up such files on the server is separate future work, the same as today.
- Tests:
  - Three uploads finishing at once
  - Mixed success and failure
  - Remove, then add
  - Adding at 4 refused before the upload starts
  - Picking files while uploads are running
  - Late upload after leaving an open session (deleted)
  - Late upload after leaving an ambiguous session (kept)
  - Over-limit upload (deleted)
  - A step change keeps the photos

## 2. Photos step matches the popup
Unchanged from the previous revision:
- **Order:** location prompt → subject preview and context line → legacy read-only title/place → "Your media (n/4)" → "Add photos & videos" uploader → helper text.
- **Built from:** the same low-level pieces, plus the stable upload session.
- **Location prompt:** shown when the subject's questionnaire settings say so. "Last shown" is recorded when the prompt actually appears.

## 3. Navigation protection

### States and copy
| State | Dialog | Buttons |
|---|---|---|
| Clean | none | — |
| Dirty | "Discard your draft? Your changes will be lost." | Keep editing / Discard |
| Saving | "Your review is still saving. Leaving now may leave its status uncertain." | Stay here / Leave anyway |
| Ambiguous | "We couldn't confirm whether your review was saved. Leaving now will close this form before the save status is resolved." | Stay here / Leave anyway |

Two rules for these states:
- Leave anyway never cleans up uploads.
- A save that finishes after the user has left does nothing on screen: no navigation and no toast. It still sends the normal "reviews changed" signal so lists refresh.

### History guard: the exact design
The router (`BrowserRouter`) can't block navigation itself, so the page uses one extra history step at the same address. "Guard entry" below means that extra step; "base entry" is the real one under it.

- **Router state kept:** the guard entry copies the router's own current `history.state`, including its own fields, and only adds `__reviewGuard: { sessionId }`. The page never rewrites the router's state.
  - The extra entry is created with `navigate(sameUrl, { state: {...current, guard} })`, not the raw browser call, so the router's location tracking stays in sync.
- **Arming:** the guard is added when the form becomes dirty, saving or ambiguous, and only if the current step isn't already this session's guard. So it is added at most once, never stacked.
- **Disarming:** going clean again doesn't touch history (history steps can't be deleted). The guard entry stays, and the next Back over it is handled below.
- **Waiting instead of guessing:** every planned history move goes through one helper, `traverse(n)`. It calls `history.go(-n)` and waits for the router to report the matching location, with a 1-second timeout. Only then does the next action run. Nothing is replaced or navigated while a move is still in progress.

Back sequences (the page is on the guard entry, with the base entry beneath it):

| Situation | What happens |
|---|---|
| Back while dirty, saving or ambiguous | The router lands on the base entry. The address is the same, so the page stays open. The page shows the dialog and puts the guard back (`navigate` forward to the same address with the guard state). |
| Keep editing / Stay here | Nothing more; the user is back on the guard. |
| Discard / Leave anyway | The user is on the guard again after the dialog, so the page steps back 2 entries (guard + base) and waits until it has left the page. |
| Back while clean (guard still there) | The router lands on the base entry. The page sees the guard is no longer needed and quietly steps back 1 more entry, so the user only presses Back once. |
| Rapid double Back | Dialogs and moves are handled one at a time: while the page is moving or a dialog is open, further Back presses just put the guard back. The page never opens two dialogs or skips past the form. |

- **Save success / Cancel confirmed:**
  - If the page is on its guard entry, it steps back 1 and waits.
  - Then it replaces the base entry with the destination, so history ends: previous page → destination. No leftover review address.
- **Direct entry (opened in a new tab):** the browser can't reliably say whether the page before is part of this app.
  - The page notes on its first load whether it was opened with a link from inside the app (the router's own location key is "default" for a fresh visit).
  - If opened directly, Discard / Leave / Cancel never step back out of the app. They replace the address with a fixed destination: the entity page for a fixed subject (from saved slugs), otherwise `/home`.
- **Leftover guard entries:** a session marker doesn't make an old entry disappear. So:
  - An entry whose session doesn't match is treated as a normal page. No dialog, no stale state; a fresh session starts as usual.
  - Pressing Back from there behaves normally. One extra press past an old duplicate entry is possible, and that is documented as the known cost. There's no automatic skipping, which could loop.
- **Forward:** after Keep editing, the forward history is cut off (normal browser behavior). Forward into an old guard entry from another page opens a fresh, clean form with no dialog.
- **React Strict Mode** (the app doesn't use it today; tested anyway): setting up the guard is safe to run twice. Arming checks the current state first, and the listener is cleaned up when the page closes. Running mount, unmount and mount again leaves exactly one guard.
- **Tab close / reload:** the browser's own warning shows when the form is dirty, saving or ambiguous.

### All exits guarded
Every exit goes through the same `requestLeave(destination)`:
- Cancel
- Browser Back
- "View it" in the existing-review notice
- Add timeline update
- Evidence-panel links
- Any app header or logo shown

While building, I'll list every clickable item on the screen in the verification doc. The state panels with no form stay unguarded.

## 4. Verification
- **Committed unit tests (vitest):**
  - The history guard logic is a pure state machine run against an in-memory history, with no browser timing.
  - All the sequences above: clean → dirty → clean, Back; Back → Keep three times; Discard; Leave anyway; rapid double Back; Save and Cancel with the guard active; direct entry; leftover marker; Forward; Strict Mode double setup; late save completion after leaving.
  - The dialog copy for each state.
  - All the upload cases.
- **Committed browser test:**
  - `scripts/e2e/review-history-guard.py` (Playwright), runnable again on demand.
  - It blocks all save requests and fakes the save results, so nothing reaches the database. It signs in with a minted session.
  - It checks the address and page state after each step of the same sequences.
  - It isn't part of `bun test`, because the project has no browser test runner. The verification doc explains how to run it.
- Screenshots of the photos step and each dialog at 390 and 1280.
- Full suite, typecheck, build.
- `docs/verification/review-composer-3b.md`: the navigation design, its known limits (one extra Back press past an old entry; forward history cut after Keep), the list of exits, the orphan-upload rule, and your re-test list (media uploads plus navigation protection).
- Roadmap: 3B stays "in progress" until you pass that list.

## Not included
3C, a full router migration, entry points, flag default, legacy forms, database, server-side orphan cleanup, the 428 older warnings.

## Technical details
- `store.ts`: `MEDIA_ADDED` / `MEDIA_REMOVED` actions.
- `uploadSession.ts`: `DISCARD_LATE`; `orphaned` list.
- `screen/historyGuard.ts`: pure machine and `traverse`.
- `screen/useHistoryGuard.ts`: router binding (`useNavigate`, `useLocation`, `navigationType`).
- `screen/locationPromptPolicy.ts`: location prompt snooze logic.
- `ReviewComposerScreen.tsx`: photos step, upload counting, dialogs, `requestLeave`.
- Tests: `__tests__/historyGuard.test.ts`, `__tests__/composerPage3bParity.test.tsx`.
