-- Drop and recreate match_reviews function with correct return type
DROP FUNCTION IF EXISTS match_reviews(vector, float, int, uuid, uuid, text, numeric);

-- Recreate with integer rating type to match reviews table
CREATE OR REPLACE FUNCTION match_reviews(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_id uuid DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_category text DEFAULT NULL,
  min_rating numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  rating integer,  -- Changed from numeric to integer to match reviews table
  entity_id uuid,
  user_id uuid,
  category text,
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.description,
    r.rating,
    r.entity_id,
    r.user_id,
    r.category,
    r.created_at,
    (1 - (r.embedding <=> query_embedding))::float AS similarity
  FROM reviews r
  WHERE r.embedding IS NOT NULL
    AND r.status = 'published'
    AND (1 - (r.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_id IS NULL OR r.entity_id = filter_entity_id)
    AND (filter_user_id IS NULL OR r.user_id = filter_user_id)
    AND (filter_category IS NULL OR r.category = filter_category)
    AND (min_rating IS NULL OR r.rating >= min_rating)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;