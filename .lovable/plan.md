# Phase 1.5 — Secure cron auth for `cleanup-orphan-media`

Lock down the weekly dry-run cron with a dedicated shared secret, replacing the anon-key call. Function stays dry-run only. Cron schedule is idempotent so the migration can be re-run safely.

## 1. Add the runtime secret

Use the secrets tool to create `CLEANUP_CRON_SECRET` (32+ random bytes, value entered by the user). Available to the edge function as `Deno.env.get('CLEANUP_CRON_SECRET')`. Never written to source or migration SQL.

## 2. Gate the edge function

In `supabase/functions/cleanup-orphan-media/index.ts`, immediately after the CORS preflight branch:

```ts
const expected = Deno.env.get('CLEANUP_CRON_SECRET');
const provided = req.headers.get('x-cron-secret');
if (!expected || !provided || provided !== expected) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

Confirm there is still **no delete code path** — function only returns `{ scanned, wouldDelete, skipped, sampleOrphans }`.

## 3. Store the same secret in Vault (one-off manual step)

Edge-function env vars aren't visible to Postgres, so `pg_cron` needs its own copy. The user runs this once in the Supabase SQL editor with the same value used in step 1:

```sql
select vault.create_secret(
  '<paste CLEANUP_CRON_SECRET value here>',
  'cleanup_cron_secret',
  'Shared secret for cleanup-orphan-media cron auth'
);
```

The agent never sees or writes the value.

## 4. Schedule the cron job (idempotent migration, no secret in SQL)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior job with the same name before re-scheduling
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-orphan-media-weekly-dryrun') then
    perform cron.unschedule('cleanup-orphan-media-weekly-dryrun');
  end if;
end $$;

select cron.schedule(
  'cleanup-orphan-media-weekly-dryrun',
  '0 3 * * 0',  -- Sundays 03:00 UTC
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

No anon key, no Authorization header — function is `verify_jwt = false` and authorizes purely on `x-cron-secret`.

## 5. Verification

- `curl` without header → **401**
- `curl` with correct `x-cron-secret` → **200** with `{ scanned, wouldDelete, skipped, sampleOrphans }`
- `select * from cron.job where jobname = 'cleanup-orphan-media-weekly-dryrun'` → exactly one row
- After next run, `cron.job_run_details` shows HTTP 200; edge function logs show the dry-run summary

## 6. Stage B (deferred)

No deletion code, no second function, no enable flag in this phase. Separate plan after Stage A output is reviewed.

## Execution order

1. `secrets--add_secret` for `CLEANUP_CRON_SECRET` (user enters value)
2. Edit `supabase/functions/cleanup-orphan-media/index.ts` to add the gate
3. Tell user to run the `vault.create_secret(...)` SQL with the same value
4. `supabase--migration` with the idempotent unschedule + `cron.schedule`
5. Test with `supabase--curl_edge_functions` (with and without header) — confirm 401/200
