# Finish 3B — photos step parity and browser Back protection

Only the new review page changes. The legacy popup, entry points, switch and database stay untouched. 3C stays on hold.

## 1. Photos step matches the popup exactly
The popup's photos step (StepThree) shows things the new page leaves out. Add them back in the same order and with the same copy:
- **Subject preview card**: read-only, change disabled, with the context line ("Dish at Truffles") under it. Shown only for linked subjects.
- **Location prompt**: shown only for the subject types that show it today, using the same 24h/2h snooze rules. "Skip" behaves the same way.
- **Legacy unlinked reviews (edit)**: the read-only "What this review is about" / "Where" fields and "The subject of a review can't be changed." text sit on this step, like in the popup.
- **Media section layout**: the "Your media (n/4)" grid sits above the uploader, then the "Add photos & videos" label, the uploader at full width, and the helper text ("n/4 media items added - …").
- **Uploader behavior**: uses the page's stable upload session (from 3A) and the same add/remove handlers. The "uploading" signal tracks only uploads that are still running, so Next isn't left stuck. This is checked against the popup by hand (add, remove, reaching 4, removing after a step change).

The page reuses the popup's own building blocks (EntityPreviewCard, LocationAccessPrompt, CompactMediaGrid, MediaUploader) directly. It doesn't render StepThree itself, which would give it a new upload ID on every render.

## 2. Browser Back with unsaved changes
- **Limitation:** the app uses `BrowserRouter`. React Router's `useBlocker` only works with a data router, and switching the whole app to a data router is too invasive for 3B.
- **Smallest safe fix (page-local):** while the form has unsaved changes, the page pushes one guard history entry and listens for `popstate`.
  - When Back is pressed, the guard entry is put back and the existing "Discard changes?" dialog opens.
  - **Discard** removes the guard and goes back for real.
  - **Keep editing** stays on the page.
- The guard is removed once changes are saved or undone, so Back works normally then. It is also removed on successful save navigation, Cancel-confirmed, and unmount, so it never leaves an extra history step.
- The guard is never added while the form is clean or still loading, and it is also skipped during an ambiguous save, which keeps Back from discarding anything.
- In-app links: the header and tab links on this page go through the same confirm. Links elsewhere in the app are out of scope.

## 3. Verification
- Tests:
  - Guard is added only when there are unsaved changes.
  - Back opens the dialog.
  - Discard leaves the page.
  - Keep stays.
  - Save or clean form means no guard.
  - The photos step shows the preview card and context line for linked subjects only.
  - The location prompt follows its type rule.
  - The legacy read-only fields are present.
- Full suite, typecheck, build.
- Screenshots at 390 and 1280 of the photos step, if a session can be minted. Otherwise this is a manual check.
- Update `docs/verification/review-composer-3b.md` with the signed-in checklist:
  - `/review`
  - `/review?entityId=…`
  - `/review/:id/edit`
  - Duplicate-review recovery
  - Expired edit → Add timeline update
  - Save/Cancel/dirty behavior, including browser Back
  - Photos step parity
  - Mobile and desktop
- Roadmap: 3B stays "in progress" until you pass the checklist.

## Not included
3C, entry points, flag default, legacy forms, the 428 older DB warnings.

## Technical details
- Edit: `src/components/review-composer/screen/ReviewComposerScreen.tsx` (media step markup; new `useBackGuard(dirty, onAttempt)` hook in `screen/useBackGuard.ts`).
- Location snooze logic: copy it into a small shared helper. Don't import it from StepThree, which stays frozen.
- Tests: `src/components/review-composer/__tests__/composerPage3bParity.test.tsx` (DOM), added to vitest config.
