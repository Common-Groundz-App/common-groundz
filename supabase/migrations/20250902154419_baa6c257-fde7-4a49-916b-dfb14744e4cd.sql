-- Add new columns for entity description source tracking
ALTER TABLE entities 
  ADD COLUMN IF NOT EXISTS about_source text 
    CHECK (about_source IN ('user','brand','google_editorial','auto_generated','address_fallback')),
  ADD COLUMN IF NOT EXISTS about_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS external_rating decimal(2,1),
  ADD COLUMN IF NOT EXISTS external_rating_count integer;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS entities_about_source_idx ON entities(about_source);

-- Create index for backfill queries
CREATE INDEX IF NOT EXISTS entities_api_source_description_idx ON entities(api_source, description) 
  WHERE api_source = 'google_places';