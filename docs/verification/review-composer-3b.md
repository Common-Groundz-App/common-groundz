# Step 3B — review page, new + edit review (verification)

Date: 2026-10-05. Scope: page for create-review / edit-review only. No entry point changed; switch stays off.

## Delivered
| Piece | Where |
|---|---|
| Rollout switch (F6) | DB row `reviews.composer_page_enabled = {"enabled": false}`; `set_app_flag` allowlist + strict `{enabled: boolean}`; `get_public_flags.reviews.composer_page_enabled` (CASE, missing/malformed → false); existing mux/notifications output unchanged; client `parsePublicFlags`, `useReviewComposerImplementation` (release default `legacy`; loading/failure/placeholder → legacy); admin `ALLOWED_KEYS` + "New review page" toggle |
| Routes | `/review`, `/review?entityId=`, `/review/:reviewId/edit` in `AppProtectedRoute`; noindex |
| Temporary gate (remove in 3D) | `canUseReviewComposerPage`: switch `page` OR server-verified admin; others see "Not available yet"; skeleton while checks load |
| Page | `src/pages/ReviewComposerPage.tsx`, `src/components/review-composer/screen/*`; state/validation/payloads only from the 3A parts; low-level inputs reused (StepOne, SubjectSelectStep, StepFour, MediaUploader, CompactMediaGrid) |
| States | malformed/missing/deleted subject → "Subject not found" + Pick another (fresh session at `/review`); network → Retry; review not found; not owner → "You can only edit your own review"; expired (non-admin) → Add timeline update |
| Handoff | `openExistingReviewTimelineUpdate` on `findOwnReviewForEntity` + stored slugs + one-time `openReviewUpdate`; typed opened / not_found / mismatch / no_destination / lookup_failed |
| Saving | lock; 23505 → "You've already reviewed this"; expired; 20s timeout → ambiguous, Save locked, evidence shown (create: "A review for this already exists"; edit: only a full field match says saved); manual retry only |
| Leaving | confirm when unsaved; browser leave warning; session-only photo cleanup (never while ambiguous); validated same-app origin, else Home / entity page |

## Evidence
- DB: `get_public_flags()` returns `reviews.composer_page_enabled: false`; row `{"enabled": false}`.
- Tests: new `composerPage3b.test.ts` (11) + 3A suite; full suite 69 files, 971 passed, 3 skipped. Typecheck clean, build OK.
- Boundary tests: only the page uses the module; no existing button links to `/review` or `/review/:id/edit`; page never imports the legacy popup or timeline viewer.
- Browser (390, 1280): signed-out `/review`, `/review?entityId=bad`, `/review/abc/edit` redirect to `/`, no page errors.

## Known limits
- Signed-in screenshots not taken: this project's sign-in can't be injected into the test browser. Covered by the manual checklist below.
- Browser Back with unsaved changes is not intercepted (the app's router doesn't support blocking); Cancel and tab close are guarded.
- Photos step shows the heading, context line and uploader, not the legacy location prompt / subject preview card.
- A pre-existing link in search results points to `/review/:id`, which never existed as a page; untouched.

## Manual signed-in checklist (admin account, switch off)
1. `/review` → pick a subject (also an outside search result) → URL stays `/review` → publish → lands on the entity page.
2. `/review?entityId=<id>` → subject locked; no Pick another.
3. Subject you've reviewed → "You've already reviewed this" → Add timeline update opens the timeline on the entity page.
4. `/review/<your review>/edit` within the hour → change text → Save changes → entity page.
5. Someone else's review → "You can only edit your own review".
6. Non-admin account, switch off → "Not available yet"; switch on → page opens; review buttons still open the old popup.

## 3B close-out (photos parity, uploads, navigation protection)

