# Step 2 — Consistent review ownership actions and edit policy

The review remains one ongoing thread: **Edit** corrects the original review shortly after publishing; **Add update** records a later experience without replacing the original; **Delete** removes the thread and is a last resort. The larger Review Experience phases remain paused.

## 1. Make the same owner actions available everywhere

- Give every review written by the signed-in person a three-dot menu on the entity page, whether it has timeline updates or not, and on the profile. Other people's reviews never get owner actions.
- Use one shared owner-menu control for the entity page's regular and timeline review cards and both profile-card sizes. It offers **Add update** and **Delete**; **Edit** is shown only when eligible. Preserve the current review-card layouts and admin moderation actions.
- **Add update** opens the existing review's update experience, including when there are no prior updates. **Edit** opens the existing review form for that review. **Delete** uses one confirmation explaining that the original review and its updates are removed; after the correction window closes, it suggests Add update instead. Refresh the entity/profile review lists and counts after actions, without requiring a page reload.

## 2. Compare what Edit and Add update can change before locking Edit

- Record a concise Review/Edit/Update field matrix against the actual forms and stored columns, including rating, recommending, text, media, subject, date, visibility, and questionnaire/Food Tags. Identify answers that Add update cannot currently change.
- Do **not** activate the one-hour restriction while supported answers would become permanently unchangeable through the normal update path. If the gap remains, deliver the consistent menu and update route first and leave the edit-window enforcement explicitly pending a separate decision about those fields. Do not silently drop or rewrite old answers and do not begin the paused structured-review phases.

## 3. Enforce the one-hour window once the field gate is satisfied

- Reuse the post policy's time calculation in a shared helper, retaining existing post behavior; add review eligibility derived from the signed-in owner and securely obtained admin role. A stale form must handle an expired-window save with a clear Add update option, not lose the entered content without warning.
- Add a **review-specific** database trigger: only changes to original author-content columns are time-limited. Audit the actual review-column and trigger interactions first; allow automatic timeline count, latest rating, derived recommending/trust fields, search/summary bookkeeping, moderation, and visibility changes after the hour. Never let a direct client update bypass the rule. Admin bypass must rely on the server-side role table, not client storage. Do not copy the post trigger wholesale or alter the post behavior.
- Define and test the exact one-hour boundary and owner/admin authorization, including old legacy reviews, simultaneous update/recount activity, and what happens if the window expires while the form is open. Keep Delete available at any time.

## Technical notes and checks

The entity page currently uses `TimelineReviewCard` for reviews with updates (its owner menu only deletes) and a separate read-only `ReviewCard` for ordinary reviews. The profile card already edits/deletes in two layouts. The live database currently has a post edit trigger but no review edit trigger; timeline insert/undo recomputes derived review fields. These are the integration points, not a reason to redesign the cards.

Add focused UI and policy tests, database role/trigger checks with controlled rollback fixtures only when safe, then run the full test suite and type check and inspect the preview build result. Verify owner/non-owner menus, zero-update and multi-update paths, Edit versus Add update, expiry, visibility changes, deletion, and refreshed results. This project's external authentication prevents automated signed-in browser acceptance; provide a short manual signed-in checklist. Stop after Step 2 for approval; Step 3 and Phases 1–5 stay on hold.
