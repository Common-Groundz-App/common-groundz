REVOKE ALL ON FUNCTION public.posts_media_mux_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patch_content_media_from_mux(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_content_media_from_mux(uuid) TO service_role;