-- lovable-cron-fallback-reviewed: 1440 runs/day; temporary verification-only job, unscheduled within minutes of this migration after exactly one observed run
-- Temporary verification job: identical command to refresh-social-influence-v2-daily,
-- runs every minute so we can observe exactly one end-to-end run. NOT self-cleaning:
-- it is removed by an explicit cron.unschedule immediately after verification.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-social-influence-v2-verify') THEN
    PERFORM cron.unschedule('refresh-social-influence-v2-verify');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-social-influence-v2-verify',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-social-influence-v2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'influence_refresh_cron_secret')
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  );
  $$
);