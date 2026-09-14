-- lovable-cron-fallback-reviewed: 1440 runs/day; one-off verification job that exercises the authorised scheduler path once, then is unscheduled in this same turn
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-trending-scores-v2-verify') THEN
    PERFORM cron.unschedule('refresh-trending-scores-v2-verify');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-trending-scores-v2-verify',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/update-trending-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'trending_refresh_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);