-- Fix immediate missing hashtag relationship
INSERT INTO public.post_hashtags (post_id, hashtag_id)
VALUES ('06d60d35-10b7-4f19-98d6-2ec02030eb44', 'f3345b32-e1ee-4c07-a814-5346807e1645')
ON CONFLICT (post_id, hashtag_id) DO NOTHING;

-- Drop and recreate the repair function with proper table aliases
DROP FUNCTION IF EXISTS public.repair_hashtag_relationships();

CREATE OR REPLACE FUNCTION public.repair_hashtag_relationships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  posts_processed INTEGER := 0;
  relationships_created INTEGER := 0;
  hashtags_created INTEGER := 0;
  post_record RECORD;
  hashtag_text TEXT;
  hashtag_normalized TEXT;
  hashtag_id UUID;
  extracted_hashtags TEXT[];
BEGIN
  -- Process all posts that might have hashtags in content or title
  FOR post_record IN 
    SELECT p.id, p.content, p.title 
    FROM posts p
    WHERE p.is_deleted = false 
      AND (p.content IS NOT NULL OR p.title IS NOT NULL)
  LOOP
    posts_processed := posts_processed + 1;
    
    -- Extract hashtags from content and title
    extracted_hashtags := string_to_array(
      regexp_replace(
        COALESCE(post_record.content, '') || ' ' || COALESCE(post_record.title, ''),
        '#([a-zA-Z0-9_-]+)', 
        E'\\1\n', 
        'g'
      ), 
      E'\n'
    );
    
    -- Process each extracted hashtag
    FOREACH hashtag_text IN ARRAY extracted_hashtags
    LOOP
      IF hashtag_text != '' AND hashtag_text ~ '^[a-zA-Z0-9_-]+$' THEN
        -- Normalize hashtag
        hashtag_normalized := lower(regexp_replace(hashtag_text, '[^a-zA-Z0-9]', '', 'g'));
        
        IF hashtag_normalized != '' THEN
          -- Find or create hashtag
          SELECT h.id INTO hashtag_id 
          FROM hashtags h 
          WHERE h.name_norm = hashtag_normalized;
          
          IF hashtag_id IS NULL THEN
            INSERT INTO hashtags (name_original, name_norm)
            VALUES (hashtag_text, hashtag_normalized)
            RETURNING id INTO hashtag_id;
            hashtags_created := hashtags_created + 1;
          END IF;
          
          -- Create relationship if it doesn't exist
          INSERT INTO post_hashtags (post_id, hashtag_id)
          VALUES (post_record.id, hashtag_id)
          ON CONFLICT (post_id, hashtag_id) DO NOTHING;
          
          -- Check if we actually inserted a new relationship
          IF FOUND THEN
            relationships_created := relationships_created + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'posts_processed', posts_processed,
    'relationships_created', relationships_created,
    'hashtags_created', hashtags_created,
    'status', 'completed'
  );
END;
$$;