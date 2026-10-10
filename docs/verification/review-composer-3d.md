# Step 3D — entry-point cutover — COMPLETE (verified signed-in, switch ON)

Plan: `.lovable/plan/step-3d-send-every-review-button-to-the-new-review-page-2026-10-10.md`

## Routing
- `src/services/review/composerRoutes.ts` — pure `resolveComposerTarget(action, implementation, from)`; ID-only addresses
  (`/review`, `/review?entityId=`, `/review/:reviewId/edit`, `/review/:reviewId/timeline/new`, `/review/:reviewId/timeline/:updateId/edit`).
- `src/hooks/useReviewComposerNavigate.ts` — only entry-point reader of the switch. Loading → one pending tap (others ignored),
  cancelled on unmount/navigation/different target; failure → legacy once.
- Slugs are used only for return destinations (existing persisted-slug lookup in the page).

## Entry-point inventory
| Entry point | Action | On | Off |
|---|---|---|---|
| Home "Create → Review" (SmartComposerButton) | write | `/review` | popup |
| `open-create-post-dialog` event, review type (SmartComposerButton) | write (+entityId) | `/review?entityId=` | popup |
| Entity page "Write Review" (EntityV4) | write | `/review?entityId=` | popup |
| Entity page `?compose=review` (EntityV4) | write | `/review?entityId=` | popup |
| Entity page "Add Timeline Update / Update Your Review" (EntityV4) | addUpdate | timeline page | timeline viewer |
| Entity page `?compose=update` (EntityV4, remove in 3E) | addUpdate | owner → timeline page; others/invalid → entity page | unchanged |
| Owner "..." menu Edit / Add timeline update (ReviewOwnerMenu — used by profile ReviewCard, entity TimelineReviewCard, components/ReviewCard) | editReview / addUpdate | page | caller's legacy action / built-in popup |
| Profile reviews tab "Add new" + empty state (ProfileReviews) | write | `/review` | popup |
| Timeline viewer "Add Timeline Update" / update "Edit" (ReviewTimelineViewer) | addUpdate / editUpdate | page (viewer read-only) | inline form |
| Popup "add update" hand-off (ReviewForm → openExistingReviewTimelineUpdate) | — | reached only from the popup (switch off) | unchanged |
| Page "already reviewed" hand-off (ReviewComposerScreen) | addUpdate | timeline page by review ID | n/a |

Viewing actions (timeline badge on cards, ReviewsSection timeline click) still open the viewer. Delete, visibility, moderation unchanged.

## Page gate
Admin bypass removed (`resolvePageGate`). A route session latches only after the switch is confirmed on; a new route visit re-checks.

## Results
- Vitest: 73 files, 1026 passed, 3 skipped; `tsgo --noEmit` clean; build OK.
- New: `src/services/review/__tests__/composerRoutes3d.test.tsx` (helper × actions × on/off; one tap/one action; loading; failure; cancel on unmount/target change; inventory).
- Browser `scripts/e2e/review-cutover-3d.py` (fake sign-in, writes blocked) at 390/1280: 10/10 — `/review` gate on/off, home Create→Review page vs popup, `?compose=update` owner → timeline page on / entity page off.
- `scripts/e2e/review-timeline-3c.py` re-run with switch on and no admin bypass: all passed.
- Not browser-tested (covered by unit tests only): switch flipped mid-session; per-button clicks on entity/profile cards.

## Signed-in checklist (owner)
1. Switch ON in admin. Home Create → Review opens the page; Cancel → Home.
2. Entity page Write Review → page with the subject; Save → entity page.
3. Owner menu Edit (within the hour) → edit page; text-only save works; removing a photo saves.
4. Entity "Add Timeline Update" → timeline page; Save and Cancel → entity page with the timeline reopened.
5. Timeline viewer: no inline form; Add/Edit open the page; Undo/Delete still work inline.
6. `/entity/<slug>?compose=update` → your timeline page; on someone else's entity → entity page.
7. With a draft open, switch OFF in another tab, then reload the app config → draft stays, Save/Cancel work.
8. Switch OFF: every button opens the popup again; `/review` shows "Not available yet".
