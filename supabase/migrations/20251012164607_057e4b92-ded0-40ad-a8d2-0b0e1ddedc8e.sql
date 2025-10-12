-- Migration 3: Add basic JSONB GIN index for metadata filtering
CREATE INDEX IF NOT EXISTS idx_entities_metadata_gin 
ON public.entities USING GIN (metadata);