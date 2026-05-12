CREATE POLICY "Admins can read media cleanup runs"
ON public.media_cleanup_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));