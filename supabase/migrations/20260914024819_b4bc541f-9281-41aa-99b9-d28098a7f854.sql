-- 4.2B.4A-bis: Vault-backed cron secret + validator + hourly trending scheduler.

-- Vault entry, created only if absent; value is random and never printed or committed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'trending_refresh_cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'trending_refresh_cron_secret');
  END IF;
END $$;

-- Service-role-only validator routine. Rejects null/empty input explicitly.
CREATE OR REPLACE FUNCTION public.is_valid_trending_cron_secret(p_presented text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_presented IS NOT NULL
     AND p_presented <> ''
     AND EXISTS (
       SELECT 1
       FROM vault.decrypted_secrets
       WHERE name = 'trending_refresh_cron_secret'
         AND decrypted_secret = p_presented
     );
$$;

ALTER FUNCTION public.is_valid_trending_cron_secret(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_valid_trending_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_trending_cron_secret(text) TO service_role;

-- Idempotent scheduling: remove any previous job of this exact name via an explicit
-- existence check (no broad exception swallowing), then schedule exactly one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'refresh-trending-scores-v2-hourly'
  ) THEN
    PERFORM cron.unschedule('refresh-trending-scores-v2-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-trending-scores-v2-hourly',
  '20 * * * *',
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