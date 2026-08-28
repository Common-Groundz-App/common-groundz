ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.slugify_entity_name(input_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT trim(both '-' FROM
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(extensions.unaccent(coalesce(input_name, ''))),
          '[^a-z0-9[:space:]-]', '', 'g'
        ),
        '[[:space:]]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$function$;

ALTER FUNCTION public.slugify_entity_name(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.slugify_entity_name(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slugify_entity_name(text) TO service_role;