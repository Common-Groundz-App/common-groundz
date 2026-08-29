REVOKE EXECUTE ON FUNCTION public.create_entity_subject(text, text, uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_entity_subject(text, text, uuid, text, text, text, jsonb) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.normalize_identity_name(text) FROM anon;