# Step 3B — review page (new + edit review), hidden behind a switch that stays off

## 3A check
- All 3A parts exist; 61 tests pass; build OK; nothing outside the module uses them; legacy forms untouched.
- One leftover: the roadmap still says "3B blocked until 3A approved". Fixed in step 0.

## Goal
Build the full-page composer for **new review** and **edit review** on the 3A parts. Same steps, fields and copy as today's popup (rating → subject → photos → details). Normal users see no change: every existing button keeps opening the legacy popup until 3D. Timeline modes wait for 3C.

## Step 0 — Baseline
- Roadmap: 3A approved, 3B in progress. Design doc boundary note: "used only by the gated 3B routes".

## Step 1 — Rollout switch, complete (F6)
- Database: default row `reviews.composer_page_enabled = {"enabled": false}` (insert if missing); add the key to `set_app_flag`'s allowlist with strict validation (exactly `{enabled: boolean}`); return it from `get_public_flags` as `reviews.composer_page_enabled`. Same security mode, search path, grants and admin check as today.
- App: add to the public flag type, defaults and parser; admin `ALLOWED_KEYS`; one admin-panel toggle.
- Dedicated resolver `useReviewComposerImplementation()` → `'legacy' | 'page'`. Release default `legacy`; the remote value counts only after a successful, non-placeholder load; loading or failure = release default.
- No entry point reads it in 3B. The entry-point helper stays dormant until 3D.

## Step 2 — Routes and access
- `/review`, `/review?entityId=<id>`, `/review/:reviewId/edit`, all inside `AppProtectedRoute` (same as `/create`), all noindex.
- Signed-out: current app behavior (sent to the home page). Returning to the exact composer address after sign-in is a separate app-wide auth fix, not part of 3B.
- Pre-cutover gate: page allowed when implementation = `page` **or** the user is a server-verified admin (`has_role`). Everyone else sees a short "not available yet" state with a link back. While the admin check loads: skeleton, never the form.
- States: malformed id, missing/deleted entity or review → "not found"; someone else's review → "You can only edit your own review"; network/permission failure → Retry (never silently falls back to picking a subject).

## Step 3 — Page shell
- Centered column on desktop, safe-area layout on mobile, step header, Back/Next, Cancel.
- Unsaved-changes confirmation for Cancel, in-app links and browser back; the browser's own leave warning on tab close.
- On a failed Next/Save, focus moves to the first invalid field (from the step engine) with an accessible error message.

## Step 4 — New review
- `/review`: pick a subject on the page, including external results found-or-created in the background; the URL never changes.
- `/review?entityId=<id>`: subject preselected and locked. If it's not found, "Pick another" replaces the URL with `/review` **and starts a fresh session** — no leftover category, questionnaire or food-tag answers.
- Already reviewed this subject (before the form, or on save via 23505): "You've already reviewed this" with **Add timeline update** and Cancel.
- Save payload identical to the legacy popup's.

## Step 5 — Edit review
- Loads the exact review; owner only; subject locked (legacy unlinked title/place shown read-only); unknown metadata kept.
- One hour from the original publish time. Expired → explanation + **Add timeline update**. Admins follow the same author rules on their own reviews.
- Visibility after the hour stays in the three-dot menu, not this form.

## Step 6 — Saving and reliability
- Save locked while pending; duplicate, expired, not-authorized and unknown errors each get their own message.
- Ambiguous timeout: form kept, Save locked. New review: if a review for this subject now exists, say "A review for this already exists" and offer to view it — never "your exact answers were saved". Edit: reload and compare the sent fields; only a full match says "Your changes were saved"; otherwise stays unsure and the user chooses to retry.
- Cancel removes only photos uploaded in this session, never while unsure.
- Success: invalidation fires; destination built from the stored entity and parent slugs (resolved during the lookup), never from names or `/entity/<uuid>`.
- **Add timeline update** (from both notices) deliberately uses today's legacy path: entity page from stored slugs + one-time "open timeline update" state. Tested explicitly.

## Not in 3B
Timeline modes, any entry-point change, switching the default, legacy forms, auth return-to fix, database changes beyond the flag, AGENTS.md.

## Verification and stop
- Tests: resolver (default/loading/failure/on), gate (admin, non-admin, flag on), each not-found/not-authorized/Retry state, Pick another resets session, stable URL during selection and background creation, step moves keep answers/uploads, payload parity for both modes, duplicate/expired/ambiguous messages match evidence strength, cancel cleanup, unsaved prompt, Add timeline update handoff, no existing entry point imports the page.
- Full suite, typecheck, build, migration inspected.
- Screenshots at 390 and 1280: `/review`, locked subject, edit loading and ready, subject not found, expired edit, not-available gate. No test reviews written to production; a signed-in manual checklist for you.
- Write `docs/verification/review-composer-3b.md`, update roadmap, stop before 3C.

## Technical details
- New: `src/pages/ReviewComposerPage.tsx`, `src/components/review-composer/screen/*`, `src/hooks/useReviewComposerImplementation.ts`.
- Edited: `App.tsx` (routes only), `useAppConfig.ts`, `useAppFlagsAdmin.ts`, admin flag panel; one migration (row, `set_app_flag`, `get_public_flags`).
- Ownership/existing-review lookups via `ownReview.ts`; field inputs reused from the legacy steps by import, legacy files unchanged.
