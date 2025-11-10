-- Phase 1.5.3: Create Vector Search RPC Functions (Part 1 of 2)
-- Creates semantic similarity search functions for reviews, profiles, memories, and product relationships

-- Function 1: match_reviews() - Semantic Review Search
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
  rating numeric,
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

COMMENT ON FUNCTION match_reviews IS 'Performs semantic similarity search on reviews using vector embeddings';

-- Function 2: match_profiles() - Find Similar Users
CREATE OR REPLACE FUNCTION match_profiles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  exclude_user_id uuid DEFAULT NULL,
  filter_location text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  location text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.bio,
    p.location,
    (1 - (p.embedding <=> query_embedding))::float AS similarity
  FROM profiles p
  WHERE p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
    AND (exclude_user_id IS NULL OR p.id != exclude_user_id)
    AND (filter_location IS NULL OR p.location ILIKE '%' || filter_location || '%')
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_profiles IS 'Finds users with similar interests and preferences using vector embeddings';

-- Function 3: match_user_memories() - Retrieve Contextual Memories
CREATE OR REPLACE FUNCTION match_user_memories(
  p_user_id uuid,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5,
  filter_memory_type text DEFAULT NULL,
  min_importance int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  importance_score int,
  created_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  access_count int,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  memory_ids uuid[];
BEGIN
  -- First, get matching memories with hybrid scoring
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    m.importance_score,
    m.created_at,
    m.last_accessed_at,
    m.access_count,
    (1 - (m.embedding <=> query_embedding))::float AS similarity
  FROM user_conversation_memory m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (min_importance IS NULL OR m.importance_score >= min_importance)
  ORDER BY 
    -- Hybrid scoring: importance (30%) + similarity (70%)
    ((m.importance_score::float / 10) * 0.3 + (1 - (m.embedding <=> query_embedding)) * 0.7) DESC
  LIMIT match_count;
  
  -- Collect IDs of returned memories
  SELECT array_agg(m.id) INTO memory_ids
  FROM user_conversation_memory m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (min_importance IS NULL OR m.importance_score >= min_importance)
  ORDER BY 
    ((m.importance_score::float / 10) * 0.3 + (1 - (m.embedding <=> query_embedding)) * 0.7) DESC
  LIMIT match_count;
  
  -- Update access tracking for returned memories
  IF memory_ids IS NOT NULL AND array_length(memory_ids, 1) > 0 THEN
    UPDATE user_conversation_memory
    SET 
      last_accessed_at = NOW(),
      access_count = access_count + 1
    WHERE id = ANY(memory_ids);
  END IF;
END;
$$;

COMMENT ON FUNCTION match_user_memories IS 'Retrieves contextually relevant user memories with hybrid importance+similarity scoring';

-- Function 4: match_product_relationships() - Find Related Products
CREATE OR REPLACE FUNCTION match_product_relationships(
  query_embedding vector(1536),
  filter_entity_id uuid DEFAULT NULL,
  filter_relationship_type text DEFAULT NULL,
  min_confidence numeric DEFAULT 0.6,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  entity_a_id uuid,
  entity_b_id uuid,
  relationship_type text,
  confidence_score numeric,
  evidence_text text,
  confirmation_count int,
  related_entity_id uuid,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.entity_a_id,
    pr.entity_b_id,
    pr.relationship_type,
    pr.confidence_score,
    pr.evidence_text,
    pr.confirmation_count,
    -- Return the "other" entity ID for convenience
    CASE 
      WHEN filter_entity_id IS NOT NULL AND pr.entity_a_id = filter_entity_id THEN pr.entity_b_id
      WHEN filter_entity_id IS NOT NULL AND pr.entity_b_id = filter_entity_id THEN pr.entity_a_id
      ELSE pr.entity_b_id
    END AS related_entity_id,
    (1 - (pr.embedding <=> query_embedding))::float AS similarity
  FROM product_relationships pr
  WHERE pr.embedding IS NOT NULL
    AND pr.confidence_score >= min_confidence
    AND (1 - (pr.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_id IS NULL OR pr.entity_a_id = filter_entity_id OR pr.entity_b_id = filter_entity_id)
    AND (filter_relationship_type IS NULL OR pr.relationship_type = filter_relationship_type)
  ORDER BY pr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_product_relationships IS 'Finds semantically similar product relationships with confidence filtering';