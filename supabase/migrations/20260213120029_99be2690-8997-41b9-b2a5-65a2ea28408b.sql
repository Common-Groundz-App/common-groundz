
-- Migration 5: Tighten cached_photos
-- Drop permissive UPDATE and DELETE policies (edge functions use service_role)

DROP POLICY IF EXISTS "System can update cached photos" ON public.cached_photos;
DROP POLICY IF EXISTS "System can delete cached photos" ON public.cached_photos;
