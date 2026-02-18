
-- Drop redundant entities UPDATE policy (already covered by "Admins can manage all entities" ALL policy)
DROP POLICY IF EXISTS "Admins can manage entity lifecycle" ON public.entities;

-- Lock down cached_photos writes to admins only
DROP POLICY IF EXISTS "Admins can update cached photos" ON public.cached_photos;
CREATE POLICY "Admins can update cached photos"
  ON public.cached_photos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete cached photos" ON public.cached_photos;
CREATE POLICY "Admins can delete cached photos"
  ON public.cached_photos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Lock down photo_cache_sessions writes to admins only
DROP POLICY IF EXISTS "Admins can insert photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can insert photo cache sessions"
  ON public.photo_cache_sessions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can update photo cache sessions"
  ON public.photo_cache_sessions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can delete photo cache sessions"
  ON public.photo_cache_sessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
