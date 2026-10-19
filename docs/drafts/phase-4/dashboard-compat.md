# Phase 4 — live-run ledger / dashboard compatibility (DRAFT, not applied)

## Ledger contract
One live run = one UUID, used identically in:
- `mux_cleanup_runs.id` and `mux_cleanup_runs.worker_run_id` (kind `live`, trigger_source `worker`)
- `mux_cleanup_live_run_lease.holder_run_id`
- every `mux_cleanup_audit_logs.run_id` the run writes (claims, finalizes, rejections)

Row lifecycle: `running` (lease acquired) → `succeeded` / `failed` (holder release) ·
`failed` + `run_lease_expired_taken_over` (closed by the next acquirer) ·
`failed` + `run_lease_lost` (stale run closing its own row) ·
`rejected_locked` + `run_already_in_progress` (refused acquirer, finished immediately).
Refusals in `dry_run` mode write no row.

## Existing dashboard functions
- `admin_list_mux_cleanup_runs` — kind-agnostic; live rows appear unchanged.
- `admin_mux_cleanup_run_detail` — joins audit on `worker_run_id`; live rows set it to their own id, so history entries appear.
- `admin_mux_cleanup_overview` — replaced in the migration: adds `last_live` and
  `live_run_lease {held, generation, expires_at}`; the token is never exposed.
- `mux_cleanup_run_json` — `stale` flag (running > 10 min) works for live rows.

## Frontend patch (apply only together with the production migration)
`src/components/admin/AdminMuxCleanupPanel.tsx`, `runSummary`:

```ts
  if (run.kind === 'live') {
    const res = (r.results ?? []) as Array<{ outcome: string; accepted: boolean }>
    const deleted = res.filter((x) => x.accepted && x.outcome === 'deleted').length
    return `Live run: ${r.claims ?? 0} claimed · ${deleted} deleted · ${r.deletes_sent ?? 0} delete requests` +
      (r.breaker ? ` · stopped: ${r.breaker}` : '')
  }
```
and add `'last_live'` to the overview card list next to `last_sweep` / `last_dry_run`.
No control to start a live run is added; live runs are server-to-server only.
