## Lower MAX_DELETIONS_HARD_CAP from 200 to 50

The backlog is cleared (181 orphans deleted, 0 remaining, 0 errors, 0 referenced). Drop the manual execute cap back to a conservative 50 as a defensive limit for any future runs.

### What will change
- `supabase/functions/cleanup-orphan-media-execute/index.ts` — change `MAX_DELETIONS_HARD_CAP` from `200` back to `50`.
- No other code changes.

### What stays the same
- Default `mode` remains `'dry-run'`.
- Weekly dry-run cron continues unchanged as the monitor.
- `cleanup-orphan-media-execute` stays manual-only (no auto-execute cron).
- Step E (scheduled execute with safety threshold) remains deferred until after 1–2 weekly dry-runs confirm low/predictable `wouldDelete`.