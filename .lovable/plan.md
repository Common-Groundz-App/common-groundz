# Close Phase 4.3, then prepare Phase 4.4 (drop-readiness proof only)

Your three manual checks close the last open items. The audit I just ran found no leftovers and no defects: retired tables empty, no conversion markers, no retired links in notifications, read-only privileges with every write policy gone, retired-only routines owner-only, shared comment routines post-only in the live database, one trending job (hourly :20) and one influence job (daily 04:12), both media-cleanup jobs clean, build green and 633/633 tests passing.

## Part 1 — Record the manual passes and close Phase 4.3

In `docs/verification/phase-4-3-gate-6-preservation.md`:

- Change the three BLOCKED entries to PASS by manual observation, dated, with the exact behaviour you confirmed: Recs tab renders and cards open the entity page with Share using the entity link; Entity V4 recommending / from-circle counts and the "Recommended by Your Circle" card behave correctly; recommendation-type posts create, comment, like and open notifications through the normal post flow.
- Rewrite the "BLOCKED checks" section as a closed section: the environment limitation (your own Supabase, no test sign-in mintable from here) is recorded as the reason manual observation was used, with the runtime evidence now supplied by you.
- Add the close-out verdict: every Gate 0–6 requirement PASS, no leftovers, no defects.
- Add the reference classification and the Phase 4.4 hand-off inventory (below) so Phase 4.4 starts from one authoritative list.

In `roadmap.md`: tick Gate 6 as fully complete and tick the Phase 4.3 parent item, with a one-line note that the signed-in checks were closed by manual observation.

Also correct nothing else — no code, no schema, no type regeneration.

## Part 2 — Phase 4.4: prove drop-readiness, drop nothing

Phase 4.4 is a proof gate. No `DROP`, no `CASCADE`, no `ALTER`, no type regeneration. Its output is a written proof that every object below can be removed safely in Phase 4.5, plus a stop-on-surprise rule: any unexpected dependant halts the phase and gets reported before anything else happens.

Steps:

1. **Dependency proof from the live catalogues.** For each candidate object, enumerate every dependant (`pg_depend` / `pg_rewrite` / `pg_constraint` / `pg_trigger` / `pg_policy` / `pg_proc`), and record who or what still points at it. Anything outside the expected set stops the phase.
2. **Reverse check for shared objects.** Prove which candidates are genuinely retired-only versus shared, by listing every column, routine and policy that uses them.
3. **Application-side confirmation.** Re-run the repo-wide sweep and confirm the only remaining references are generated types, historical migrations, tests, docs and the live shared type module.
4. **Drop order.** Write the exact Phase 4.5 order that respects the restricting foreign key on reviews (clear/drop review columns before the parent tables) with no CASCADE anywhere.
5. **Evidence.** `docs/verification/phase-4-4-drop-readiness.md`, with the object inventory, the dependant list per object, the shared-object exclusions, the drop order, and any surprise found. Tick Phase 4.4 in the roadmap only if nothing unexpected appeared.

### Candidate inventory (retired-only — safe to drop in 4.5)

- Tables: `recommendations`, `recommendation_comments`, `recommendation_likes`, `recommendation_saves`, plus `recommendations_backup` (confirm the other `*_backup` tables separately before including them).
- Columns: `reviews.recommendation_id` with `reviews_recommendation_id_fkey`, and `reviews.is_converted`.
- Type: `recommendation_category` only.
- Routines: `toggle_recommendation_like`, `increment_recommendation_view`, `get_recommendation_likes_by_ids`, `get_user_recommendation_likes`, `create_recommendation_comment_notification`, `create_recommendation_like_notification`, and the `retract_recommendation_like_notification` trigger function.
- Triggers on the retired tables: `on_new_recommendation_comment`, `on_soft_delete_recommendation_comment`, `update_updated_at_column`, `on_new_recommendation_like`, `on_delete_recommendation_like`, `update_recommendations_updated_at`.
- The six remaining read-only policies on those tables, plus their indexes and constraints.
- The generated database types file, regenerated once at the very end of Phase 4.5.

### Must be preserved (shared, not retired)

- `recommendation_visibility` — types `posts.visibility` and `reviews.visibility`. Keep it; rename at most, and only if you ask for that.
- `posts.post_type = 'recommendation'` and `reviews.is_recommended` — live product behaviour.
- `src/services/recommendation/types.ts` — shared `Entity` / `EntityType` used across entity pages, feed and utilities.
- The circle, fallback, network, chat and journey recommendation surfaces, and the profile Recs tab.

Work stops at the end of Phase 4.4; Phase 4.5 removal is a separate approval.
