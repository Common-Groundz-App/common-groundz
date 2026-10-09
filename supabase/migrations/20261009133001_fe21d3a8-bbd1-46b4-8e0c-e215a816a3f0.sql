-- D2: server-owned cleanup of saved photos removed from reviews / timeline updates.
-- Ships with processing OFF. Nothing here deletes storage objects.

CREATE TABLE public.media_deletion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued',
  source_table text,
  source_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  lease_until timestamptz,
  last_error text,
  kept_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.media_deletion_candidates TO service_role;
ALTER TABLE public.media_deletion_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages media deletion candidates"
  ON public.media_deletion_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.media_deletion_candidates_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('queued','deleting','deleted','kept','failed') THEN
    RAISE EXCEPTION 'invalid media candidate status %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER media_deletion_candidates_validate
  BEFORE INSERT OR UPDATE ON public.media_deletion_candidates
  FOR EACH ROW EXECUTE FUNCTION public.media_deletion_candidates_validate();

INSERT INTO public.app_config (key, value, description)
VALUES ('media_cleanup.processing_enabled', 'false'::jsonb,
        'D2: when false the media deletion worker claims and deletes nothing.')
ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb,
  updated_reason = 'D2 install: processing must ship off';

CREATE OR REPLACE FUNCTION public.media_cleanup_processing_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value = 'true'::jsonb FROM public.app_config
                   WHERE key = 'media_cleanup.processing_enabled'), false);
$$;

