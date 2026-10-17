UPDATE public.app_config
SET value = jsonb_set(value, '{enabled}', 'false'::jsonb, true),
    updated_at = now(),
    updated_by = NULL,
    updated_reason = 'Phase 6 verification: restore production Review videos OFF as explicitly requested; no other flag changes'
WHERE key = 'reviews.video_enabled'
  AND value->'enabled' IS DISTINCT FROM 'false'::jsonb;