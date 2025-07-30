-- Ensure entity_photos table supports video content types
-- This migration allows the table to store both image and video files

-- Add a constraint to allow image and video content types
-- First drop any existing constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'entity_photos_content_type_check' 
        AND table_name = 'entity_photos'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.entity_photos DROP CONSTRAINT entity_photos_content_type_check;
    END IF;
END $$;

-- Add new constraint that allows both image and video types
ALTER TABLE public.entity_photos 
ADD CONSTRAINT entity_photos_content_type_check 
CHECK (content_type IS NULL OR content_type ~ '^(image|video)/');