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