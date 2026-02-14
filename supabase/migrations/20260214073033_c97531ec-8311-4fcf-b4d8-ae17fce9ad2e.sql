
-- Migration 7: Admin Table Hardening + Cleanup

-- Drop overly permissive policies on image admin tables
DROP POLICY IF EXISTS "Allow all operations on image_health_results" ON public.image_health_results;
DROP POLICY IF EXISTS "Allow all operations on image_health_sessions" ON public.image_health_sessions;
DROP POLICY IF EXISTS "Allow all operations on image_migration_results" ON public.image_migration_results;
DROP POLICY IF EXISTS "Allow all operations on image_migration_sessions" ON public.image_migration_sessions;
DROP POLICY IF EXISTS "System can manage cache sessions" ON public.photo_cache_sessions;

-- Add FORCE ROW LEVEL SECURITY as safety belt
ALTER TABLE public.image_health_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.image_health_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.image_migration_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.image_migration_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photo_cache_sessions FORCE ROW LEVEL SECURITY;

-- Create admin-only policies using existing has_role() SECURITY DEFINER function
CREATE POLICY "Admins can manage image health results"
  ON public.image_health_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage image health sessions"
  ON public.image_health_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage image migration results"
  ON public.image_migration_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage image migration sessions"
  ON public.image_migration_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
