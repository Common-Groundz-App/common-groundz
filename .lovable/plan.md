# Close Phase 4.3, then run Phase 4.4 as a read-only proof gate (revision 2)

All reviewer corrections accepted: nothing is called safe before the proof, routines are identified by exact signature, trigger instances are separated from shared trigger functions, backup tables get their own retention decision, catalogue dependencies are not trusted alone, the generated types file is a regeneration artifact rather than a drop candidate, and Phase 4.5 never re-clears the review markers.

## Part 1 — Close Phase 4.3 (documentation only)

No code, schema or type changes.

In `docs/verification/phase-4-3-gate-6-preservation.md`:
- Mark the three previously blocked checks PASS by manual observation, recorded exactly as supplied: date, environment (the project owner's own signed-in session on this project's Supabase), observer identified generically as the project owner, and the three behaviours observed — Recs tab renders and cards open the correct entity page with Share using the entity link; Entity V4 recommending / from-circle counts and the "Recommended by Your Circle" card behave correctly; recommendation-type posts create, comment, like and open notifications through the normal post flow. No invented IDs, no screenshots.
- Replace the BLOCKED section with the closed version: the environment limitation is why manual observation was used; the runtime evidence came from the owner.
- Add the close-out verdict — every Gate 0–6 requirement PASS, no leftovers, no defects — and the audit findings already confirmed live (retired tables empty, no conversion markers, no retired notification links, read-only privileges with all write policies gone, retired-only routines owner-only, shared comment routines post-only in the live database, one trending job hourly :20 and one influence job daily 04:12, both media-cleanup jobs clean, 633/633 tests, build green).

In `roadmap.md`: tick Gate 6 and the Phase 4.3 parent, noting the signed-in checks closed by owner manual observation.

## Part 2 — Phase 4.4: read-only proof gate

No `DROP`, no `ALTER`, no `CASCADE`, no data changes, no type regeneration. Any unexpected dependant halts the phase and is reported before anything else.

### 2.1 Provisional candidate inventory (disposition unknown until proven)

Nothing below is safe until Phase 4.4 says so. Each item ends with exactly one disposition: **SAFE TO DROP IN 4.5**, **KEEP**, or **BLOCKED / NEEDS REVIEW**.

- Tables: `recommendations`, `recommendation_comments`, `recommendation_likes`, `recommendation_saves`.
- Backup/archive relations, each audited separately: `recommendations_backup`, and every other `*_backup` relation in scope.
- Columns: `reviews.recommendation_id` and its foreign key, `reviews.is_converted`.
- Type: `recommendation_category`.
- Routines: every candidate recorded as `schema.name(argument types)` from `pg_proc`, with overloads listed separately, never as a bare name.
- Trigger instances on the retired tables, recorded as `trigger name ON table` and mapped to their trigger function, with that function's other live instances listed.
- Read-only policies, indexes and constraints on the retired tables.

Explicitly not a drop candidate: `src/integrations/supabase/types.ts` — a generated artifact, regenerated once after Phase 4.5 succeeds.

### 2.2 Proof method — structural, textual and operational

Catalogue graphs miss PL/pgSQL body references and dynamic SQL, so all three layers run:

1. **Structural:** `pg_depend`, `pg_rewrite`, `pg_constraint`, `pg_trigger`, `pg_policy`, `pg_attrdef`, `pg_index`, `pg_type`, plus views and materialized views.
2. **Definition text:** search every routine body, view definition, policy expression, check constraint, column default and generated-column expression for each candidate name, including dynamic SQL strings and `format()`/`EXECUTE` patterns.
3. **Operational:** cron job command text; Vault-backed HTTP jobs; Realtime publication membership; storage policies and auth hooks; deployed Edge Function sources compared against the repository; CI workflows and scripts; any API client outside `src/`; the REST schema cache exposure of each candidate.

Reverse check for shared objects: for `recommendation_visibility`, `update_updated_at_column` and anything similar, enumerate every column, routine, trigger instance and policy that uses them, to prove shared-versus-retired rather than assume it.

Application-side: repo-wide sweep confirming the only remaining references are the generated types file, historical migrations, tests, docs and the live shared type module `src/services/recommendation/types.ts`.

### 2.3 Backup-relation retention decisions

Dependency-free does not mean disposable. Each backup relation gets its content summary, size, ownership, creation history and dependants, then one explicit decision: **retain** (recovery/compliance value), **export then drop**, **drop**, or **out of scope for this phase**. Nothing enters a 4.5 removal list without that decision.

### 2.4 Proposed Phase 4.5 order (authoritative order determined by the proof)

Phase 4.5 does not re-clear anything — Phase 4.3 already cleared the review markers; Phase 4.4 only verifies they are still clear. Prospective sequence, no CASCADE at any step:

1. Re-verify the Phase 4.3 invariants (tables empty, markers clear, no retired links).
2. Retire any remaining application or generated contract references.
3. Drop retired-only routines by full signature.
4. Drop retired trigger instances and policies where deterministic evidence requires it; otherwise let table removal own them, per the reviewed plan.
5. Drop the `reviews.recommendation_id` foreign key.
6. Drop `reviews.recommendation_id`.
7. Drop `reviews.is_converted`.
8. Drop the child retired tables in dependency order.
9. Drop `recommendations`.
10. Drop `recommendation_category` only after proving no remaining column, default, routine signature or expression uses it.
11. Handle approved backup relations per their retention decisions.
12. Regenerate the database types once.
13. Re-run the zero-reference and preservation checks.

### 2.5 My additions

- **Preserve the Gate 3/4 audit manifest.** The owner-only `audit` schema holds the only record of what was deleted. Phase 4.4 records it as KEEP and confirms it is still inaccessible to every application role; it must never be swept up with the retired layer.
- **Fail-safe check on the reviews columns.** Before proposing the column drops, confirm no view, index, policy, routine or generated expression reads `reviews.recommendation_id` or `reviews.is_converted` — column drops are the one step here that can silently break a live surface.
- **Rollback note per step.** For each proposed 4.5 step, state whether it is reversible and what recreating it would require, so a mid-phase stop is recoverable.
- **Security-linter delta.** Record the linter count before and after the proof so Phase 4.5 can prove it introduced no new finding category.
- **Deployed-versus-repo drift list.** Where any deployed Edge Function or database routine differs from the repository, record the drift explicitly — that mismatch has already caused stale-snapshot findings twice in this phase.

### 2.6 Output and stop

Evidence in `docs/verification/phase-4-4-drop-readiness.md`: the provisional inventory, per-object dependant evidence across all three proof layers, backup retention decisions, the three final buckets (SAFE TO DROP IN 4.5 / KEEP / BLOCKED-NEEDS REVIEW), the authoritative no-CASCADE drop order with reversibility notes, and any surprise found. Roadmap ticked only if nothing unexpected appeared.

Phase 4.4 stops there. Phase 4.5 removal needs its own approval.

### Must be preserved (already established)

`recommendation_visibility` (types `posts.visibility` and `reviews.visibility`), `posts.post_type = 'recommendation'`, `reviews.is_recommended`, `src/services/recommendation/types.ts`, the profile Recs tab, and the circle / fallback / network / chat / journey recommendation surfaces.
