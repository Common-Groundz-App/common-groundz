## Plan

Update the scheduled `cleanup-orphan-media` invocation so `pg_net` waits long enough for the dry-run to finish.

### What I’ll change
- Keep the Edge Function logic as-is for now.
- Update the cron SQL to pass an explicit timeout to `net.http_post(...)` instead of relying on the 5s default.
- Keep the schedule idempotent by unscheduling the old `cleanup-orphan-media-weekly-dryrun` job before recreating it.
- Use the same longer timeout for the one-off manual trigger query so validation matches production behavior.

### Why this is the right fix
- The function is not failing internally.
- Edge logs show the dry run completed successfully with `tookMs: 5783`.
- `pg_net` is timing out first at ~5000 ms, which is why `net._http_response` shows `status_code = null` and the timeout error.
- The `net.http_post` signature in this project supports a final integer timeout argument, so this is a targeted fix.

### Technical details
I’ll change the cron call from the current 3-argument pattern to include a timeout, e.g.:

```sql
select net.http_post(
  url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/cleanup-orphan-media',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret')
  ),
  body := jsonb_build_object('triggered_at', now(), 'mode', 'dry-run'),
  timeout_milliseconds := 15000
);
```

### Validation
After updating the schedule, I’ll verify:
- `cron.job` still contains exactly one active `cleanup-orphan-media-weekly-dryrun` job.
- A manual invocation returns a real `status_code = 200` in `net._http_response`.
- The latest Edge Function logs still show the dry-run summary, but without the `pg_net` timeout issue.

### Fallback only if needed
If it still runs too close to the limit after that, the next step would be optimizing the scan or breaking it into smaller batches — but I would not do that unless the timeout increase proves insufficient.