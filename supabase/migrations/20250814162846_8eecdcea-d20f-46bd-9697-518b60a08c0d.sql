-- Create trending hashtags function with 72-hour time decay
CREATE OR REPLACE FUNCTION calculate_trending_hashtags(
  hours_lookback INTEGER DEFAULT 72,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  name_original TEXT,
  name_norm TEXT,
  post_count BIGINT,
  trending_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH recent_activity AS (
    SELECT 
      h.id,
      h.name_original,
      h.name_norm,
      h.created_at,
      COUNT(p.id) as post_count,
      -- Time decay factor: newer posts get higher weight
      SUM(
        CASE 
          WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 3.0
          WHEN p.created_at > NOW() - INTERVAL '48 hours' THEN 2.0  
          WHEN p.created_at > NOW() - INTERVAL '72 hours' THEN 1.0
          ELSE 0.5
        END
      ) as weighted_score
    FROM hashtags h
    INNER JOIN post_hashtags ph ON h.id = ph.hashtag_id
    INNER JOIN posts p ON ph.post_id = p.id
    WHERE p.created_at > NOW() - INTERVAL (hours_lookback || ' hours')
      AND p.is_deleted = false
      AND p.visibility = 'public'
    GROUP BY h.id, h.name_original, h.name_norm, h.created_at
    HAVING COUNT(p.id) > 0
  )
  SELECT 
    ra.id,
    ra.name_original,
    ra.name_norm,
    ra.post_count,
    ra.weighted_score as trending_score,
    ra.created_at
  FROM recent_activity ra
  ORDER BY ra.weighted_score DESC, ra.post_count DESC
  LIMIT result_limit;
END;
$$;

-- Set up RLS policies for hashtags table
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read hashtags
CREATE POLICY "Anyone can view hashtags" ON hashtags
FOR SELECT USING (true);

-- Allow authenticated users to create hashtags
CREATE POLICY "Authenticated users can create hashtags" ON hashtags
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Set up RLS policies for post_hashtags table  
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read post_hashtags (visibility controlled via posts table)
CREATE POLICY "Anyone can view post hashtags" ON post_hashtags
FOR SELECT USING (true);

-- Allow authenticated users to create post_hashtags (ownership verified via posts table)
CREATE POLICY "Authenticated users can create post hashtags" ON post_hashtags
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM posts 
    WHERE id = post_id AND user_id = auth.uid()
  )
);

-- Allow users to delete hashtags from their own posts
CREATE POLICY "Users can delete hashtags from their own posts" ON post_hashtags
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE id = post_id AND user_id = auth.uid()
  )
);