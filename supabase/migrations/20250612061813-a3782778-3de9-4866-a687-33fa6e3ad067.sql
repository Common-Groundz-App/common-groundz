
-- Add entity-level AI summary fields to the entities table
ALTER TABLE public.entities 
ADD COLUMN ai_dynamic_review_summary TEXT,
ADD COLUMN ai_dynamic_review_summary_last_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN ai_dynamic_review_summary_model_used TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.entities.ai_dynamic_review_summary IS 'AI-generated summary of all dynamic reviews for this entity';
COMMENT ON COLUMN public.entities.ai_dynamic_review_summary_last_generated_at IS 'When the entity-level AI summary was last generated';
COMMENT ON COLUMN public.entities.ai_dynamic_review_summary_model_used IS 'AI model used for generating the entity-level summary';
