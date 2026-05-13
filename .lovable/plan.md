## Phase 3 — manual destructive cleanup (revised)

ChatGPT's correction is accepted: **do not create a new execute function.** `supabase/functions/cleanup-orphan-media-execute/index.ts` already exists, is cron-secret gated, hard-caps at `MAX_DELETIONS_HARD_CAP = 50`, writes its own `media_cleanup_runs` audit row, and was verified by the 50/181 deletes in the Recent runs table.

Phase 3 only adds (a) an admin-gated wrapper and (b) the UI button + confirm modal.

### 1. New edge function `admin-media-cleanup-execute-trigger`

Same shape as `admin-media-cleanup-trigger`. Admin-only, never callable from the browser without a valid admin JWT.

- **Auth gate:** require `Authorization: Bearer <jwt>`, validate via `auth.getClaims`, then `has_role(user.id, 'admin')` via service-role client. Reject with 401 / 403 + sanitized error codes.
- **Body validation (zod):** `{ confirm: 'DELETE', maxDeletions: number (1-50 integer) }`. Reject with 400 on mismatch. Server clamps `maxDeletions` to `[1, 50]` regardless of payload (matches the existing `MAX_DELETIONS_HARD_CAP` in the execute function).
- **Pre-flight safety gate** (read-only, server-side):
  1. Fetch latest `media_cleanup_runs` row where `mode='dry-run'`.
  2. Reject 409 `NO_DRY_RUN` if none exists.
  3. Reject 409 `STALE_DRY_RUN` if `started_at` is older than 24h.
  4. Reject 409 `NOTHING_TO_DELETE` if `would_delete = 0`.
  5. Reject 409 `DRY_RUN_DRIFT` if `would_delete > maxDeletions * 4` (drift guard — orphan count grew way beyond the operator's expectation).
- **Capture `triggerStartedAt`** before upstream call.
- **Server-side fetch** to `cleanup-orphan-media-execute` with `x-cron-secret`, `Authorization: Bearer <SERVICE_ROLE_KEY>`, body `{ mode: 'execute', maxDeletions }`.
- **Audit read-back:** query newest `media_cleanup_runs` row with `mode='execute'` and `started_at >= triggerStartedAt`. Surface `auditWritten` boolean + new `runId` in response.
- Return `{ ok, auditWritten, runId, result }`. Never echo service role key or cron secret.
- Register in `supabase/config.toml` with `verify_jwt = false` (in-code validation, matching project convention).

### 2. Frontend — `AdminMediaCleanupPanel.tsx`

Add a destructive action region directly under the schedule/staleness lines.

**Button states (derived from latest dry-run row already in the panel's query):**

| Condition | Button | Inline reason text |
|---|---|---|
| No dry-run row | disabled | "Run a dry-run first" |
| Latest dry-run > 24h old | disabled | "Latest dry-run is stale — run a fresh one" |
| `would_delete = 0` | disabled | "Nothing to clean up" |
| Otherwise | enabled (`variant="destructive"`, `Trash2` icon) | shows `would_delete` count |

**Confirmation modal** (`AlertDialog`):
- Title: `Permanently delete orphan media?`
- Body shows: bucket (`post_media`), latest dry-run timestamp ("Based on dry-run from 12 minutes ago"), `would_delete` count, first 5 sample paths from `sample_deleted` (monospace, truncated).
- `maxDeletions` numeric `Input`, label "Max files to delete this run", default `Math.min(50, would_delete)`, `min={1}` `max={50}`.
- Type-to-confirm `Input`, placeholder `Type DELETE to confirm`. Confirm button stays disabled until value === `'DELETE'`.
- Confirm copy: `Permanently delete N files` (N = clamped maxDeletions).
- Cancel button always enabled (except while loading).

**Submit handler:**
- `supabase.functions.invoke('admin-media-cleanup-execute-trigger', { body: { confirm: 'DELETE', maxDeletions } })`.
- On success: toast `Deleted N files` (N from `result.deleted`); if `result.errors.length > 0` use warning toast `Deleted N, M errors — see Recent runs`; if `auditWritten === false` show separate warning `Cleanup ran but audit row not found — check edge function logs`.
- On 409 from preflight: toast the human reason mapped from error code (e.g. `Nothing to clean up`, `Latest dry-run is stale`, `Orphan count drifted — re-run dry-run`).
- On 401/403: toast `Not authorized` (should never happen since the panel itself is admin-gated, but defend anyway).
- `queryClient.invalidateQueries(['admin-media-cleanup-runs'])` so the new execute row, sparkline, and "Latest execute" card refresh immediately.
- 60s cooldown after success or failure (vs 30s for dry-run), tracked the same way as the existing dry-run cooldown.

### 3. Out of scope (explicit non-goals)

- No automatic execute cron. Cron stays dry-run only.
- No raising `MAX_DELETIONS_HARD_CAP` above 50 in this phase.
- No editing schedule from UI, no email/Slack alerts, no per-bucket breakdown.
- No undo / soft-delete buffer.
- No rename of `sample_deleted` column.

### 4. Files

- New: `supabase/functions/admin-media-cleanup-execute-trigger/index.ts`
- Edit: `supabase/config.toml` — register the new function with `verify_jwt = false`
- Edit: `src/components/admin/AdminMediaCleanupPanel.tsx` — add disabled-aware button, confirm modal, mutation, cooldown, toasts

No DB migration. No changes to `cleanup-orphan-media-execute` or `cleanup-orphan-media`.

### 5. Why this is safe

Three independent gates must all pass before a single object is deleted:
1. Browser: type-to-confirm `DELETE` + admin-only route.
2. Wrapper function: admin JWT + `has_role` + preflight checks against latest dry-run.
3. Execute function: cron-secret + server-side hard cap of 50.

A misclick, a stolen anon key, or a single compromised gate is not enough to cause data loss.
