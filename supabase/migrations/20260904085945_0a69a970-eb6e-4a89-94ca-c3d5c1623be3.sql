REVOKE SELECT ON public._stage1_closeout_results FROM anon, authenticated;
GRANT SELECT ON public._stage1_closeout_results TO service_role;