# Phase 4.3 Gate 6 — preservation and live zero-dependency verification (revised after review)

Gate 6 is verification-only. No feature work, no schema changes, no deletions. It proves that everything the migration had to preserve still works, and that nothing live still depends on the retired recommendation layer. Physical schema removal stays in Phase 4.5; the exhaustive drop-readiness proof stays in Phase 4.4.

Both reviewers' points are accepted and built in below: verify the Gate 5 fixes themselves (including share), verify the media-cleanup jobs directly, keep the sweep scoped to live/runtime use, prove signed-in behaviour with real signed-in evidence instead of guest page loads, separate deferred schema dependencies from defects, and compare preserved data against recorded values rather than only confirming fields exist.

## 1. Gate 5 fix verification (each its own PASS/FAIL line)
- Recs card click routes to the canonical entity page for a linked, live subject; genuinely unlinked cards do nothing.
- Recs card Share produces the canonical entity URL and never a retired `/recommendations/...` URL.
- No dead comment control remains on the Recs card.
- Neither `/recommendations/:id` nor `/recommendation/:id` resolves to anything live — route table, redirects file, and a live request check.
- Both media-cleanup jobs no longer read the retired records or their image column — verified in the deployed function source, with the surviving reference sets listed.

## 2. Preservation checks, by viewer
Each requirement is recorded against the viewer that can actually prove it — guest, signed-in self, signed-in other/Circle viewer, or administrative context:
- Recommendation-type posts behave as ordinary posts: create, view, comment, like, notification destination.
- `reviews.is_recommended` endorsement truth path intact.
- Profile Recs tab present, endorsement-backed, cards navigate as in section 1.
- Entity V4 "recommending" and "from circle" counts.
- "Recommended by Your Circle" card results.
- Who-to-follow and the fallback / circle / chat / journey recommendation surfaces unmodified and functioning.
- Frozen legacy routines still refuse application callers (negative authorization).

Signed-in evidence is produced with transaction-scoped authorization fixtures against the live database: inside a rolled-back transaction, assume the application role with a chosen existing user's claims and call the same viewer-scoped routines the UI calls, for a self viewer and for a Circle viewer. No test accounts are created and nothing is written. Anything that still cannot be exercised this way is reported BLOCKED — not PASS — and Gate 6 is not ticked while a required check is blocked. Browser click-through remains unavailable in this environment (the project uses your own Supabase, so no test sign-in can be minted); wherever that is the only evidence available, the result is marked test/static-covered with the manual runtime gap stated explicitly.

## 3. Data invariants, not just field existence
- Compare current endorsement values and counts against the pre-cleanup manifest recorded in Gate 3, expecting exactly one difference: the cleared `recommendation_id` and `is_converted` markers on the six audited reviews.
- Compare "recommending" and "from circle" counts for a set of named entities against the values recorded before cleanup, rather than relying on visual inspection.

## 4. Live zero-dependency sweep (scoped)
- Repo-wide search (beyond `src/` and `supabase/functions/`) for any live reader or writer of the retired tables, category enum, review marker columns, removed route or removed viewer. Every remaining hit is classified individually as intentional test fixture, documentation, historical migration, generated types, or a defect.
- Live catalogue check for active runtime references in routines, views, triggers and policies.
- Confirm the retired tables are still empty and still write-frozen, and that legacy-only routines still deny application execute.
- Confirm exactly one trending job (hourly, minute 20) and one influence job (daily 04:12).

Everything that intentionally remains until Phase 4.5 — the four tables, the category enum, the marker columns and their constraints, policies, triggers, indexes, and the generated types file — is recorded as a **deferred schema dependency inventory** taken from the live catalogues, explicitly not as a defect and not as merely "historical". That inventory is the hand-off input to Phase 4.4; the full `pg_depend` drop-readiness proof belongs to 4.4, not here.

## 5. Runs and reporting
- Full test suite, type check, build.
- Every requirement reported as PASS, FAIL, BLOCKED or DEFERRED with the exact files, functions, routes and queries checked.
- Any defect stops close-out and gets the smallest corrective plan first.
- Evidence written to `docs/verification/phase-4-3-gate-6-preservation.md`, including the deferred inventory and any blocked check. The Gate 6 roadmap line is ticked only when every required check is PASS or explicitly documented as non-runtime-verifiable with its limitation stated.

## Boundaries
- Nothing dropped, cleared or regenerated; no CASCADE anywhere.
- No production data written; authorization fixtures run inside rolled-back transactions.
- No new test accounts in production.
- Work stops at the end of Gate 6 — Phase 4.4 and 4.5 are not started.
