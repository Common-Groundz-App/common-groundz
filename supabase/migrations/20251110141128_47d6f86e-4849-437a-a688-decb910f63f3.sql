-- Add missing unique constraint to recommendation_explanations table
-- This constraint is required for the upsert operation in advancedPersonalizationService
ALTER TABLE public.recommendation_explanations
ADD CONSTRAINT recommendation_explanations_user_entity_unique 
UNIQUE (user_id, entity_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT recommendation_explanations_user_entity_unique 
ON public.recommendation_explanations 
IS 'Ensures one explanation per user-entity pair, required for upsert operations';