
CREATE TABLE public.media_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'post' CHECK (source IN ('post','review','entity')),
  source_id uuid NOT NULL,
  media_path text NOT NULL,
  user_id uuid,
  anon_session_id text,
  was_autoplay boolean NOT NULL DEFAULT false,
  watch_ms integer NOT NULL DEFAULT 0 CHECK (watch_ms >= 0),
  ip_hash text,
  tracker_version text NOT NULL DEFAULT 'v1',
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_views_unique_user
  ON public.media_views (user_id, source, source_id, media_path)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX media_views_unique_anon
  ON public.media_views (anon_session_id, source, source_id, media_path)
  WHERE user_id IS NULL AND anon_session_id IS NOT NULL;

CREATE INDEX media_views_source_idx ON public.media_views (source, source_id);
CREATE INDEX media_views_viewed_at_idx ON public.media_views (viewed_at DESC);

ALTER TABLE public.media_views ENABLE ROW LEVEL SECURITY;

-- Service role only (no public INSERT/SELECT/UPDATE/DELETE)
CREATE POLICY "service_role_all_media_views"
  ON public.media_views
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
