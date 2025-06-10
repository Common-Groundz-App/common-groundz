
-- Create admin_actions table to track admin activities
CREATE TABLE public.admin_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'review' or 'entity'
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Only allow admins to view their own actions
CREATE POLICY "Admins can view admin actions" 
  ON public.admin_actions 
  FOR SELECT 
  TO authenticated
  USING (admin_user_id = auth.uid());

-- Only allow admins to insert admin actions
CREATE POLICY "Admins can create admin actions" 
  ON public.admin_actions 
  FOR INSERT 
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- Add indexes for better performance
CREATE INDEX idx_admin_actions_admin_user_id ON public.admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target ON public.admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_created_at ON public.admin_actions(created_at DESC);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if email ends with @lovable.dev (extend this logic as needed)
  RETURN user_email LIKE '%@lovable.dev';
END;
$$;

-- Create function to get admin analytics
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS TABLE(
  total_reviews bigint,
  total_entities bigint,
  reviews_with_ai_summary bigint,
  entities_with_dynamic_reviews bigint,
  recent_ai_generations bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.reviews WHERE has_timeline = true) as total_reviews,
    (SELECT COUNT(DISTINCT entity_id) FROM public.reviews WHERE has_timeline = true AND entity_id IS NOT NULL) as total_entities,
    (SELECT COUNT(*) FROM public.reviews WHERE ai_summary IS NOT NULL) as reviews_with_ai_summary,
    (SELECT COUNT(DISTINCT entity_id) FROM public.reviews WHERE has_timeline = true AND entity_id IS NOT NULL) as entities_with_dynamic_reviews,
    (SELECT COUNT(*) FROM public.admin_actions WHERE action_type = 'generate_ai_summary' AND created_at > now() - interval '24 hours') as recent_ai_generations;
END;
$$;
