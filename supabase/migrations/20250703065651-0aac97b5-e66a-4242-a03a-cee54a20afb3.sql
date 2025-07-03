
-- Create a flexible admin RLS policy for entity lifecycle management
CREATE POLICY "Admins can manage entity lifecycle" 
ON public.entities 
FOR UPDATE 
USING (public.is_admin_user(auth.jwt() ->> 'email')) 
WITH CHECK (true);

-- Create a function to check if current user is admin (more flexible than hardcoded email check)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user email ends with @lovable.dev or has admin role in metadata
  RETURN (
    (auth.jwt() ->> 'email') LIKE '%@lovable.dev' OR
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );
END;
$$;

-- Create a more flexible admin check function that can be extended later
CREATE OR REPLACE FUNCTION public.check_admin_permission(required_permission text DEFAULT 'admin')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- For now, use the existing admin check, but this can be extended
  RETURN public.is_current_user_admin();
END;
$$;

-- Create an audit trail function for admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only log if user is admin
  IF public.is_current_user_admin() THEN
    INSERT INTO public.admin_actions (
      admin_user_id,
      action_type,
      target_type,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      p_action_type,
      p_target_type,
      p_target_id,
      p_details
    );
  END IF;
END;
$$;

-- Create a trigger to automatically log entity soft delete/restore actions
CREATE OR REPLACE FUNCTION public.log_entity_lifecycle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log soft delete action
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    PERFORM public.log_admin_action(
      'soft_delete_entity',
      'entity',
      NEW.id,
      jsonb_build_object(
        'entity_name', NEW.name,
        'entity_type', NEW.type,
        'previous_state', 'active'
      )
    );
  END IF;
  
  -- Log restore action
  IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    PERFORM public.log_admin_action(
      'restore_entity',
      'entity',
      NEW.id,
      jsonb_build_object(
        'entity_name', NEW.name,
        'entity_type', NEW.type,
        'previous_state', 'deleted'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS entity_lifecycle_audit_trigger ON public.entities;
CREATE TRIGGER entity_lifecycle_audit_trigger
  AFTER UPDATE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_entity_lifecycle_changes();
