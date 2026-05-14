UPDATE public.media_views
SET media_path = regexp_replace(
  media_path,
  '^/?storage/v1/object/(public|sign)/[^/]+/',
  ''
)
WHERE media_path ~ '^/?storage/v1/object/(public|sign)/[^/]+/';