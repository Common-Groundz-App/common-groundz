## Next steps

### 1. Verify Vault secret is readable
Run a quick read-only query to confirm `cleanup_cron_secret` exists in `vault.decrypted_secrets` (without exposing the value):

```sql
select name, length(decrypted_secret) as secret_length, updated_at
from vault.decrypted_secrets
where name = 'cleanup_cron_secret';
```

Expect one row with `secret_length >= 32`.

### 2. About testing the correct-secret path directly

I cannot curl the edge function with the correct secret myself — the value lives only in your Vault and in `CLEANUP_CRON_SECRET` (a runtime secret I cannot read). The 401 path is already verified.

Two options for the 200 path:
- **(A) Skip direct curl and validate via the cron run.** Schedule the job, trigger it once, and verify HTTP 200 in `cron.job_run_details`. This is the real production path anyway.
- **(B) You manually curl** with the same value you stored, e.g.:
  ```
  curl -i -X POST \
    -H "x-cron-secret: <your value>" \
    -H "Content-Type: application/json" \
    -d '{"mode":"dry-run"}' \
    https://uyjtgybbktgapspodajy.supabase.co/functions/v1/cleanup-orphan-media
  ```

Recommended: **(A)** — it tests the full Vault → pg_net → edge function chain end-to-end.

### 3. Run idempotent cron migration

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-orphan-media-weekly-dryrun') then
    perform cron.unschedule('cleanup-orphan-media-weekly-dryrun');
  end if;
end $$;

select cron.schedule(
  'cleanup-orphan-media-weekly-dryrun',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/cleanup-orphan-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_cron_secret')
    ),
    body := jsonb_build_object('triggered_at', now(), 'mode', 'dry-run')
  );
  $$
);
```

No secret in SQL, no anon key, idempotent on re-run.

### 4. Trigger one run now and verify

After the migration, run the same `net.http_post` body once manually so we don't have to wait until Sunday 03:00 UTC, then check:

```sql
select status, status_code, content::text
from net._http_response
order by created desc
limit 1;
```

Expect `status_code = 200` with the dry-run JSON summary in `content`.

Also confirm the schedule:
```sql
select jobname, schedule, active from cron.job
where jobname = 'cleanup-orphan-media-weekly-dryrun';
```

### 5. Stage B remains deferred

No deletion code, no second function. Separate plan after you review the dry-run output.
