# One-time historical Mux reconciliation — 2026-10-25

Migration: `20261025082347_aadba8c8-20bc-4116-b41b-8fec9b566a72.sql`.
Audit run: `340b7811-ac2f-4544-a092-334938451325`.

## Results

| Candidate status | Before | After |
| --- | ---: | ---: |
| protected_ambiguous | 72 | 0 |
| pending_grace | 8 | 12 |
| reconciled_already_deleted | 18 | 86 |
| deleted | 4 | 4 |
| eligible / rescued_referenced / deleting / retryable_error / failed_manual | 0 | 0 |
| Total | 102 | 102 |

Fresh read-only Mux GETs checked all 72 explicitly enumerated historical asset IDs at approximately 08:17 UTC: 68 returned 404; four returned 200/ready. The migration reran the authoritative saved-reference/in-flight/mapping check under upload-row → asset-advisory → candidate-row locks. All 72 were unreferenced. Profile/entity dependencies were also checked. No historical row was skipped or failed.

68 `reconciled_404` audit rows truthfully record `externally_missing_from_mux`, GET/404, unknown deletion time/cause and `mux_delete_issued=false`. Permanent missing-asset attachment barriers use the existing guarded transaction-local authorization; guards and constraints were not disabled. Upload records were not modified.

Four `historical_requeued` audit rows record the owner authorization, prior timestamps and fresh grace timestamps. The audit-action allowlist was extended with that truthful label; existing values were preserved. No worker-success or premature-eligibility audit was fabricated.

## Four survivors

All are `pending_grace`, discovered at **2026-10-25 08:23:47.742766 UTC**, eligible at **2026-10-26 08:23:47.742766 UTC**:

- `4e01qUhCGuD01P2Xha01aiRn4uxoL026IXZiua01cBty8JzQ`
- `977zNtCwzAhexDcv2l0102gga3EOH1ySOHFfEqKWuIdq8`
- `DqfLYb2Q01E3qXKglfisoy6D3eGU3DiDgnrIl7shmX01g`
- `zgq02dHpBCG100JuFBHeXmlzPb39HnyxrOBi4IUO7UWTg`

No Mux DELETE was issued. Actual deletion remains pending time and successful normal worker execution. The first normally scheduled opportunity is October 26 at 08:50 UTC, subject to final reference checks and worker success.

## Preservation

The migration asserted whole-table mux_uploads and all nonhistorical candidate snapshots unchanged, including both exclusions. Control, hourly cron and candidate guard definition were also asserted unchanged. Live remains ON, target NULL, cron active `50 * * * *`.

- `VTO5q8FXmfTeeRkKTJY029xTn6OQScwgp01oN00ZyTV5K4`: candidate unchanged, pending_grace until October 26 06:50:02.574919 UTC; fresh Mux GET 200.
- `Q00EpNYlqK5OtvCsZhcqoa02onvTiNgD3Hu9LG4bE2Bro`: candidate unchanged, pending_grace until October 25 14:50:03.019928 UTC; fresh Mux GET was already 404 **before** this migration. Its disappearance is not attributed to this operation. It remains excluded rather than opportunistically reconciled.

Neither exclusion pins an asset against its existing prospective lifecycle. Zero audit rows from this operation concern the exclusions.

Project worker source SHA-256: `65cd82304f57015d83a50fdf324af3cbc5601cef657a21a0da404374be7dd5db`. It contains no metadata/environment gate; it uses existing database claim/reference/lease checks. Read-only source audit found no canary dependency on the four historical IDs. Sandbox Mux credentials saw the latest app test asset and all four historical survivors. This is environment-consistency evidence, not an independent readback of deployed Edge source or its secret identity; neither was changed or redeployed.

## Verification

Read-only acceptance suite retained in `supabase/tests/mux_historical_reconciliation.sql`: all five checks passed (missing audit, missing barrier, exact fresh 24h grace, 72 audits, exclusions). Fresh query confirmed exact after totals. Preview log reports build OK. No app, worker, cron, TTL, future protection, rescue or deletion-policy changes.

446 security-linter findings predate this migration; none were introduced. They remain outside this approved scope.