### Uploads
- `MEDIA_ADDED` / `MEDIA_REMOVED` store actions apply to the latest state (no lost photos when several finish together), skip duplicates, renumber `order`, cap at 4, ignore stale sessions.
- Only rows still `uploading` block Next; a failed row stays visible but doesn't block.
- Slots are reserved atomically when files are accepted (`uploadRegistry.ts`). This needed one **optional, additive** change to the shared `MediaUploader` (`reserveSlots` / `releaseSlot`, each file released exactly once). Without these props the uploader behaves exactly as before. The legacy popup doesn't pass them; it's covered by the full suite but has no dedicated uploader test. The video limit is unchanged.
- What happens to an upload that finishes late (decided against the session it started in):
  - Session open, page still open, room left → added.
  - Session open but over the limit → deleted.
  - Session left while open → deleted.
  - Session left while saving or ambiguous (or after a committed save) → kept and listed as an orphan.
  - The orphan list is **in memory only**, not durable cleanup tracking. A session's registry entry is removed once it has ended and nothing is pending.

### Photos step
In the popup's order:
1. Location prompt (shown when the questionnaire settings say so; 24h/2h snooze; "last shown" recorded when it actually appears)
2. Read-only subject preview and context line
3. Legacy read-only title/place
4. "Your media (n/4)"
5. "Add photos & videos"
6. Helper text

### Navigation protection
- States:
  - clean → normal
  - dirty → "Discard your draft?"
  - saving → "Your review is still saving…"
  - ambiguous → "We couldn't confirm whether your review was saved…"
- Leave anyway never cleans up uploads.
- A save that finishes after leaving changes nothing on screen: no navigation, no toast. The service still emits the background "reviews changed" signal.
- How it works:
  - One extra history entry at the same address, with the marker in router `location.state` (router fields untouched). It is added at most once per session, and entries are identified by router location keys.
  - Leaving steps off the guard and **waits for the base key** (1s timeout). On a timeout, an unexpected key or unmount, the page stays put ("Couldn't leave this page — try again.") and replaces nothing.
- Return destination:
  - A valid in-app `state.from`, when it is already present. Existing links are unchanged.
  - Otherwise a fixed destination: the entity page from stored slugs, or `/home`.
  - Clean Back with an unknown origin replaces the address with that destination and never steps into unknown history.
- Known limits:
  - The old guard entry stays in **forward** history. Forward into it opens a fresh, clean form with no dialog.
  - A leftover marker from another session is treated as a normal page, which can cost one extra Back press.
- Exits that go through `requestLeave`:
  - Cancel
  - Browser Back
  - "Add timeline update" (existing-review notice and expired notice)
  - The evidence panel's continue action
  - Save success, which releases the guard and then replaces the address
- State panels have no form and stay unguarded. The page has no app header or logo.

### Results
- Unit tests:
  - `composer3bCloseout.test.ts` (12: guard logic, dialog copy, key waiter, registry, location policy, media reducer)
  - `historyGuardRouter.test.tsx` (9, real MemoryRouter: clean, dirty, Keep ×3, clean-again, known origin, release then replace then Back/Forward, saving/ambiguous, Strict Mode, leftover marker, failed release)
- Full suite 992 passed / 3 skipped; typecheck clean.
- Browser test: `python3 scripts/e2e/review-history-guard.py` (sign-in faked, every write blocked; 0 writes attempted). At 390 and 1280 all 18 required checks pass. **Rapid double Back (two `history.back()` calls in a row) stayed on the form in this test.** A real user's double press may be timed differently, so please try it by hand.
- Not covered by the browser test (needs real data): the photos step itself, real uploads, the saving/ambiguous dialogs and late-save behavior. Those are covered by unit tests and your re-test.

### Signed-in re-test (you)
1. `/review` → pick a subject → photos step: preview card plus context line; location prompt for food/places when location is off.
2. Select 3–4 photos at once: all appear; a 5th is refused before uploading; a failed upload doesn't block Next.
3. Remove a photo, add another; go to Details and back: photos kept.
4. Make a change → browser Back → "Discard your draft?" → Keep editing (×2) → Back → Discard.
5. Cancel while dirty asks first; Cancel on a clean form leaves straight away.
6. Save → you land on the entity page; pressing Back doesn't show the old form with your answers.
7. Edit within the hour (`/review/<id>/edit`): the same photos-step checks.
8. Mobile and desktop.
