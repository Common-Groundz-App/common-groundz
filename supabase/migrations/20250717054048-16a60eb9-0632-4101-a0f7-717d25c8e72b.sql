
-- Create entity_saves table for tracking saved entities by users
CREATE TABLE public.entity_saves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, entity_id)
);

-- Enable RLS
ALTER TABLE public.entity_saves ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saves" ON public.entity_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saves" ON public.entity_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saves" ON public.entity_saves
  FOR DELETE USING (auth.uid() = user_id);

-- Function to toggle entity save
CREATE OR REPLACE FUNCTION public.toggle_entity_save(p_entity_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  save_exists BOOLEAN;
BEGIN
  -- Check if save exists
  SELECT EXISTS(
    SELECT 1 FROM public.entity_saves
    WHERE entity_id = p_entity_id AND user_id = p_user_id
  ) INTO save_exists;
  
  -- Toggle the save
  IF save_exists THEN
    -- Save exists, so delete it
    DELETE FROM public.entity_saves
    WHERE entity_id = p_entity_id AND user_id = p_user_id;
    RETURN false; -- Indicates save was removed
  ELSE
    -- Save doesn't exist, so add it
    INSERT INTO public.entity_saves (entity_id, user_id)
    VALUES (p_entity_id, p_user_id);
    RETURN true; -- Indicates save was added
  END IF;
END;
$$;

-- Function to get entity save count
CREATE OR REPLACE FUNCTION public.get_entity_saves_count(p_entity_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.entity_saves
    WHERE entity_id = p_entity_id
  );
END;
$$;

-- Function to check if user has saved entity
CREATE OR REPLACE FUNCTION public.check_entity_save(p_entity_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.entity_saves 
    WHERE entity_id = p_entity_id AND user_id = p_user_id
  );
END;
$$;
