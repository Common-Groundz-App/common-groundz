
-- Create hashtags table
CREATE TABLE hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_original TEXT NOT NULL,
  name_norm TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create post-hashtag junction table
CREATE TABLE post_hashtags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, hashtag_id)
);

-- Create performance indexes
CREATE INDEX idx_hashtags_name_norm ON hashtags (name_norm);
CREATE INDEX idx_post_hashtags_hashtag_id ON post_hashtags (hashtag_id);
CREATE INDEX idx_post_hashtags_post_id ON post_hashtags (post_id);

-- Simplified RLS policies (tweaked for safety)
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view hashtags" ON hashtags FOR SELECT USING (true);

ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post hashtags" ON post_hashtags FOR SELECT USING (true);
-- RLS filtering happens via posts table when doing inner joins

-- Insert policy for authenticated users
CREATE POLICY "Authenticated users can create hashtags" ON hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create post hashtags" ON post_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Database migration validation test
DO $$
BEGIN
  -- Ensure hashtags.name_norm is unique
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'UNIQUE' 
    AND table_name = 'hashtags' 
    AND constraint_name LIKE '%name_norm%'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: hashtags.name_norm unique constraint missing - upserts will fail';
  END IF;
  
  -- Ensure post_hashtags has composite PK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'PRIMARY KEY' 
    AND table_name = 'post_hashtags'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: post_hashtags primary key missing - upserts will fail';
  END IF;
  
  RAISE NOTICE 'Database validation passed: hashtag constraints are properly configured';
END $$;
