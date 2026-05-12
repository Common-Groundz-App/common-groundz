## Goal

Add an **Admin → Media Cleanup** tab so you can see orphan-media health at a glance without opening the SQL editor. Ship in phases. **Phase 1 is read-only monitoring only — no destructive buttons.**

---

## Phase 1 — Read-only monitoring dashboard (this PR)

### Backend prerequisite (the audit gap)

Currently only `execute` runs write to `media_cleanup_runs`. Dry-runs return JSON but leave no row, so the dashboard would show nothing fresh after each weekly cron tick.

**Edit `supabase/functions/cleanup-orphan-media/index.ts`** to insert a row at the end of every dry-run with:
- `mode = 'dry-run'`
- `scanned`, `would_delete`, `skipped_young`, `skipped_referenced`, `referenced_path_count`, `took_ms`
- `deleted = 0`, `errors = []`, `max_deletions = null`
- `sample_deleted` reused to hold up to ~10 sample orphan paths *(see UI labeling below — column reuse is intentional to avoid a migration; if confusion grows later we can add `sample_paths` in a follow-up)*

No table schema migration. Only an RLS policy addition:

```sql
CREATE POLICY "Admins can read media cleanup runs"
ON public.media_cleanup_runs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

Writes stay service-role only.

### UI — `AdminMediaCleanupPanel.tsx`

Always-visible layout (no conditional sections — consistency over compactness):

**1. Status header**
- Big status badge from latest dry-run `would_delete`:
  - `Healthy` — 0
  - `Needs review` — 1–50
  - `Warning` — 51–200
  - `Danger` — > 200
- **Tiered staleness pill** for "Last dry-run":
  - Green: < 7 days
  - Amber: 7–10 days
  - Red: > 10 days
- **Cron context line:** "Weekly dry-run — next expected ~{day, time UTC}" (read from `cron.job`, fall back to "weekly" if unavailable).
- **Errors callout** (red banner) if the latest run's `errors` array is non-empty — surfaced at the top, not buried.

**2. Latest dry-run card**
Scanned · Would delete · Skipped (too young) · Skipped (referenced) · Referenced path count · Took (ms) · Started at

**3. Latest execute card**
Deleted · Errors · Max deletions · Took (ms) · Started at

**4. Trend sparkline**
Tiny inline chart of `would_delete` across the last ~8 dry-runs. One glance shows whether orphan count is flat, growing, or noisy — catches drift the "latest" cards can't.

**5. Recent runs table** (last 20 rows from `media_cleanup_runs`)
Columns: Date · Mode · Scanned · Would delete · Deleted · Skipped young · Skipped ref · Errors · Took
Click row → expand to show:
- For `mode = 'dry-run'` rows: section labeled **"Sample orphan paths"**
- For `mode = 'execute'` rows: section labeled **"Sample deleted paths"**
- Full `errors` JSON if non-empty

**6. Empty state**
Before the first dry-run audit row exists (right after deploy): *"No dry-run history yet — next scheduled run will populate this."* Don't render an empty/broken-looking card.

### Frontend file changes

- **New** `src/components/admin/AdminMediaCleanupPanel.tsx` — reads `media_cleanup_runs` via `supabase.from(...).order('started_at', desc).limit(20)` using React Query.
- **Edit** `src/pages/AdminPortal.tsx` — add `media-cleanup` case + render panel.
- **Edit** `src/components/admin/AdminSidebar.tsx` — add nav item ("Media Cleanup", `HardDrive` icon).
- **Edit** mobile tab row in `AdminPortal.tsx` — add "Media" entry.

### Out of scope for Phase 1 (deferred)

- "Run dry-run now" button → Phase 2
- "Run cleanup" button → Phase 3
- Email/notification alerts on stale or high `would_delete`
- CSV export of run history
- Per-bucket breakdown
- Renaming `sample_deleted` → `sample_paths` (only if reuse causes real confusion)
- Any change to `cleanup-orphan-media-execute` or the weekly cron schedule

---

## Phase 2 — "Run dry-run now" button (separate PR, later)

Safe — deletes nothing. New `admin-media-cleanup-trigger` edge function:
- Verifies `has_role(uid, 'admin')` via `getClaims()`
- Server-side calls `cleanup-orphan-media` with the cron secret (secret never reaches the browser)
- Panel gains a single button + toast + auto-refresh

---

## Phase 3 — "Run cleanup" button (much later, only after Phase 2 is proven)

Destructive action with all guardrails:
- Disabled unless latest dry-run is < 24 h old
- Disabled if `would_delete > 50` (safety threshold)
- Confirm dialog requiring typed `DELETE`
- Max cap (50) shown prominently
- Same admin-gated wrapper edge function with `mode='execute'`
- Audit row already written by execute function

---

## Summary of changes vs prior plan

| Added | From |
|---|---|
| Mode-aware row-expand label ("Sample orphan paths" vs "Sample deleted paths") | ChatGPT |
| Tiered staleness 7 / 10 days | ChatGPT |
| Trend sparkline of last ~8 dry-runs | new |
| Top-level errors callout | new |
| Cron next-run context line | new |
| Explicit empty state | new |
| Always-visible cards (no conditional layout) | new |

Stale threshold confirmed at **7 days amber / 10 days red**. Writes stay service-role only.
