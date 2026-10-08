# Step 3D — Switch normal entry points to the new review page

Goal: when the rollout switch is on, every normal "write / edit review" and "add / edit timeline update" action opens the new page, and the timeline viewer becomes read-only. When it is off, everything behaves exactly as today. The legacy popup and inline form stay in the code for rollback until 3E.

## 0. Before starting

- The switch is **on** in the database right now (it was turned on from the admin panel for testing). 3D needs it **off** while building, and turned on deliberately at the end. Please turn it off in the admin panel, or approve a one-line reset as part of 3D.

## 1. One routing helper, one switch reader

- A single helper decides where each action goes, given the switch: `write review (subject?)`, `edit review (id)`, `add update (review id)`, `edit update (review id, update id)`. Switch on → the new page address; off → today's popup/inline behavior.
- Only this helper reads the switch. Release default stays `legacy`; loading or failure = legacy (fail-closed, as today).
- The page passes the origin (`from`) so Cancel returns where the user came from.

## 2. Entry points moved to the helper

| Where | Action |
|---|---|
| Home "+" composer button | Write review |
| Entity page (write / "You've already reviewed this" / `?compose=update`) | Write review / add update |
| Entity page reviews list and timeline cards | Edit review, add/edit update |
| Shared owner menu (review cards on profile, entity, feed) | Edit review |
| Profile reviews tab | Write / edit review |
| Timeline viewer "Add Timeline Update" and an update's "Edit" | Add / edit update |
| Popup's own "already reviewed → add update" and "edit window closed" | Add update |

Each is found by search and listed in the verification notes; nothing outside this list changes. Delete, visibility change and admin moderation stay where they are.

## 3. Timeline viewer read-only when the page is on

- Switch on: the viewer shows the timeline only; "Add Timeline Update" and per-update "Edit" become links to the page. Undo/delete of the latest update stays (it is not part of the composer).
- Switch off: the viewer is byte-for-byte today's behavior, including the inline form.
- The one-time reopen after saving on the page keeps working, so you land back on the viewer.

## 4. Gate cleanup on the page

- Remove the temporary "admins always allowed" gate. The page opens when the switch is on; when it is off, a direct `/review…` address shows "Not available yet" with a link back. (Admins test by turning the switch on.)
- `?compose=update` links: switch on → owner goes to `/review/:id/timeline/new`, others to the entity page; off → unchanged.

## 5. Rollback

- Switch off from the admin panel → every button returns to the popup/inline form on the next screen load; nothing to deploy. Open pages finish their save normally.
- Verified both directions in tests and in the browser.

## 6. Ready for 3E (removal), recorded but not done

- Usage check: a week with the switch on and no regressions (your sign-off).
- List of what 3E deletes: popup orchestration in `ReviewForm.tsx`, inline form in the viewer, the switch, release default, the dormant helper branch, legacy-only tests.
- Known open items carried to 3E or later: scheduled sweep for leftover photos (incl. the 4 found in the 3C audit), server save key for duplicate-safe timeline adds, rapid double-Back.

## 7. Checks

- Tests: helper on/off/loading/failure for every action; each entry point routes via the helper; viewer read-only on, unchanged off; gate removed; `?compose=update` both ways.
- Browser (faked sign-in, writes blocked) at 390 and 1280: each entry point with the switch on and off, rollback mid-session, Back/Cancel returns to the origin.
- Full suite, type check, build. Signed-in checklist for you. 3D is marked done only after your check.

## Technical details

- New `src/services/review/composerRoutes.ts` (pure: action + implementation → `{ kind: 'page', to, state } | { kind: 'legacy' }`) and a thin hook over `useReviewComposerImplementation`.
- Edited call sites: `SmartComposerButton.tsx`, `EntityV4.tsx`, `ReviewsSection.tsx`, `ReviewOwnerMenu.tsx`, `ProfileReviews.tsx`, `profile/reviews/ReviewCard.tsx`, `ReviewTimelineViewer.tsx` (on-branch only), `ReviewForm.tsx` (two hand-off buttons only).
- `ReviewComposerPage.tsx`: remove `canUseReviewComposerPage` admin branch; keep the switch check.
- No database changes beyond optionally resetting the switch to off; no AGENTS.md changes.
