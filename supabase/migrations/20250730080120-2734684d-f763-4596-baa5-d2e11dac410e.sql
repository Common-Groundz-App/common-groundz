-- Check if entity_photos table supports video content types by updating constraints
-- This ensures the table can handle both image and video uploads

-- First check current constraints and update if needed
DO $$
BEGIN
    -- Remove any existing content_type constraints that only allow images
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%content_type%' 
        AND table_name = 'entity_photos'
    ) THEN
        ALTER TABLE entity_photos DROP CONSTRAINT IF EXISTS entity_photos_content_type_check;
    END IF;
    
    -- Add a new constraint that allows both image and video types
    ALTER TABLE entity_photos ADD CONSTRAINT entity_photos_content_type_check 
    CHECK (content_type IS NULL OR content_type ~ '^(image|video)/');
    
END $$;