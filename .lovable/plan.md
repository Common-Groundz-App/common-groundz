## Step C2 — Raise manual cap to 200

Step 6 verified clean: 0 referenced rows for any of the 5 sampled deleted paths. First 50-cap run was safe and accurate. Drain the remaining ~181 orphans in one larger manual run, still gated by the cron secret and still manual-only.

---

### 1. Code change (single line)

File: `supabase/functions/cleanup-orphan-media-execute/index.ts`

```diff
- const MAX_DELETIONS_HARD_CAP = 50;
+ const MAX_DELETIONS_HARD_CAP = 200;
```

Nothing else changes. Same auth gate, same scanner, same audit row, same batch-of-100 deletes, same `mode` default of `'dry-run'`.

---

### 2. Manual invocation SQL (after deploy)

```sql
select net.http_post(
  url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/cleanup-orphan-media-execute',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret')
  ),
  body := jsonb_build_object('mode', 'execute', 'maxDeletions', 200),
  timeout_milliseconds := 90000
);
```

Then verify:

```sql
select id, started_at, finished_at, mode, scanned, would_delete, deleted,
       skipped_young, skipped_referenced, referenced_path_count,
       array_length(sample_deleted, 1) as sample_count, errors, took_ms
from public.media_cleanup_runs
order by started_at desc
limit 1;
```

Expected:
- `mode = 'execute'`, `deleted` ≤ 200, `errors = []`
- `would_delete` should be roughly the prior `wouldDelete (231)` minus the 50 already deleted, plus any newly-aged-in orphans (so ~180–200).
- `took_ms` well under the 90s timeout.

---

### 3. Post-run verification

1. App spot-check: open Feed, a few entity pages, recent posts/reviews → no broken images.
2. Step 6 repeat: pick 3–5 paths from the new `sample_deleted` and re-run the same cross-table reference query → expect 0 rows.
3. Storage UI: bucket object count dropped by ~`deleted`.

---

### 4. What stays unchanged / deferred

- Default `mode` stays `'dry-run'` — execute requires explicit body param.
- No cron schedule for execute. Still manual-only.
- Existing weekly dry-run cron untouched as continuous monitor.
- Step E (scheduled execute with pre-flight threshold) remains deferred until you explicitly approve, ideally after this 200-cap run + one more clean run is observed.

---

### 5. After this run

If the 200-cap run is clean:
- Most of the backlog will be gone. Future dry-runs should report `wouldDelete` close to 0 outside of natural churn.
- Next decision point: either (a) leave it manual and run on demand whenever dry-run reports a backlog, or (b) build Step E (auto-execute only when `wouldDelete < safety_threshold`, e.g. 100). I'll wait for your call before touching that.

If anything is off (errors > 0, broken images, unexpected `deleted` count): halt, paste the audit row + screenshots, we investigate before touching the cap again.
