# Phase 11.1 — Helpful security implementation

Date: 2026-11-27. **Implemented; available authorization/regression checks passed. Overlapping-session and real signed-in acceptance remain blocked.** Phase 11.2 not started.

## Applied migrations

- `20261127121550_220c34a7-2b38-40d9-94f0-179546b4f3b6.sql`: exact cleanup; table privilege/RLS hardening; three RPC replacements and explicit ownership/grants.
- `20261127123613_cb6c6ea6-f7c3-4338-b60a-f01326fc6d78.sql`: rollback-only database-role regression (31 authorization/behavior assertions, plus snapshot/fixture checks).
- `20261127124226_1fb029c3-261a-4ac8-aed3-1aadc12e7083.sql`: six additional rollback-only missing-identity/deleted-status assertions.

## Exact cleanup

Immediately before cleanup, joined each vote to its review and confirmed matching author/voter identity and the named dummy accounts Hana/Rishabh. The transaction asserted the full `(vote id, review id, user id)` cohort before deleting only these primary keys:

| Vote row ID | Review ID | Account |
|---|---|---|
| `96e9f774-9eb9-457b-8f56-17cc9490f504` | `d788a78d-cd1f-4ab5-880f-ad3cb2c46d62` | Hana |
| `1a14635a-95c4-4d24-8037-4d13853e1008` | `af1cd578-e75e-449e-a9af-50c242fd52ef` | Hana |
| `f36fb145-ecdb-4516-9695-a9a719c0848a` | `e1f992e0-78dc-427c-acf1-797605b8ad72` | Rishabh |

Observed before: **3**. Deleted: **3**. Observed after all tests: **0**. No blanket reset, no review deletion, no legitimate-vote visibility cleanup.

## Actual schema and security

- Reviews have no `is_deleted` or `deleted_at`; installed status check accepts `published`, `flagged`, `deleted`. Eligibility is existing row + `visibility='public'` + `status='published'`.
- Existing `UNIQUE(review_id,user_id)` preserved; review FK retains `ON DELETE CASCADE`.
- All existing `review_likes` policies removed; one SELECT policy permits authenticated viewers' own votes only on eligible public reviews, excluding self-votes.
- All table and column privileges revoked from PUBLIC/anon/authenticated; authenticated SELECT explicitly restored, service_role ALL explicitly retained. No ordinary INSERT/UPDATE/DELETE or other table mutation privileges remain.
- `toggle_review_like(uuid,uuid DEFAULT NULL)` derives identity exclusively from `auth.uid()`; rejects no identity or a non-null mismatched legacy ID, ineligible reviews and authors. Parent review `FOR UPDATE` lock serializes toggles and protects eligibility against concurrent visibility/deletion changes. Deletes existing vote → false; inserts absent vote → true.
- `get_review_likes_batch(uuid[])` returns only `(review_id,like_count)` for eligible public reviews and excludes self-votes; no row for private/nonpublished/missing reviews.
- `get_user_review_likes(uuid[],uuid DEFAULT NULL)` authenticates identity and rejects mismatches; returns only the caller's eligible public selected IDs.
- All three are postgres-owned SECURITY DEFINER, `search_path=''`, schema-qualified application objects. PUBLIC execute revoked; anon may execute only counts; authenticated may execute all three; explicit service_role execution retained, with identity checks still required in identity-bearing RPCs.
- Installed inventory: exactly three Helpful RPCs, one per name; no old overload. No view referencing review_likes. Additional SQL references are existing trending candidate/scorer and service-only social influence routines; no voter-list endpoint was found. These established ranking routines were not changed in this scoped phase.

## Compatibility and preservation

Matching legacy user-ID arguments, omitted arguments and explicit NULL were tested. Existing boolean/table return contracts remain. Existing services/callers and all UI remain untouched; their matched viewer IDs remain compatible. Entity enrichment's direct own-vote SELECT still works for eligible public reviews.

Votes survive Public → Private unchanged; vote/unvote and both read paths hide/freeze them; Public again restores count and selected state. No visibility-trigger cleanup added. Authorized hard deletion still cascades. Ratings/recommendation fields and Phase 10 review/post/update policies were snapshot-checked unchanged. No Timeline, media/Mux, entity-metric, sort or comment changes.

Existing services still translate toggle errors to false and currently fetch counts only when signed in. Correct mutation-error reconciliation and guest count loading belong to 11.2–11.3, alongside shared pending/optimistic state; no UI integration is claimed here. Do not automatically retry an ambiguous toggle failure.

## Verification evidence

| Check | Result |
|---|---|
| Database-role authorization/behavior tests | PASS: 31 + 6 assertions; all fixtures rolled back |
| Identity absent/spoofed; self-vote; known-ID private/flagged/deleted | PASS |
| Direct INSERT/UPDATE/DELETE bypass; voter enumeration/other selection | PASS |
| Authorized definer mutation after client write revocation | PASS |
| Unique pair enforcement; Public/Private retention/restoration; authorized cascade | PASS |
| Explicit effective privileges for anon/authenticated/service_role/postgres | PASS |
| Real guest REST: counts, private lookup, table enumeration, mutation, selected-state | PASS: 5 requests; eligible count endpoints 200, denied identity endpoints rejected |
| Full Vitest | PASS: 118 files, 1,345 passed, 3 skipped, 0 failed (105.71s) |
| Automatic preview build | PASS: latest available build log says `build OK` |
| Separate TypeScript / production build | NOT INDEPENDENTLY VERIFIED: harness exposes only combined build OK; manual commands prohibited by environment instructions |
| Public entity browser rendering | PASS: canonical entity page rendered, zero page errors; no Helpful UI introduced |
| True concurrent sessions / visibility-vote overlapping race | BLOCKED: no managed PG connection or mintable signed-in external Supabase session; lock implementation inspected, not claimed as a concurrency-test pass |
| Real signed-in browser vote/readback across accounts | BLOCKED: external user-managed Supabase session minting refused; database-role simulations are not genuine sessions |

Test fixture corrections: initial insertion correctly hit subject-required validation; attached an existing product. The initial nonpublished fixture used unsupported `draft`; changed it to installed `flagged` and separately tested `deleted`. Failed attempts rolled back entirely, no application rules weakened.

## Linter and remaining risks

The count RPC's intentional anon/authenticated SECURITY DEFINER accessibility yields two advisory findings. Reviewed Supabase linter guidance: intentional findings should be checked against intended access. This endpoint must bypass voter-row RLS to provide anonymous aggregates; explicit public eligibility and aggregate-only return shape were verified. Revoking access or using invoker would break the approved guest counts. These are documented intentional exceptions, not evidence of zero privacy risk.

441 findings predated the security migration; the two intentional aggregate advisories bring the reported total to 443. Review unrelated findings separately before launch; no unrelated security refactor performed. Secure private-photo access, private Mux feasibility and previously shared/downloaded-media disclosures remain on the pre-launch list.

Future Review Comments/Q&A recorded in `docs/roadmap/future-roadmap.md`, not a launch blocker. Phase 10 remains founder-signed-off per the conversation; this phase does not reopen it. Phase 11.2 requires separate approval.