ALTER TABLE public.media_views
ADD CONSTRAINT media_views_exactly_one_viewer
CHECK (
  (user_id IS NOT NULL AND anon_session_id IS NULL)
  OR
  (user_id IS NULL AND anon_session_id IS NOT NULL)
);