# Mux cleanup Phase 2 — implementation and verification

Status: IMPLEMENTED; live observational inventory and signed-in integration verification BLOCKED. Not accepted/complete. Stop for owner review; Phase 3 not started.

## Phase 2A

- `mux-create-upload` deployed. Server allocates `crypto.randomUUID()` before calling Mux, then inserts the normal `mux_uploads` row with that ID after Mux responds. No reservation schema introduced (`upload_id` is NOT NULL).
- Passthrough contains only `v:1`, `app:commongroundz`, `env:live|test` (trusted server Mux mode), `upload_record_id`, `kind`. Dashboard `meta.external_id` repeats that opaque UUID; no title, creator ID, user ID, content ID, content text, auth/session data, signed URL or credentials.
- New client callers explicitly send `post`, `review`, `review_update`. Every supplied invalid kind, including `unknown`, is rejected with 400 `invalid_kind` after authentication.
- Proven backward compatibility exception: previous deployed clients send `{}` or `{declared_size}`. Omitted kind alone maps to server-defined `unknown`; explicit `unknown` is rejected. This is neutral, not inferred as Post.
- Existing CORS/origin policy, upload response shape, storage fallback policy, cancellation/retry behavior, timeout, public playback setting and Mux test/live flag remain unchanged. No migration of the existing deprecated `new_asset_settings` shape in this phase.
- If Mux creation succeeds and database persistence fails/is uncertain: one insert attempt, server error, no upload URL returned, no cancellation/deletion or automatic creation retry. Logs include only event, upload record ID, Mux upload ID and outcome label. Mux creation transport uncertainty logs correlation only. Expiry/reconciliation are future recovery mechanisms, not proof no unrecorded upload exists.

## Phase 2B

Deployed admin-only GET `mux-inventory`: verified JWT + database `has_role` check before inventory. Database SELECTs and Mux GETs only; no lifecycle changes, queue, claims, jobs or deletion API calls.

- Independently reports Mux presence (`present`, individually probed HTTP-404 `external_missing`, `inconclusive`) and app reference state.
- Scans full `posts.media`, `reviews.media`, `review_updates.media`, mappings and uploads; saved asset IDs without upload rows are also individually probed. Matches upload, asset, playback identity and canonical Mux URL identity; mapping status is never deletion authority.
- Cursor pagination follows `next_cursor`; page pagination is supported when the response lacks cursors. Partial/failed/repeated-page scans fail closed. Database surfaces are independently paginated. Auth/network/timeout/rate-limit/server errors never imply missing.
- Active saved references survive missing Mux state and appear as `broken_reference`. Historical deleted Posts remain `historical_deleted_ambiguous`: no `deleted_at`, and neither upload age nor `updated_at` establishes deletion age. Missing parents are protected.
- Recent ready-but-unlinked uploads remain protected for 24 hours. Old waiting/processing is ambiguous, not indefinite active-processing proof. Old ready/errored zero-reference observations are only `ambiguous_workflow_orphan_candidate`: current data has no durable active-composer attempt ledger, so absence of an active workflow cannot be proven. Every result has `deletion_eligible:false`.
- Reports exact distinct sets M, S, intersection, M-only, S-only, independent 404 probes, timestamps and non-atomic-snapshot warning. No raw media or content text is returned.
- Upload rows without an asset are separately reported for future upload reconciliation, not ignored as deleted assets.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Complete app suite | PASS | `bun run test`: 90 files, 1,159 passed, 3 skipped, 0 failed; includes exact Post/Review/update kind request regression checks |
| Metadata/classifier/analytics helpers | PASS | Deno: 22 passed, 0 failed (6 metadata + 10 classifier + 6 existing review analytics) |
| Both changed Edge entrypoints | PASS | `deno check --no-lock --node-modules-dir=auto` clean; explicit SDK version used for CORS export unavailable in the project's older client SDK |
| Preview build | PASS | Latest observed `/tmp/observability/build-errors.log`: build OK; harness performs build/type validation |
| Standalone client typechecks/production build | BLOCKED by execution policy | This environment forbids manual project builds/typechecks; harness validation used instead. These were not represented as standalone runs |
| Edge deployment | PASS | mux-create-upload submitted SHA-256 `62b827980775af720b20d1737554cc8206213816fa3193fed1aa806d9bb4a77c`; inventory final deployment evidence in tool response |
| Anonymous inventory access | PASS | Deployed GET `/mux-inventory` returns HTTP 401 `unauthorized` |
| Authenticated invalid-kind request | BLOCKED | Deployed request returned 401 before input parsing; strict rejection verified by helper tests, not signed-in live request |
| Fresh live Mux inventory / set comparisons / known examples | BLOCKED | No authenticated admin session in external-unmanaged project; inventory GET returns 401. Existing Mux credentials are server-only. No auth bypass was added and prior inventory numbers were not reused as fresh results |
| Real new-upload metadata in Mux | BLOCKED | No signed-in upload session; local payload/persistence tests pass, provider round-trip unverified |

## Fresh database-only observations

Read-only query at **2026-10-18 03:48:16.668408 UTC**:

- 85 upload rows; 79 distinct recorded asset IDs; 6 rows without an asset ID; 5 expired rows still waiting.
- 25 soft-deleted Posts contain Mux-like media. `posts.deleted_at` column count: 0.
- These are database observations, NOT current Mux storage counts. No fresh claim of 10 assets / 9 intersection / 70 missing is made without an authorized Mux scan.
- The two prior zero-reference assets, two deleted-Post assets and the missing live Review are validation cases still awaiting independent live verification; nothing repaired or deleted.

## Flags and review gate

Fresh database read: `reviews.video_enabled=false`, `reviews.composer_page_enabled=true`, `mux.uploads_enabled=true`, `mux.prewarm_enabled=true`, `mux.mode=live`, `notifications.realtime_enabled=true`. No flags changed.

Next permitted action is owner review / authorized observational verification, NOT Phase 3. Later live cleanup still requires durable attachment/deletion coordination, committed-delete timing, authoritative asset-level reference rechecks and uncertain-outcome recovery. No restoration/trash product or database deletion-semantic change was introduced.