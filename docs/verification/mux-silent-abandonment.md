# Silent Mux abandonment — implemented 2026-10-24

Migration: `20261024120029_ccea16b3-0e1f-46f8-8634-f3761a859e30.sql`.

## Scope
- Both CHECK allowlists extended with `silent_abandonment`; previous values retained.
- Service-only `mux_reconcile_silently_abandoned_uploads(25)` selects trusted-kind uploads with an asset, no abandonment marker, no candidate and no saved reference after `expires_at + 1 hour`.
- Oldest `created_at ASC` first, stable ID tie-breaker; bounded batch and per-row exception isolation.
- Existing upload-row → asset advisory → candidate lock sequence; saved-reference check repeated after locking.
- Mark and enqueue are atomic; enqueue uses the existing 24-hour grace helper.
- Existing `mux_live_run_start` calls explicit and silent reconciliation in separate exception blocks.
- No composer, frontend, worker code, cron, target, selection, retry or deletion-mechanics changes.
- Trusted `kind` identifies the existing prospective server-issued cohort; no historical unknown-kind backfill or classification.

## Executed database checks
Checked-in test: `supabase/tests/mux_silent_abandonment.sql`. Ran as one database statement with synthetic IDs and a deliberate final exception to roll back every fixture and any reconciliation effects. No HTTP/Mux calls or worker invocation.

| Check | Result |
|---|---|
| Past-TTL trusted Post/Review/Timeline upload gets silent marker + pending_grace | PASS, all three kinds |
| Existing saved reference through real Post save/mapping triggers skipped | PASS |
| Younger upload and legacy unknown-kind skipped | PASS |
| Explicit composer_discarded not reclassified | PASS |
| Duplicate reconciliation leaves whole candidate and grace unchanged | PASS |
| Real Post attachment rescues queued upload, clears abandonment | PASS |
| Run-start integration reaches explicit reconciler, preserves its reason | PASS |
| All 72 protected historical rows unchanged | PASS, full-row comparison |
| Control and cron unchanged | PASS |
| New reconciler service-only | PASS: anon/authenticated false, service_role true |

After rollback: zero `silent_test_%` uploads, candidates or Posts. Historical fingerprint before and after: `533fa4dacc0195855f36c9937b8d6a72`; count 72. Live enabled true, target NULL, cron active `50 * * * *`.

Natural browser-close → elapsed TTL → hourly queueing was not exercised in real time; database fixtures prove classification, grace and rescue without waiting or deleting a real asset. No claim of a new full browser/Mux end-to-end test or concurrent-session proof.

The migration introduced no new linter findings; 446 existing findings were left outside this approved scope.