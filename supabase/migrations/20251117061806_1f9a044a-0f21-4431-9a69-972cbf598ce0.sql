-- Drop the broken trigger that references non-existent needs_embedding column
-- This trigger was never functional because the column never existed in product_relationships table

-- Drop all triggers first
DROP TRIGGER IF EXISTS set_relationship_needs_embedding ON public.product_relationships;
DROP TRIGGER IF EXISTS trigger_relationship_embedding_after ON public.product_relationships;

-- Then drop the function
DROP FUNCTION IF EXISTS public.trigger_relationship_embedding() CASCADE;

-- Note: The embedding column exists and can be used in the future,
-- but there's no automated workflow for generating embeddings yet.
-- Embeddings for relationships can be manually generated via the generate-embeddings function.