CREATE OR REPLACE FUNCTION public.media_url_decode(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE b bytea := ''::bytea; i int := 1; ch text; n int;
BEGIN
  IF p IS NULL OR position('%' in p) = 0 THEN RETURN p; END IF;
  n := length(p);
  WHILE i <= n LOOP
    ch := substr(p, i, 1);
    IF ch = '%' THEN
      IF substr(p, i + 1, 2) !~ '^[0-9A-Fa-f]{2}$' THEN RETURN NULL; END IF;
      b := b || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    ELSE
      b := b || convert_to(ch, 'UTF8'); i := i + 1;
    END IF;
  END LOOP;
  RETURN convert_from(b, 'UTF8');
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_owned_media_path(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s text; m text[];
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  s := split_part(split_part(btrim(p), '#', 1), '?', 1);
  m := regexp_match(s, '^https://uyjtgybbktgapspodajy\.supabase\.co/storage/v1/object/(public|sign|authenticated)/post_media/(.+)$');
  IF m IS NOT NULL THEN
    s := public.media_url_decode(m[2]);
  ELSIF s ~ '^[a-z]+://' THEN
    RETURN NULL;
  END IF;
  IF s IS NULL THEN RETURN NULL; END IF;
  IF s ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+/[^/]+$' THEN
    RETURN s;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.owned_media_paths_from_jsonb(j jsonb)
RETURNS SETOF text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT DISTINCT public.normalize_owned_media_path(v #>> '{}')
  FROM jsonb_path_query(COALESCE(j, 'null'::jsonb), 'strict $.** ? (@.type() == "string")') v
  WHERE public.normalize_owned_media_path(v #>> '{}') IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.media_path_lock(p text)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('media:' || p, 0));
$$;

CREATE OR REPLACE FUNCTION public.review_owned_paths(p_media jsonb, p_image text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT array_agg(DISTINCT x) FROM (
    SELECT public.owned_media_paths_from_jsonb(p_media) x
    UNION SELECT public.normalize_owned_media_path(p_image)
  ) s WHERE x IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.media_path_keep_count(p text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; c integer; pre text := '%' || split_part(p, '/', 1) || '%';
BEGIN
  SELECT count(*) INTO c FROM public.posts WHERE media::text LIKE pre
    AND p IN (SELECT public.owned_media_paths_from_jsonb(media)); n := n + c;
  SELECT count(*) INTO c FROM public.reviews WHERE (media::text LIKE pre OR image_url LIKE pre)
    AND p = ANY (public.review_owned_paths(media, image_url)); n := n + c;
  SELECT count(*) INTO c FROM public.review_updates WHERE media::text LIKE pre
    AND p IN (SELECT public.owned_media_paths_from_jsonb(media)); n := n + c;
  SELECT count(*) INTO c FROM public.entity_photos WHERE url LIKE pre
    AND public.normalize_owned_media_path(url) = p; n := n + c;
  SELECT count(*) INTO c FROM public.entities WHERE (image_url LIKE pre OR stored_photo_urls::text LIKE pre)
    AND (public.normalize_owned_media_path(image_url) = p OR p IN (SELECT public.owned_media_paths_from_jsonb(stored_photo_urls))); n := n + c;
  SELECT count(*) INTO c FROM public.entity_suggestions WHERE suggested_images::text LIKE pre
    AND p IN (SELECT public.owned_media_paths_from_jsonb(suggested_images)); n := n + c;
  SELECT count(*) INTO c FROM public.entity_products WHERE image_url LIKE pre
    AND public.normalize_owned_media_path(image_url) = p; n := n + c;
  SELECT count(*) INTO c FROM public.profiles WHERE (avatar_url LIKE pre OR cover_url LIKE pre)
    AND p IN (public.normalize_owned_media_path(avatar_url), public.normalize_owned_media_path(cover_url)); n := n + c;
  SELECT count(*) INTO c FROM public.photo_reports WHERE photo_url LIKE pre AND COALESCE(status,'') <> 'resolved'
    AND public.normalize_owned_media_path(photo_url) = p; n := n + c;
  SELECT count(*) INTO c FROM public.cached_photos WHERE (cached_url LIKE pre OR original_url LIKE pre OR thumbnail_url LIKE pre)
    AND p IN (public.normalize_owned_media_path(cached_url), public.normalize_owned_media_path(original_url), public.normalize_owned_media_path(thumbnail_url)); n := n + c;
  SELECT count(*) INTO c FROM public.cached_products WHERE image_url LIKE pre
    AND public.normalize_owned_media_path(image_url) = p; n := n + c;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.list_kept_media_paths()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.owned_media_paths_from_jsonb(media) FROM public.posts
  UNION SELECT public.owned_media_paths_from_jsonb(media) FROM public.reviews
  UNION SELECT public.normalize_owned_media_path(image_url) FROM public.reviews
  UNION SELECT public.owned_media_paths_from_jsonb(media) FROM public.review_updates
  UNION SELECT public.normalize_owned_media_path(url) FROM public.entity_photos
  UNION SELECT public.normalize_owned_media_path(image_url) FROM public.entities
  UNION SELECT public.owned_media_paths_from_jsonb(stored_photo_urls) FROM public.entities
  UNION SELECT public.owned_media_paths_from_jsonb(suggested_images) FROM public.entity_suggestions
  UNION SELECT public.normalize_owned_media_path(image_url) FROM public.entity_products
  UNION SELECT public.normalize_owned_media_path(avatar_url) FROM public.profiles
  UNION SELECT public.normalize_owned_media_path(cover_url) FROM public.profiles
  UNION SELECT public.normalize_owned_media_path(photo_url) FROM public.photo_reports WHERE COALESCE(status,'') <> 'resolved'
  UNION SELECT public.normalize_owned_media_path(x) FROM public.cached_photos, unnest(ARRAY[cached_url, original_url, thumbnail_url]) x
  UNION SELECT public.normalize_owned_media_path(image_url) FROM public.cached_products;
$$;

CREATE OR REPLACE FUNCTION public.media_queue_removed(p_old text[], p_new text[], p_table text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  FOR p IN
    SELECT DISTINCT x FROM unnest(COALESCE(p_old, '{}')) x
    WHERE x IS NOT NULL AND NOT (x = ANY (COALESCE(p_new, '{}')))
      AND lower(x) ~ '\.(png|jpe?g|gif|webp|heic|avif)$'
    ORDER BY 1
  LOOP
    PERFORM public.media_path_lock(p);
    INSERT INTO public.media_deletion_candidates (path, status, source_table, source_id)
    VALUES (p, 'queued', p_table, p_id)
    ON CONFLICT (path) DO UPDATE
      SET status = 'queued', next_attempt_at = now(),
          source_table = EXCLUDED.source_table, source_id = EXCLUDED.source_id
      WHERE public.media_deletion_candidates.status = 'kept';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reviews_queue_removed_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.media_queue_removed(
    public.review_owned_paths(OLD.media, OLD.image_url),
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.review_owned_paths(NEW.media, NEW.image_url) END,
    'reviews', OLD.id);
  RETURN NULL;
END $$;
CREATE TRIGGER reviews_queue_removed_media
  AFTER UPDATE OF media, image_url OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_queue_removed_media();

CREATE OR REPLACE FUNCTION public.review_updates_queue_removed_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.media_queue_removed(
    public.review_owned_paths(OLD.media, NULL),
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.review_owned_paths(NEW.media, NULL) END,
    'review_updates', OLD.id);
  RETURN NULL;
END $$;
CREATE TRIGGER review_updates_queue_removed_media
  AFTER UPDATE OF media OR DELETE ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.review_updates_queue_removed_media();

CREATE OR REPLACE FUNCTION public.media_guard_added(p_old text[], p_new text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; st text;
BEGIN
  FOR p IN
    SELECT DISTINCT x FROM unnest(COALESCE(p_new, '{}')) x
    WHERE x IS NOT NULL AND NOT (x = ANY (COALESCE(p_old, '{}')))
    ORDER BY 1
  LOOP
    PERFORM public.media_path_lock(p);
    SELECT status INTO st FROM public.media_deletion_candidates WHERE path = p;
    IF st = 'queued' THEN
      UPDATE public.media_deletion_candidates
         SET status = 'kept', kept_checked_at = now(), claim_token = NULL, lease_until = NULL
       WHERE path = p;
    ELSIF st IN ('deleting','deleted','failed') THEN
      RAISE EXCEPTION 'MEDIA_PATH_RETIRED' USING ERRCODE = 'P0001', DETAIL = p,
        HINT = 'This photo was removed. Please add it again.';
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.media_guard_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o text[]; n text[];
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'posts', 'review_updates' THEN
      n := ARRAY(SELECT public.owned_media_paths_from_jsonb(NEW.media));
      IF TG_OP = 'UPDATE' THEN o := ARRAY(SELECT public.owned_media_paths_from_jsonb(OLD.media)); END IF;
    WHEN 'reviews' THEN
      n := public.review_owned_paths(NEW.media, NEW.image_url);
      IF TG_OP = 'UPDATE' THEN o := public.review_owned_paths(OLD.media, OLD.image_url); END IF;
    WHEN 'entity_photos' THEN
      n := ARRAY[public.normalize_owned_media_path(NEW.url)];
      IF TG_OP = 'UPDATE' THEN o := ARRAY[public.normalize_owned_media_path(OLD.url)]; END IF;
    WHEN 'entities' THEN
      n := ARRAY(SELECT public.owned_media_paths_from_jsonb(NEW.stored_photo_urls)) || public.normalize_owned_media_path(NEW.image_url);
      IF TG_OP = 'UPDATE' THEN o := ARRAY(SELECT public.owned_media_paths_from_jsonb(OLD.stored_photo_urls)) || public.normalize_owned_media_path(OLD.image_url); END IF;
    WHEN 'entity_suggestions' THEN
      n := ARRAY(SELECT public.owned_media_paths_from_jsonb(NEW.suggested_images));
      IF TG_OP = 'UPDATE' THEN o := ARRAY(SELECT public.owned_media_paths_from_jsonb(OLD.suggested_images)); END IF;
    WHEN 'entity_products', 'cached_products' THEN
      n := ARRAY[public.normalize_owned_media_path(NEW.image_url)];
      IF TG_OP = 'UPDATE' THEN o := ARRAY[public.normalize_owned_media_path(OLD.image_url)]; END IF;
    WHEN 'profiles' THEN
      n := ARRAY[public.normalize_owned_media_path(NEW.avatar_url), public.normalize_owned_media_path(NEW.cover_url)];
      IF TG_OP = 'UPDATE' THEN o := ARRAY[public.normalize_owned_media_path(OLD.avatar_url), public.normalize_owned_media_path(OLD.cover_url)]; END IF;
    WHEN 'photo_reports' THEN
      n := ARRAY[public.normalize_owned_media_path(NEW.photo_url)];
      IF TG_OP = 'UPDATE' THEN o := ARRAY[public.normalize_owned_media_path(OLD.photo_url)]; END IF;
    WHEN 'cached_photos' THEN
      n := ARRAY[public.normalize_owned_media_path(NEW.cached_url), public.normalize_owned_media_path(NEW.original_url), public.normalize_owned_media_path(NEW.thumbnail_url)];
      IF TG_OP = 'UPDATE' THEN o := ARRAY[public.normalize_owned_media_path(OLD.cached_url), public.normalize_owned_media_path(OLD.original_url), public.normalize_owned_media_path(OLD.thumbnail_url)]; END IF;
  END CASE;
  PERFORM public.media_guard_added(o, n);
  RETURN NEW;
END $$;

CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF media ON public.posts FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF media, image_url ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF media ON public.review_updates FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF url ON public.entity_photos FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF image_url, stored_photo_urls ON public.entities FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF suggested_images ON public.entity_suggestions FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF image_url ON public.entity_products FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF avatar_url, cover_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF photo_url ON public.photo_reports FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF cached_url, original_url, thumbnail_url ON public.cached_photos FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE OF image_url ON public.cached_products FOR EACH ROW EXECUTE FUNCTION public.media_guard_trigger();

CREATE OR REPLACE FUNCTION public.claim_media_deletions(p_limit integer DEFAULT 25, p_lease_seconds integer DEFAULT 300)
RETURNS TABLE (path text, claim_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st text; tok uuid;
BEGIN
  IF NOT public.media_cleanup_processing_enabled() THEN RETURN; END IF;
  FOR r IN
    SELECT c.path FROM public.media_deletion_candidates c
    WHERE (c.status = 'queued' AND c.next_attempt_at <= now())
       OR (c.status = 'deleting' AND COALESCE(c.lease_until, now()) <= now())
    ORDER BY c.path
    LIMIT GREATEST(1, LEAST(p_limit, 100))
  LOOP
    PERFORM public.media_path_lock(r.path);
    SELECT c.status INTO st FROM public.media_deletion_candidates c WHERE c.path = r.path FOR UPDATE;
    IF NOT (st = 'queued' OR (st = 'deleting' AND
            (SELECT COALESCE(lease_until, now()) <= now() FROM public.media_deletion_candidates WHERE media_deletion_candidates.path = r.path))) THEN
      CONTINUE;
    END IF;
    IF public.media_path_keep_count(r.path) > 0 THEN
      UPDATE public.media_deletion_candidates SET status = 'kept', kept_checked_at = now(),
             claim_token = NULL, lease_until = NULL WHERE media_deletion_candidates.path = r.path;
      CONTINUE;
    END IF;
    tok := gen_random_uuid();
    UPDATE public.media_deletion_candidates
       SET status = 'deleting', claim_token = tok, attempts = attempts + 1,
           lease_until = now() + make_interval(secs => p_lease_seconds)
     WHERE media_deletion_candidates.path = r.path;
    path := r.path; claim_token := tok; RETURN NEXT;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.finish_media_deletion(p_path text, p_token uuid, p_outcome text, p_error text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.media_deletion_candidates WHERE path = p_path FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'deleting' OR c.claim_token IS DISTINCT FROM p_token THEN
    RETURN 'stale';
  END IF;
  IF p_outcome = 'deleted' THEN
    UPDATE public.media_deletion_candidates SET status = 'deleted', claim_token = NULL,
           lease_until = NULL, last_error = NULL WHERE id = c.id;
    RETURN 'deleted';
  END IF;
  IF c.attempts >= 5 THEN
    UPDATE public.media_deletion_candidates SET status = 'failed', claim_token = NULL,
           lease_until = NULL, last_error = left(p_error, 500) WHERE id = c.id;
    RETURN 'failed';
  END IF;
  UPDATE public.media_deletion_candidates SET claim_token = NULL,
         lease_until = now() + make_interval(mins => 5 * power(2, c.attempts)::int),
         last_error = left(p_error, 500) WHERE id = c.id;
  RETURN 'retry';
END $$;

CREATE OR REPLACE FUNCTION public.recheck_kept_media(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st text; n integer := 0;
BEGIN
  IF NOT public.media_cleanup_processing_enabled() THEN RETURN 0; END IF;
  FOR r IN
    SELECT c.path FROM public.media_deletion_candidates c
    WHERE c.status = 'kept' AND COALESCE(c.kept_checked_at, c.updated_at) <= now() - interval '1 day'
    ORDER BY c.path LIMIT GREATEST(1, LEAST(p_limit, 500))
  LOOP
    PERFORM public.media_path_lock(r.path);
    SELECT status INTO st FROM public.media_deletion_candidates WHERE path = r.path FOR UPDATE;
    IF st <> 'kept' THEN CONTINUE; END IF;
    IF public.media_path_keep_count(r.path) = 0 THEN
      UPDATE public.media_deletion_candidates SET status = 'queued', next_attempt_at = now() WHERE path = r.path;
      n := n + 1;
    ELSE
      UPDATE public.media_deletion_candidates SET kept_checked_at = now() WHERE path = r.path;
    END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_media_deletion_candidates(p_status text DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS SETOF public.media_deletion_candidates
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.media_deletion_candidates
   WHERE p_status IS NULL OR status = p_status
   ORDER BY updated_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 1000);
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_media_deletions(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_media_deletion(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recheck_kept_media(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_kept_media_paths() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_path_keep_count(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_queue_removed(text[], text[], text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_guard_added(text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_cleanup_processing_enabled() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_url_decode(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_path_lock(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_owned_media_path(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owned_media_paths_from_jsonb(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_owned_paths(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_deletion_candidates_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_queue_removed_media() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_updates_queue_removed_media() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_guard_trigger() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_media_deletions(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_media_deletion(text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recheck_kept_media(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_kept_media_paths() TO service_role;
GRANT EXECUTE ON FUNCTION public.media_path_keep_count(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.media_cleanup_processing_enabled() TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_list_media_deletion_candidates(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_media_deletion_candidates(text, integer) TO authenticated;