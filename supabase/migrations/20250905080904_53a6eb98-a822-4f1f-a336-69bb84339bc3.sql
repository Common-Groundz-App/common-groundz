-- Fix entity_id constraint error by making the column nullable
-- Photos can exist without being tied to a specific entity
ALTER TABLE public.cached_photos 
ALTER COLUMN entity_id DROP NOT NULL;