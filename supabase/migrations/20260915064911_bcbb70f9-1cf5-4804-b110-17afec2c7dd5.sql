DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-entity-stats-view-hourly') THEN
    PERFORM cron.unschedule('refresh-entity-stats-view-hourly');
  ELSE
    RAISE EXCEPTION 'Expected cron job refresh-entity-stats-view-hourly not found';
  END IF;
END $$;

DROP MATERIALIZED VIEW public.entity_stats_view;