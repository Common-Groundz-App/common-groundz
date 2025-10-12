-- Migration 2: Create normalized tag system
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_normalized TEXT NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_name_normalized ON public.tags(name_normalized);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON public.tags(usage_count DESC);

-- Create entity_tags junction table
CREATE TABLE IF NOT EXISTS public.entity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(entity_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON public.entity_tags(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON public.entity_tags(tag_id);

-- Trigger to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count() 
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tags 
    SET usage_count = usage_count + 1, updated_at = now() 
    WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tags 
    SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now() 
    WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

DROP TRIGGER IF EXISTS trigger_update_tag_usage ON public.entity_tags;
CREATE TRIGGER trigger_update_tag_usage 
AFTER INSERT OR DELETE ON public.entity_tags
FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
DROP POLICY IF EXISTS "Anyone can view tags" ON public.tags;
CREATE POLICY "Anyone can view tags" ON public.tags 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tags" ON public.tags;
CREATE POLICY "Authenticated users can create tags" ON public.tags 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for entity_tags
DROP POLICY IF EXISTS "Anyone can view entity tags" ON public.entity_tags;
CREATE POLICY "Anyone can view entity tags" ON public.entity_tags 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can tag entities" ON public.entity_tags;
CREATE POLICY "Users can tag entities" ON public.entity_tags 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can remove their own tags" ON public.entity_tags;
CREATE POLICY "Users can remove their own tags" ON public.entity_tags 
FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can manage all tags" ON public.entity_tags;
CREATE POLICY "Admins can manage all tags" ON public.entity_tags 
FOR ALL USING (is_current_user_admin());