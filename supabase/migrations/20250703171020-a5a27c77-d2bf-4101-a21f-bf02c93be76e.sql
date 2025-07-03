
-- Add RLS policy to allow admins to view deleted entities
CREATE POLICY "Admins can view deleted entities" 
ON public.entities 
FOR SELECT 
USING (
  is_deleted = true 
  AND is_admin_user(auth.jwt() ->> 'email')
);
