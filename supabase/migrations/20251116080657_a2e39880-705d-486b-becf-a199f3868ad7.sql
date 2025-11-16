-- Fix the trigger_relationship_embedding function
-- Remove the embedding_updated_at check since the column doesn't exist in product_relationships table

CREATE OR REPLACE FUNCTION public.trigger_relationship_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set needs_embedding to true for new or updated relationships
  -- Remove the embedding_updated_at check since that column doesn't exist
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (
    NEW.evidence_text IS DISTINCT FROM OLD.evidence_text OR
    NEW.relationship_type IS DISTINCT FROM OLD.relationship_type
  )) THEN
    NEW.needs_embedding := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS set_relationship_needs_embedding ON public.product_relationships;

CREATE TRIGGER set_relationship_needs_embedding
  BEFORE INSERT OR UPDATE ON public.product_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_relationship_embedding();