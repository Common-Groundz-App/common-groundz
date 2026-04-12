-- Add structured_fields JSONB column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS structured_fields jsonb DEFAULT NULL;

-- Ensure it's always null or a valid JSON object (not array/string/number)
ALTER TABLE posts ADD CONSTRAINT structured_fields_is_object
CHECK (structured_fields IS NULL OR jsonb_typeof(structured_fields) = 'object');