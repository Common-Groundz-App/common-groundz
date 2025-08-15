-- Create a function to find and repair missing hashtag relationships
CREATE OR REPLACE FUNCTION public.repair_hashtag_relationships()
RETURNS TABLE(post_id UUID, hashtag_content TEXT, action_taken TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  post_record RECORD;
  hashtag_matches TEXT[];
  hashtag_text TEXT;
  hashtag_normalized TEXT;
  hashtag_record RECORD;
  existing_link_count INTEGER;
BEGIN
  -- Process all posts that are not deleted
  FOR post_record IN 
    SELECT id, title, COALESCE(content, '') as content 
    FROM public.posts 
    WHERE is_deleted = false
  LOOP
    -- Extract hashtags from title and content using regex
    -- This regex matches patterns like #word, #multi word, #word-with-dashes
    hashtag_matches := ARRAY(
      SELECT DISTINCT 
        CASE 
          WHEN LENGTH(match) > 1 AND match ~ '^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$'
          THEN LOWER(match)
          ELSE NULL
        END
      FROM (
        SELECT regexp_matches(
          COALESCE(post_record.title, '') || ' ' || post_record.content, 
          '#([a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]|[a-zA-Z0-9])', 
          'g'
        )[1] AS match
      ) matches
      WHERE match IS NOT NULL
    );

    -- Process each hashtag found
    FOREACH hashtag_text IN ARRAY hashtag_matches
    LOOP
      IF hashtag_text IS NOT NULL AND LENGTH(hashtag_text) > 0 THEN
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
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Create a function to calculate trending hashtags with fallback logic
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
  -- Try relationship-based counting first
  RETURN QUERY
  SELECT 
    h.id,
    h.name_original,
    h.name_norm,
    COUNT(ph.post_id) as post_count,
    h.created_at
  FROM public.hashtags h
  LEFT JOIN public.post_hashtags ph ON h.id = ph.hashtag_id
  LEFT JOIN public.posts p ON ph.post_id = p.id AND p.is_deleted = false AND p.visibility = 'public'
  GROUP BY h.id, h.name_original, h.name_norm, h.created_at
  HAVING COUNT(ph.post_id) > 0
  ORDER BY COUNT(ph.post_id) DESC, h.created_at DESC
  LIMIT p_limit;
  
  -- If no results, fall back to content-based counting
  IF NOT FOUND THEN
    RETURN QUERY
    WITH hashtag_counts AS (
      SELECT 
        h.id,
        h.name_original,
        h.name_norm,
        h.created_at,
        (
          SELECT COUNT(*)
          FROM public.posts p
          WHERE (p.content ILIKE '%#' || h.name_norm || '%' OR p.title ILIKE '%#' || h.name_norm || '%')
            AND p.is_deleted = false
            AND p.visibility = 'public'
        ) as content_count
      FROM public.hashtags h
    )
    SELECT 
      hc.id,
      hc.name_original,
      hc.name_norm,
      hc.content_count as post_count,
      hc.created_at
    FROM hashtag_counts hc
    WHERE hc.content_count > 0
    ORDER BY hc.content_count DESC, hc.created_at DESC
    LIMIT p_limit;
  END IF;
END;
$$;