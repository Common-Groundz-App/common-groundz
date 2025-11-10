-- Phase 1.5.3: Create Vector Search RPC Functions (Part 2 of 2)
-- Creates unified search and monitoring functions

-- Function 5: search_all_content() - Unified Search
CREATE OR REPLACE FUNCTION search_all_content(
  query_embedding vector(1536),
  p_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  results_per_type int DEFAULT 5
)
RETURNS TABLE (
  content_type text,
  content_id uuid,
  title text,
  description text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH review_results AS (
    SELECT
      'review'::text AS content_type,
      r.id AS content_id,
      r.title,
      r.description,
      (1 - (r.embedding <=> query_embedding))::float AS similarity,
      jsonb_build_object(
        'rating', r.rating,
        'category', r.category,
        'entity_id', r.entity_id,
        'user_id', r.user_id
      ) AS metadata
    FROM reviews r
    WHERE r.embedding IS NOT NULL
      AND r.status = 'published'
      AND (1 - (r.embedding <=> query_embedding)) > match_threshold
    ORDER BY r.embedding <=> query_embedding
    LIMIT results_per_type
  ),
  profile_results AS (
    SELECT
      'profile'::text AS content_type,
      p.id AS content_id,
      p.username AS title,
      p.bio AS description,
      (1 - (p.embedding <=> query_embedding))::float AS similarity,
      jsonb_build_object(
        'location', p.location,
        'avatar_url', p.avatar_url
      ) AS metadata
    FROM profiles p
    WHERE p.embedding IS NOT NULL
      AND (1 - (p.embedding <=> query_embedding)) > match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT results_per_type
  ),
  memory_results AS (
    SELECT
      'memory'::text AS content_type,
      m.id AS content_id,
      m.memory_type AS title,
      m.content AS description,
      (1 - (m.embedding <=> query_embedding))::float AS similarity,
      jsonb_build_object(
        'importance_score', m.importance_score,
        'memory_type', m.memory_type
      ) AS metadata
    FROM user_conversation_memory m
    WHERE m.embedding IS NOT NULL
      AND (p_user_id IS NULL OR m.user_id = p_user_id)
      AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT results_per_type
  ),
  relationship_results AS (
    SELECT
      'relationship'::text AS content_type,
      pr.id AS content_id,
      pr.relationship_type AS title,
      pr.evidence_text AS description,
      (1 - (pr.embedding <=> query_embedding))::float AS similarity,
      jsonb_build_object(
        'entity_a_id', pr.entity_a_id,
        'entity_b_id', pr.entity_b_id,
        'confidence_score', pr.confidence_score
      ) AS metadata
    FROM product_relationships pr
    WHERE pr.embedding IS NOT NULL
      AND pr.confidence_score >= 0.6
      AND (1 - (pr.embedding <=> query_embedding)) > match_threshold
    ORDER BY pr.embedding <=> query_embedding
    LIMIT results_per_type
  )
  SELECT * FROM review_results
  UNION ALL
  SELECT * FROM profile_results
  UNION ALL
  SELECT * FROM memory_results
  UNION ALL
  SELECT * FROM relationship_results
  ORDER BY similarity DESC;
END;
$$;

COMMENT ON FUNCTION search_all_content IS 'Unified semantic search across all content types (reviews, profiles, memories, relationships)';

-- Function 6: get_embedding_stats() - Monitoring & Diagnostics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
  table_name text,
  total_rows bigint,
  rows_with_embeddings bigint,
  embedding_coverage_percent numeric,
  avg_embedding_age_hours numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'reviews'::text,
    COUNT(*)::bigint,
    COUNT(embedding)::bigint,
    ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - embedding_updated_at)) / 3600), 2)
  FROM reviews
  WHERE status = 'published'
  
  UNION ALL
  
  SELECT 
    'profiles'::text,
    COUNT(*)::bigint,
    COUNT(embedding)::bigint,
    ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - embedding_updated_at)) / 3600), 2)
  FROM profiles
  
  UNION ALL
  
  SELECT 
    'user_conversation_memory'::text,
    COUNT(*)::bigint,
    COUNT(embedding)::bigint,
    ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
    NULL::numeric
  FROM user_conversation_memory
  
  UNION ALL
  
  SELECT 
    'product_relationships'::text,
    COUNT(*)::bigint,
    COUNT(embedding)::bigint,
    ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0)) * 100, 2),
    NULL::numeric
  FROM product_relationships;
END;
$$;

COMMENT ON FUNCTION get_embedding_stats IS 'Returns embedding coverage statistics for monitoring vector search health';