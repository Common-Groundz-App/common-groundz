
-- Migration 3: Fix entity_views data exposure
-- Replace permissive SELECT policy with user-scoped one

DROP POLICY IF EXISTS "Users can view all entity views" ON public.entity_views;

CREATE POLICY "Users can view their own entity views"
  ON public.entity_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
