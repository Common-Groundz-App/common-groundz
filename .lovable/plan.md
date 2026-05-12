
## Phase 2 — "Run dry-run now" button

Goal: let an admin manually trigger a dry-run from the Media Cleanup panel without opening the SQL editor or knowing the cron secret. **Still non-destructive** — the existing `cleanup-orphan-media` function only scans and reports.

---

### Step 0 — Prerequisite: verify Phase 1 audit logging (do this FIRST)

Confirmed via DB: `media_cleanup_runs` currently has only 2 rows, both `mode='execute'`. The dry-run audit-insert code shipped in Phase 1 has never actually run in production, because the weekly cron hasn't ticked since deploy.

Before building the button, manually invoke the existing `cleanup-orphan-media` function once with the cron secret and verify:
1. A new row appears in `media_cleanup_runs` with `mode = 'dry-run'`.
2. The row has non-null `scanned`, `would_delete`, `skipped_young`, `skipped_referenced`, `referenced_path_count`, `took_ms`.
3. `sample_deleted` is populated with sample orphan paths (or empty array if none).
4. The admin panel flips from "No dry-run history yet" to showing real numbers + status badge + staleness pill.

If the row does not appear → fix the insert (likely an RLS/role issue, schema mismatch, or thrown error suppressed in the try/catch) **before** continuing. Without this, the Phase 2 button would appear to succeed but leave the dashboard empty.

### Step 1 — New edge function: `admin-media-cleanup-trigger`

Path: `supabase/functions/admin-media-cleanup-trigger/index.ts`

Responsibilities:
- `OPTIONS` → CORS preflight
- `POST` only; reject others with 405
- Validate the caller's JWT using the anon client + `Authorization` header → get `user.id` via `getClaims()`
- Check `has_role(user.id, 'admin')` via the service-role client; reject with 403 if not admin
- Read `CLEANUP_CRON_SECRET` from env; if missing, return 500 with a clear "secret not configured" message
- Capture `triggerStartedAt = new Date().toISOString()` *before* the upstream call
- Server-side `fetch` to `${SUPABASE_URL}/functions/v1/cleanup-orphan-media` with header `x-cron-secret: <secret>` and `Authorization: Bearer <SERVICE_ROLE_KEY>`
- After the upstream returns 200, **read back** `media_cleanup_runs` for the most recent `mode='dry-run'` row where `started_at >= triggerStartedAt`. Include `auditWritten: boolean` in the response
- Forward the upstream JSON `result` + `auditWritten` flag + status to the caller
- Wrap everything in try/catch; never echo the secret in logs or responses

Body: ignored (mode is always dry-run because that's the only mode this function reaches).

Config: `verify_jwt = false` in `supabase/config.toml` (we validate JWT in code, project convention).

Secret: `CLEANUP_CRON_SECRET` already exists. No new secrets.

### Step 2 — Frontend changes — `AdminMediaCleanupPanel.tsx` only

Add to the **status header card** (right side, next to the badges):
- A **"Run dry-run now"** button (primary variant, `Play` icon)
- Loading state: spinner + "Scanning…" label, button disabled
- Disabled also while `isLoading` (initial query) or if `!isAdmin` (defensive — page is already admin-gated, but cheap belt-and-suspenders)
- On success **with** `auditWritten = true`: `toast.success("Dry-run complete — N orphan files {found|need review}")` (use "found" if 0, "need review" if >0)
- On success **with** `auditWritten = false`: `toast.warning("Scan completed but audit row was not written — check edge function logs.")`
- On failure: `toast.error(<sanitized message>)`. Secret cannot leak — it never reaches the browser
- After success: `queryClient.invalidateQueries(['admin-media-cleanup-runs'])` so cards/table/sparkline refresh
- 30-second client-side cooldown after a successful run

Trigger via `supabase.functions.invoke('admin-media-cleanup-trigger', { method: 'POST' })`.

Also add a small **schedule line** under the panel description (closes the Phase 1 cron-context-line gap with zero added complexity):
> "Scheduled: weekly dry-run · Sundays 03:00 UTC"

Static text — no DB lookup. Update the literal day/time to match the actual `cron.job` entry (verify when implementing).

### Out of scope (still)

- "Run cleanup" / execute button → Phase 3
- Schedule editing
- Email alerts
- Per-bucket breakdown
- In-flight scan cancellation
- Renaming `sample_deleted` → `sample_paths`
- Any change to `cleanup-orphan-media` scan logic, the weekly cron, or `cleanup-orphan-media-execute`

---

### Technical details

**Security model:**
- Browser → `admin-media-cleanup-trigger` (admin-gated via JWT + `has_role`)
- Trigger function → `cleanup-orphan-media` (gated via `x-cron-secret`, server-only)
- `CLEANUP_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` never reach the browser

**Files touched:**
- New: `supabase/functions/admin-media-cleanup-trigger/index.ts`
- Edit: `supabase/config.toml` — register the new function with `verify_jwt = false`
- Edit: `src/components/admin/AdminMediaCleanupPanel.tsx` — add button, mutation, toast, cooldown, static schedule line

**Acceptance:**
- Step 0 passes — manual dry-run produces a `mode='dry-run'` audit row visible in the panel
- Non-admin POST to trigger → 403, no scan happens
- Admin click → button disables → toast → cards/table/sparkline update with a fresh `dry-run` row
- If audit row is missing post-scan → distinct warning toast
- Errors from the underlying scan surface in the toast and (next refresh) in the top-level errors callout
- No new database migration
