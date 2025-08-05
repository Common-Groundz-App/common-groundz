-- Create suggestion status enum
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'rejected', 'applied');

-- Create main entity suggestions table with flexible JSONB schema
CREATE TABLE public.entity_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  suggested_changes jsonb NOT NULL DEFAULT '{}',
  context text,
  status suggestion_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  applied_at timestamp with time zone,
  suggested_images jsonb DEFAULT '[]',
  is_business_closed boolean DEFAULT false,
  is_duplicate boolean DEFAULT false,
  duplicate_of_entity_id uuid REFERENCES public.entities(id),
  user_is_owner boolean DEFAULT false,
  priority_score integer DEFAULT 50,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entity_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own suggestions" 
ON public.entity_suggestions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create suggestions for non-deleted entities" 
ON public.entity_suggestions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE id = entity_suggestions.entity_id AND is_deleted = false
  )
);

CREATE POLICY "Users can update their own pending suggestions" 
ON public.entity_suggestions 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all suggestions" 
ON public.entity_suggestions 
FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update all suggestions" 
ON public.entity_suggestions 
FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Create storage bucket for suggested images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entity-suggestions', 
  'entity-suggestions', 
  false, 
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Storage policies for suggested images
CREATE POLICY "Users can upload their own suggestion images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'entity-suggestions' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own suggestion images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'entity-suggestions' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all suggestion images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'entity-suggestions' AND 
  public.is_current_user_admin()
);

CREATE POLICY "Admins can delete suggestion images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'entity-suggestions' AND 
  public.is_current_user_admin()
);

-- Performance indexes
CREATE INDEX idx_entity_suggestions_entity_id ON public.entity_suggestions(entity_id);
CREATE INDEX idx_entity_suggestions_user_id ON public.entity_suggestions(user_id);
CREATE INDEX idx_entity_suggestions_status ON public.entity_suggestions(status);
CREATE INDEX idx_entity_suggestions_priority ON public.entity_suggestions(priority_score DESC);
CREATE INDEX idx_entity_suggestions_created_at ON public.entity_suggestions(created_at DESC);

-- Helper function to get suggestion statistics
CREATE OR REPLACE FUNCTION public.get_entity_suggestion_stats(entity_uuid uuid)
RETURNS TABLE(
  pending_count bigint,
  approved_count bigint,
  rejected_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
  FROM public.entity_suggestions
  WHERE entity_id = entity_uuid;
END;
$$;

-- Function to check if user has pending suggestion for entity
CREATE OR REPLACE FUNCTION public.user_has_pending_suggestion(entity_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.entity_suggestions 
    WHERE entity_id = entity_uuid 
    AND user_id = user_uuid 
    AND status = 'pending'
  );
END;
$$;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_entity_suggestions_updated_at
  BEFORE UPDATE ON public.entity_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();