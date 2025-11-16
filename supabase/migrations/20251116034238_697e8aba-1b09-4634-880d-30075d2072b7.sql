-- Enable fuzzy text matching extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add unique constraint to prevent duplicate relationships
ALTER TABLE public.product_relationships
ADD CONSTRAINT unique_relationship_constraint
UNIQUE (entity_a_id, entity_b_id, relationship_type);

-- Add GIN index for fuzzy matching on entity names
CREATE INDEX IF NOT EXISTS entities_name_trgm_idx 
ON public.entities USING gin (name gin_trgm_ops);

-- Add index for faster confidence-based queries
CREATE INDEX IF NOT EXISTS product_relationships_confidence_idx
ON public.product_relationships(confidence_score) WHERE confidence_score >= 0.5;

-- Add index for faster metadata queries (resume protection)
CREATE INDEX IF NOT EXISTS product_relationships_metadata_idx
ON public.product_relationships USING gin (metadata);

-- Create RPC function for fuzzy entity name matching using pg_trgm
CREATE OR REPLACE FUNCTION public.fuzzy_match_entity(target_name text, threshold float DEFAULT 0.3)
RETURNS TABLE(id uuid, name text, type entity_type, similarity_score float)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.type,
    similarity(e.name, target_name) as similarity_score
  FROM public.entities e
  WHERE similarity(e.name, target_name) > threshold
    AND e.is_deleted = false
  ORDER BY similarity_score DESC
  LIMIT 5;
END;
$$;