
-- Phase 2: Database Schema Updates

-- 1. Add parent_id to entities table
ALTER TABLE public.entities 
ADD COLUMN parent_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Add index on parent_id for performance
CREATE INDEX idx_entities_parent_id ON public.entities(parent_id);

-- Add constraint to prevent self-reference
ALTER TABLE public.entities 
ADD CONSTRAINT chk_entities_no_self_reference 
CHECK (parent_id IS NULL OR parent_id != id);

-- 2. Update posts table to add entity_id
ALTER TABLE public.posts 
ADD COLUMN entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Add index on entity_id for performance
CREATE INDEX idx_posts_entity_id ON public.posts(entity_id);

-- 3. Create entity_products table
CREATE TABLE public.entity_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT,
    price TEXT,
    buy_link TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for entity_products
CREATE INDEX idx_entity_products_entity_id ON public.entity_products(entity_id);

-- Enable RLS on entity_products
ALTER TABLE public.entity_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for entity_products
CREATE POLICY "Anyone can view entity products" 
ON public.entity_products 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert entity products" 
ON public.entity_products 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update entity products they created" 
ON public.entity_products 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- 4. Create entity_follows table
CREATE TABLE public.entity_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, entity_id)
);

-- Add indexes for entity_follows
CREATE INDEX idx_entity_follows_user_id ON public.entity_follows(user_id);
CREATE INDEX idx_entity_follows_entity_id ON public.entity_follows(entity_id);

-- Enable RLS on entity_follows
ALTER TABLE public.entity_follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for entity_follows
CREATE POLICY "Users can view their own follows" 
ON public.entity_follows 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own follows" 
ON public.entity_follows 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own follows" 
ON public.entity_follows 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Create trigger to prevent deletion of parent entities with children
CREATE OR REPLACE FUNCTION public.prevent_parent_entity_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.entities WHERE parent_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete entity that has child entities. Please remove children first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_parent_deletion
  BEFORE DELETE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_parent_entity_deletion();

-- 6. Create helper function to get direct children
CREATE OR REPLACE FUNCTION public.get_child_entities(parent_uuid UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  type entity_type,
  image_url TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.type, e.image_url, e.description
  FROM public.entities e
  WHERE e.parent_id = parent_uuid AND e.is_deleted = false
  ORDER BY e.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add updated_at trigger for entity_products
CREATE TRIGGER update_entity_products_updated_at
  BEFORE UPDATE ON public.entity_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
