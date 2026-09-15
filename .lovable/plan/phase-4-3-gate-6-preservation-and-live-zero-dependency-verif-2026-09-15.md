# Phase 4.3 Gate 6 — preservation and live zero-dependency verification (revision 2)

Gate 6 is verification-only apart from one confirmed defect fix (see section 1a). No schema changes, no deletions. It proves that everything the migration had to preserve still works, and that nothing live still depends on the retired recommendation layer. Physical schema removal stays in Phase 4.5; the exhaustive `pg_depend` drop-readiness proof stays in Phase 4.4.

All points from both review rounds are accepted and folded in: verify the Gate 5 fixes including share, verify the media-cleanup jobs directly, keep the sweep scoped to live/runtime use, prove signed-in behaviour with real fixtures rather than guest page loads, separate deferred schema objects from defects, scope the before/after comparison to what was actually captured, and use an unambiguous completion rule.

## 1. Gate 5 fix verification (each its own result line)
- Recs card click routes to the canonical entity page for a linked, live subject; genuinely unlinked cards do nothing.
- Recs card Share produces the canonical entity URL and never a retired `/recommendations/...` URL. A button that does nothing does not count as working sharing.
- No dead comment control remains on the Recs card.
- Neither `/recommendations/:id` nor `/recommendation/:id` resolves to anything live — route table, redirects file, and a live request check.
- Both media-cleanup jobs no longer read the retired records or their image column — verified in the deployed function source, with the surviving reference sets listed.

### 1a. Confirmed defect: Recs-card Share is a no-op
The reviewer was right. `RecommendationCard.handleShare` is an empty function body with a placeholder comment, wired to the share button in both card variants. This is reported as FAIL and gets the smallest correction inside Gate 6: share the canonical entity URL for a linked, live subject using the project's existing share helper and its existing feedback behaviour, and hide the share control when there is no valid canonical destination. Nothing else on the card changes. Gate 6 does not close until this passes.

## 2. Preservation checks, by viewer and required evidence level
Every requirement is tagged with the evidence level that can actually prove it — **runtime/fixture required**, **automated-test or static sufficient**, or **optional manual observation** — and with the viewer it is proven under: guest, signed-in self, signed-in other/Circle viewer, or administrative context.

Runtime/fixture required:
- Recommendation-type posts: create, comment, like, and the notification row plus its resolved destination.
- Entity V4 "recommending" and "from circle" counts; "Recommended by Your Circle" results; who-to-follow — under both a self viewer and a Circle viewer.
- Profile Recs tab contents and card destinations for a real signed-in user.
- Frozen legacy routines still refuse application callers (negative authorization).

Automated-test or static sufficient:
- `reviews.is_recommended` resolver parity with its SQL counterpart (shared fixture suite).
- The Gate 5 route, link-building and media-cleanup removals.
- Fallback / circle / chat / journey recommendation surfaces unmodified.

Signed-in evidence is produced with transaction-scoped fixtures against the live database: inside an always-rolled-back transaction, assume the application role with an existing user's claims and exercise the same routines the UI uses, including the mutating paths, with disposable identifiers. The boundary is **no persistent production writes** — transient rows inside the transaction are expected, and each fixture asserts the affected tables are back to their prior state after rollback and that only post-family tables were touched. Before any mutating path is exercised this way, it is checked for non-transactional side effects that could escape a rollback (outbound HTTP, storage, email, webhooks); any path that cannot be guaranteed side-effect-free is not exercised live and is instead covered by automated tests, with runtime mutation verification reported as BLOCKED.

Browser click-through remains unavailable in this environment (the project uses your own Supabase, so no test sign-in can be minted). That limits optional manual observation only; it never converts a required check into a pass.

## 3. Data invariants, scoped to real evidence
- Report the exact cohort the pre-cleanup evidence actually covers. Gate 3's manifest was a deletion manifest: it captured the six converted reviews' marker fields, not platform-wide endorsement values. So the before/after comparison is made for that cohort only — confirming the markers are cleared and nothing else about those rows changed, to the extent the manifest recorded it.
- Everything broader is reported as current post-cleanup observation, clearly labelled, not as before/after proof: current endorsement totals, and the canonical endorsement path verified end to end.
- Entity counts are compared against previously recorded values where such values exist, and otherwise reported as current observations. No baseline is manufactured.

## 4. Live zero-dependency sweep (scoped)
- Repo-wide search (beyond `src/` and `supabase/functions/`) for any live reader or writer of the retired tables, category enum, review marker columns, removed route or removed viewer. Every remaining hit is classified individually as intentional test fixture, documentation, historical migration, generated types, or a defect.
- Live catalogue check for active runtime references in routines, views, triggers and policies.
- Confirm the retired tables are still empty and still write-frozen, and that legacy-only routines still deny application execute.
- Confirm exactly one trending job (hourly, minute 20) and one influence job (daily 04:12).

Everything that intentionally remains until Phase 4.5 — the four tables, the category enum, the marker columns with their constraints, policies, triggers, indexes, and the generated types file — is recorded as a **deferred schema dependency inventory** read from the live catalogues, explicitly not a defect and not merely "historical". That inventory is the hand-off input to Phase 4.4.

## 5. Completion rule and reporting
- Every requirement is reported PASS, FAIL, BLOCKED or DEFERRED with the exact files, functions, routes, queries and viewer used.
- Gate 6 is **not** ticked while any requirement whose evidence level is runtime/fixture or automated-test is FAIL or BLOCKED. Documenting a limitation never converts such a check into PASS. Only optional manual observation may close with a stated limitation.
- Any defect stops close-out and gets the smallest corrective plan first.
- Full test suite, type check, build.
- Evidence written to `docs/verification/phase-4-3-gate-6-preservation.md`, including the evidence-level table, the deferred inventory, and every blocked or limited check.

## Boundaries
- Nothing dropped, cleared or regenerated; no CASCADE anywhere.
- No persistent production writes; all fixtures roll back and are asserted clean afterwards.
- No new production accounts.
- The only code change permitted is the Recs-card share correction in section 1a.
- Work stops at the end of Gate 6 — Phase 4.4 and 4.5 are not started.
