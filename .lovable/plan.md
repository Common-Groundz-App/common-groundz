# Phase 4.3 Gate 6 — preservation and zero-dependency verification

Gate 6 is a verification-only gate. No feature work, no schema changes, no deletions. It proves that everything the migration was required to preserve still works, and that nothing live still depends on the retired recommendation layer. Physical schema removal stays in Phase 4.5.

## What gets checked

### 1. Preservation checks (each must pass unchanged)
- Recommendation-type posts behave exactly like any other post: create, view, comment, like, notification destinations.
- Review endorsements (`reviews.is_recommended`) untouched: values, counts, and the endorsement truth path.
- Profile Recs tab: still present, still backed by real review endorsements, cards route to the entity page when linked and do nothing when genuinely unlinked.
- Entity V4 page: "recommending" and "from circle" counts unchanged.
- "Recommended by Your Circle" card unchanged.
- Who-to-follow, fallback and circle recommendation services, chat recommendation cards and journey recommendation card: unmodified and functioning.

### 2. Zero-dependency sweep
- Repo-wide search (not limited to `src/` and `supabase/functions/`) for any live reader or writer of the four retired tables, the retired category enum, the retired review marker columns, the removed detail route, and the removed viewer.
- Every remaining hit is classified as one of: intentional test fixture, documentation, historical migration, generated database types (removal scheduled for 4.5) — or a defect. Any defect is reported before anything is concluded.
- Confirm the retired tables are still empty and still frozen (no application write privileges, legacy-only routines still deny application execute).
- Confirm scheduler state is exactly as agreed: one trending job (hourly, minute 20) and one influence job (daily 04:12).

### 3. Verification runs
- Full test suite, type check, build.
- Live database reads to confirm counts and freeze state rather than trusting notes.
- Guest-side page loads for the entity page, profile Recs tab and a recommendation post. A signed-in click-through is not possible in this environment (the project uses your own Supabase, so no test sign-in can be created); that gap is stated in the evidence rather than glossed over.

## Outcome

Each requirement is reported as PASS, FAIL or LEFTOVER with the exact files, functions, routes and queries checked. If anything fails, the smallest corrective plan is proposed first and nothing is concluded until it is applied.

Evidence is written to `docs/verification/phase-4-3-gate-6-preservation.md`, and the Gate 6 line in `roadmap.md` is ticked only when every check passes.

## Boundaries

- No schema objects dropped, no columns cleared, no enums removed.
- No CASCADE anywhere; an unexpected dependency stops the gate and is reported.
- Generated database types are not regenerated in this gate.
- Work stops at the end of Gate 6 — Phase 4.4 and 4.5 are not started.
