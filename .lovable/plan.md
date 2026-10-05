# Step 3B — review page (create + edit review), behind a switch that stays off

## 3A check (done before this plan)
- All 3A parts exist; 61 tests pass; build OK.
- No screen uses them yet; legacy popup, inline timeline form and routes unchanged.
- Leftover found: one roadmap line still says "3B blocked until 3A approved". Fix it in step 0 below. Nothing else is left.

## Goal
Build the new full-page review composer for **new review** and **edit review** only, on the 3A parts. It sits behind a switch with release default `legacy`, so users see no change until 3D. Timeline modes wait for 3C.

## Scope
0. Roadmap: mark 3A approved; 3B in progress.
1. **Switch (F6):** add `reviews.composer_page_enabled` (default off) to `get_public_flags` and the admin flag list. Client reads it with release default `legacy`; loading or a failed read = legacy. Nothing routes to the page yet.
2. **Routes** (work when visited directly, even with switch off, so admins can test):
   - `/review` — new review, subject picked on the page; URL never changes while picking or background-creating a subject.
   - `/review?entityId=<id>` — subject preselected and locked; unknown/invalid id shows "Pick another", which replaces the URL with `/review`.
   - `/review/:reviewId/edit` — owner only; subject locked; noindex on all.
   - Signed-out → existing auth prompt; non-owner/unknown review → not-found state, never the form.
3. **Page** (`ReviewComposerPage`): same steps as today's popup (rating → subject → media → details), same fields and copy, reusing existing field inputs (ConnectedRingsRating, subject search with background entity creation, media uploader, questionnaire, food tags, visibility). Skeletons while loading. Step changes never lose answers or uploads.
4. **Checks before showing the form:**
   - New review: if the user already reviewed this subject, show the existing-review notice with "Update your review" (no form).
   - Edit: one-hour window from original created_at; expired → explain and offer Add timeline update (goes to legacy entry for now). Admins only edit their own reviews.
5. **Save:** save lock; first invalid section focused (F-DOM from 3A known limits); duplicate (23505) → existing-review notice; expired → explanation; ambiguous timeout → form kept, Save locked, show what the server has (strong/compare evidence), user decides. On success navigate to the entity page built from persisted entity + parent slugs, no ID jump; invalidation bridge fires.
6. **Cancel / leave:** confirm if unsaved changes; clean up only photos uploaded this session (never while ambiguous); return to a validated origin, else Home (new) or entity page (edit). Browser back uses the same unsaved-changes check.

## Not in 3B
Timeline modes, changing any entry point, switching default to page, touching legacy forms, database rules other than the flag, AGENTS.md.

## Verification
- Tests: route guards (signed-out, non-owner, unknown id, invalid entityId), switch default/loading/failure = legacy, URL stable during subject pick and background creation, step navigation keeps values/uploads, save payload parity with legacy for both modes, duplicate/expired/ambiguous paths, cancel cleanup, dirty prompt.
- Playwright at 390 and 1280 with a real signed-in session: create on a test entity is **not** run against production data; edit path verified read-only up to Save; manual signed-in checklist for you.
- Full suite, typecheck, build; write `docs/verification/review-composer-3b.md`; update roadmap; stop before 3C.

## Technical details
- New files: `src/pages/ReviewComposerPage.tsx`, `src/components/review-composer/screen/*` (step shell, section renderers wrapping existing inputs), `useComposerPageFlag.ts` in `src/hooks`.
- Migration: extend `get_public_flags` with the one key, default false; add key to `ALLOWED_KEYS` in `useAppFlagsAdmin.ts`.
- Lookup uses `ownReview.ts`; destination resolved during the signed-in lookup per AGENTS.md rule.
- Routes added in `App.tsx` only; existing routes untouched.
