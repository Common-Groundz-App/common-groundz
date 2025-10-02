-- Add unique constraint on recommendation_quality_scores.entity_id
-- This allows the upsert with onConflict: 'entity_id' to work correctly
-- preventing duplicate quality score rows per entity

ALTER TABLE recommendation_quality_scores 
ADD CONSTRAINT recommendation_quality_scores_entity_id_unique UNIQUE (entity_id);