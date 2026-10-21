CREATE OR REPLACE FUNCTION public.admin_get_mux_live_deletion()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT live_enabled, updated_at INTO r FROM public.mux_cleanup_live_control WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'live control row missing'; END IF;
  RETURN jsonb_build_object('live_enabled', r.live_enabled, 'updated_at', r.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_mux_live_deletion(p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'p_enabled required' USING ERRCODE = '22004'; END IF;
  UPDATE public.mux_cleanup_live_control
     SET live_enabled = p_enabled, updated_at = clock_timestamp()
   WHERE id = 1
  RETURNING live_enabled, updated_at INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'live control row missing'; END IF;
  RETURN jsonb_build_object('live_enabled', r.live_enabled, 'updated_at', r.updated_at);
END $$;

REVOKE ALL ON FUNCTION public.admin_get_mux_live_deletion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_mux_live_deletion(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_mux_live_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_mux_live_deletion(boolean) TO authenticated;