-- Phase 4.2B.3: schedule refresh-social-influence-v2 through the protected Edge Function.
-- The internal cron token is generated inside the database and stored only in Vault.
-- No literal secret appears in this migration, in source, or in docs; everything else
-- references the Vault entry by name. The token travels only over HTTPS in the cron
-- request header at execution time.
-- Verified live: the function has an explicit [functions.refresh-social-influence-v2]
-- verify_jwt = false entry in config.toml, and an unauthenticated POST reaches the
-- handler and is rejected by its own custom check (HTTP 401 {error:'unauthorized'}),
-- not by a platform JWT gate. The underlying refresh RPC is untouched.

-- 1. Vault entry (generated in place; created only if absent so re-runs never rotate blindly)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'influence_refresh_cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'influence_refresh_cron_secret');
  END IF;
END $$;

-- 2. DB-side validator: the Edge Function (service role) presents the header value and
--    the database answers true/false; the stored value is never returned to any caller.
CREATE OR REPLACE FUNCTION public.is_valid_influence_cron_secret(p_presented text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_presented IS NOT NULL
     AND p_presented <> ''
     AND EXISTS (
       SELECT 1
       FROM vault.decrypted_secrets
       WHERE name = 'influence_refresh_cron_secret'
         AND decrypted_secret = p_presented
     );
$$;

ALTER FUNCTION public.is_valid_influence_cron_secret(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_valid_influence_cron_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_influence_cron_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_influence_cron_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_influence_cron_secret(text) TO service_role;

-- 3. Scheduled job: exactly one, calling the protected endpoint with the Vault-backed header
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-social-influence-v2-daily') THEN
    PERFORM cron.unschedule('refresh-social-influence-v2-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-social-influence-v2-daily',
  '12 4 * * *',
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