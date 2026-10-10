# Step 3D close-out — final signed-in checks

Your signed-in test covered most of the 8-step checklist and everything passed. Three checks remain before 3D counts as done. All are quick and use the switch you already have ON.

## What you already verified (done)
1. Home Create → Review opens the page; publish works (Spider-Man review, 4 photos).
2. Entity page Write Review opens the page with the subject; publish works (Madagascar review).
3. Edit review, text-only change ("Awesome movie!!") saved.
4. Edit review, removed 2 photos saved; both photos queued in the admin cleanup tab.
5. Add Timeline Update from the page (2 rings, 1 photo, "bad ending") posted.
6. Edit that update (1 ring, photo removed, "bad ending!!!") saved.
7. Timeline viewer is read-only; its buttons open the page.
8. Switch OFF brings back the old popup for reviews and timeline updates; switch back ON restores the page.

## Remaining checks (your part, ~5 minutes)
1. **Old "add update" link:** open `/entity/<spider-man-slug>?compose=update` while signed in as hana li (the owner) — it should open your timeline page. Then open the same kind of link for the Madagascar review... actually any entity where someone else owns the review (or a made-up review link) should show the normal entity page.
2. **Switch off mid-draft:** start editing a review on the page (type something, don't save), turn the switch OFF in the admin tab, come back — your draft should still be there and Save/Cancel should still work.
3. **Timeline Undo/Delete:** in the read-only timeline viewer, Undo and Delete should still work inline (they were never moved to the page).

## My part after your checks
- If all three pass: mark 3D complete in `docs/verification/review-composer-3d.md` and the roadmap, archive this plan.
- If anything fails: I diagnose and fix with the switch left ON, then you re-check.

## Not included
- 3E (deleting the popup, the switch and `?compose=update`).
- Turning the switch on permanently for everyone — that's your call after 3E.
- Any change to photo cleanup (D2) — the 2 queued photos from your test will be deleted by the hourly worker as normal.
