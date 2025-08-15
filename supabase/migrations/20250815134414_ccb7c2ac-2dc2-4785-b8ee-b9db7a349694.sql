-- Create a function to find and repair missing hashtag relationships
CREATE OR REPLACE FUNCTION public.repair_hashtag_relationships()
RETURNS TABLE(post_id UUID, hashtag_content TEXT, action_taken TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  post_record RECORD;
  hashtag_text TEXT;
  hashtag_normalized TEXT;
  hashtag_record RECORD;
  existing_link_count INTEGER;
  hashtag_pattern TEXT := '#([a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]|[a-zA-Z0-9])';
  match_record RECORD;
BEGIN
  -- Process all posts that are not deleted
  FOR post_record IN 
    SELECT id, title, COALESCE(content, '') as content 
    FROM public.posts 
    WHERE is_deleted = false
  LOOP
    -- Extract hashtags from title and content using regex
    FOR match_record IN 
      SELECT DISTINCT LOWER(match[1]) as hashtag_text
      FROM (
        SELECT regexp_matches(
          COALESCE(post_record.title, '') || ' ' || post_record.content, 
          hashtag_pattern, 
          'g'
        ) AS match
      ) matches
      WHERE match[1] IS NOT NULL 
        AND LENGTH(match[1]) > 0
        AND match[1] ~ '^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$'
    LOOP
      hashtag_text := match_record.hashtag_text;
      
      -- Normalize the hashtag (spaces to dashes, etc.)
      hashtag_normalized := LOWER(
        TRIM(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(hashtag_text, '\s+', '-', 'g'),
              '-+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
          )
        )
      );
      
      -- Skip if normalization resulted in empty string
      IF LENGTH(hashtag_normalized) = 0 THEN
        CONTINUE;
      END IF;

      -- Find or create the hashtag
      SELECT * INTO hashtag_record
      FROM public.hashtags
      WHERE name_norm = hashtag_normalized;

      -- Create hashtag if it doesn't exist
      IF hashtag_record IS NULL THEN
        INSERT INTO public.hashtags (name_original, name_norm)
        VALUES (hashtag_text, hashtag_normalized)
        RETURNING * INTO hashtag_record;
        
        RETURN QUERY SELECT post_record.id, hashtag_text, 'hashtag_created';
      END IF;

      -- Check if relationship already exists
      SELECT COUNT(*) INTO existing_link_count
      FROM public.post_hashtags
      WHERE post_id = post_record.id AND hashtag_id = hashtag_record.id;

      -- Create relationship if it doesn't exist
      IF existing_link_count = 0 THEN
        INSERT INTO public.post_hashtags (post_id, hashtag_id)
        VALUES (post_record.id, hashtag_record.id);
        
        RETURN QUERY SELECT post_record.id, hashtag_text, 'relationship_created';
      ELSE
        RETURN QUERY SELECT post_record.id, hashtag_text, 'already_linked';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Update the existing trending hashtags function to be more robust
CREATE OR REPLACE FUNCTION public.calculate_trending_hashtags(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  name_original TEXT,
  name_norm TEXT,
  post_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use relationship-based counting with fallback to content-based counting
  RETURN QUERY
  WITH relationship_counts AS (
    SELECT 
      h.id,
      h.name_original,
      h.name_norm,
      h.created_at,
      COUNT(DISTINCT p.id) as rel_count
    FROM public.hashtags h
    LEFT JOIN public.post_hashtags ph ON h.id = ph.hashtag_id
    LEFT JOIN public.posts p ON ph.post_id = p.id 
      AND p.is_deleted = false 
      AND p.visibility = 'public'
    GROUP BY h.id, h.name_original, h.name_norm, h.created_at
  ),
  content_counts AS (
    SELECT 
      h.id,
      h.name_original,
      h.name_norm,
      h.created_at,
      (
        SELECT COUNT(DISTINCT p.id)
        FROM public.posts p
        WHERE (p.content ILIKE '%#' || h.name_norm || '%' OR p.title ILIKE '%#' || h.name_norm || '%')
          AND p.is_deleted = false
          AND p.visibility = 'public'
      ) as content_count
    FROM public.hashtags h
  )
  SELECT 
    COALESCE(rc.id, cc.id) as id,
    COALESCE(rc.name_original, cc.name_original) as name_original,
    COALESCE(rc.name_norm, cc.name_norm) as name_norm,
    GREATEST(COALESCE(rc.rel_count, 0), COALESCE(cc.content_count, 0)) as post_count,
    COALESCE(rc.created_at, cc.created_at) as created_at
  FROM relationship_counts rc
  FULL OUTER JOIN content_counts cc ON rc.id = cc.id
  WHERE GREATEST(COALESCE(rc.rel_count, 0), COALESCE(cc.content_count, 0)) > 0
  ORDER BY GREATEST(COALESCE(rc.rel_count, 0), COALESCE(cc.content_count, 0)) DESC, 
           COALESCE(rc.created_at, cc.created_at) DESC
  LIMIT p_limit;
END;
$$;