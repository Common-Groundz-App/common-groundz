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
