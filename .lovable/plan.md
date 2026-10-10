# Close out 3D — keep the popup as a frozen rollback, defer 3E

## Decision
3D is complete and verified by your signed-in tests. The new review page stays ON as the normal experience. The old popup is **not deleted yet** — it stays in the code as a temporary, dormant rollback path while we keep improving the new page. 3E (deleting the popup, the switch and the old compose links) happens later, once the next round of review-page changes is stable.

## Why
- The popup is dormant while the switch is ON — users never see it, so keeping it briefly costs nothing.
- The next work will modify the new review page, which is exactly when regressions are most likely. The switch is a cheap emergency rollback during that period.
- But the popup must not drift: it is **frozen** — no new features, no fixes unless needed for rollback safety. All future review/timeline work targets the new page only.

## What I do now (small, bookkeeping only)
1. Mark 3D complete in `docs/verification/review-composer-3d.md`: record your signed-in results (write from home and entity page, text-only edit, photo-removal edit with 2 photos queued, add/edit timeline update, read-only viewer, `?compose=update` owner vs non-owner, mid-draft switch-off, inline undo/delete, popup restored when OFF).
2. Update the roadmap: 3D done; 3E deferred until the new page's next changes are stable.
3. Add a short "frozen — rollback only, do not extend" note at the top of the legacy popup form and the legacy inline timeline form, so future work doesn't accidentally touch them.
4. Record the freeze rule in the roadmap so it survives this session.

## What stays exactly as it is
- The rollout switch stays in the admin page, left ON.
- The old popup and inline timeline form stay in the code, unused while the switch is ON.
- `?compose=update` / `?compose=review` compatibility stays (removal is part of 3E).
- Photo cleanup (D2), the weekly sweep and the admin tab are untouched.

## When 3E happens
After the next round of new-review-page improvements is built and stable, 3E removes in one cleanup phase: the popup, the inline timeline form, the rollout switch, the old compose-query compatibility, and the dead code/tests/docs around them.

## Checks
- Full test suite, type check and build after the bookkeeping edits (the freeze notes are comments only, so nothing should change).
