UPDATE public.app_config
SET value = '{"enabled": true}'::jsonb,
    updated_at = now(),
    updated_reason = 'Phase 3.2 — enable draft-driven review UI for admins'
WHERE key = 'entity_extraction.review_uses_draft';

INSERT INTO public.app_config_audit (key, old_value, new_value, changed_by, reason)
SELECT 'entity_extraction.review_uses_draft',
       '{"enabled": false}'::jsonb,
       '{"enabled": true}'::jsonb,
       NULL,
       'Phase 3.2 — enable draft-driven review UI for admins'
WHERE EXISTS (SELECT 1 FROM public.app_config WHERE key = 'entity_extraction.review_uses_draft');