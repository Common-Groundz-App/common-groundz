-- Step 1: Tighten entity_enrichment_queue SELECT policy
DROP POLICY IF EXISTS "Allow system select" ON public.entity_enrichment_queue;

CREATE POLICY "Users can view own enrichment requests"
  ON public.entity_enrichment_queue FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY "Admins can view all enrichment requests"
  ON public.entity_enrichment_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 2: Profiles column-level grants
-- Revoke table-level SELECT (required before column-level grants take effect)
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Grant only safe public columns to anon
GRANT SELECT (
  id, username, avatar_url, bio, first_name, last_name,
  location, is_verified, created_at, updated_at,
  cover_url, deleted_at, username_changed_at
) ON public.profiles TO anon;

-- Grant safe columns + preferences to authenticated (owner-scoped via RLS)
GRANT SELECT (
  id, username, avatar_url, bio, first_name, last_name,
  location, is_verified, created_at, updated_at,
  cover_url, deleted_at, username_changed_at, preferences
) ON public.profiles TO authenticated;

-- embedding and embedding_updated_at are intentionally NOT granted to anon or authenticated
-- They remain accessible only via service_role (edge functions)