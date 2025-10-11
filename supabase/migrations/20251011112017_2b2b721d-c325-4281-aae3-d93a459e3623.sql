-- Add stored_photo_urls column to entities table for permanent photo storage
ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS stored_photo_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN entities.stored_photo_urls IS 
'Array of {reference, storedUrl, width, height, uploadedAt} for photos stored in entity-images bucket. Reduces Google Places API calls by serving from permanent Supabase Storage.';

-- Create index for faster queries on stored photos
CREATE INDEX IF NOT EXISTS idx_entities_stored_photos 
ON entities USING gin(stored_photo_urls) 
WHERE api_source = 'google_places';