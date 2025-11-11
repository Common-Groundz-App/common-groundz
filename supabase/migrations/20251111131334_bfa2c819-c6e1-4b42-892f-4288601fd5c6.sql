-- Update match_reviews to accept optional entity_id filter
CREATE OR REPLACE FUNCTION match_reviews(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_entity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  entity_id uuid,
  user_id uuid,
  rating numeric,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    reviews.id,
    reviews.description as content,
    reviews.title,
    reviews.entity_id,
    reviews.user_id,
    reviews.rating,
    reviews.created_at,
    1 - (reviews.embedding <=> query_embedding) AS similarity
  FROM reviews
  WHERE reviews.embedding IS NOT NULL
    AND reviews.status = 'published'
    AND (filter_entity_id IS NULL OR reviews.entity_id = filter_entity_id)
    AND 1 - (reviews.embedding <=> query_embedding) > match_threshold
  ORDER BY reviews.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;