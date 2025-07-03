
-- Drop the conflicting user policies that are causing the 403 error
DROP POLICY IF EXISTS "Users can delete their own entities" ON public.entities;
DROP POLICY IF EXISTS "Users can update their own entities" ON public.entities;
DROP POLICY IF EXISTS "Only admins can verify entities" ON public.entities;

-- Create a single, clear user policy for non-admin updates
CREATE POLICY "Users can update their own non-deleted entities" 
ON public.entities 
FOR UPDATE 
USING (
  auth.uid() = created_by 
  AND is_deleted = false 
  AND NOT is_admin_user(auth.jwt() ->> 'email')
) 
WITH CHECK (
  auth.uid() = created_by 
  AND NOT is_admin_user(auth.jwt() ->> 'email')
);

-- Ensure the admin policy is properly set (recreate to be sure)
DROP POLICY IF EXISTS "Admins can manage entity lifecycle" ON public.entities;
CREATE POLICY "Admins can manage entity lifecycle" 
ON public.entities 
FOR UPDATE 
USING (is_admin_user(auth.jwt() ->> 'email')) 
WITH CHECK (true);
