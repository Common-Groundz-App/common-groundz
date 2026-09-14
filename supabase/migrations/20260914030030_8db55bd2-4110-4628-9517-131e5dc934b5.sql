DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-trending-scores-v2-verify') THEN
    PERFORM cron.unschedule('refresh-trending-scores-v2-verify');
  END IF;
END $$;