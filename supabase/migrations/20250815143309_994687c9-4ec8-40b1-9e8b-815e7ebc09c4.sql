-- Migration to clean up spaced hashtags and fix hashtag relationships
-- This addresses the issue where hashtags with spaces cause data inconsistencies

-- Step 1: Create a function to clean up spaced hashtags
CREATE OR REPLACE FUNCTION cleanup_spaced_hashtags()
RETURNS jsonb AS $$
DECLARE
    result jsonb := '{}';
    spaced_hashtag_count int := 0;
    fixed_posts_count int := 0;
    created_hashtags_count int := 0;
    hashtag_rec RECORD;
    post_rec RECORD;
    first_word text;
    normalized_first_word text;
    new_hashtag_id uuid;
BEGIN
    -- Count spaced hashtags
    SELECT COUNT(*) INTO spaced_hashtag_count 
    FROM hashtags 
    WHERE name_original LIKE '% %';
    
    -- Process each spaced hashtag
    FOR hashtag_rec IN 
        SELECT id, name_original, name_norm 
        FROM hashtags 
        WHERE name_original LIKE '% %'
    LOOP
        -- Extract first word (the actual hashtag part)
        first_word := split_part(hashtag_rec.name_original, ' ', 1);
        normalized_first_word := lower(regexp_replace(first_word, '[^a-z0-9\-_]', '', 'g'));
        
        -- Skip if first word is empty or invalid
        IF length(normalized_first_word) = 0 THEN
            CONTINUE;
        END IF;
        
        -- Find or create the proper hashtag for the first word
        SELECT id INTO new_hashtag_id 
        FROM hashtags 
        WHERE name_norm = normalized_first_word 
        LIMIT 1;
        
        IF new_hashtag_id IS NULL THEN
            -- Create new hashtag for the first word
            INSERT INTO hashtags (name_original, name_norm)
            VALUES (first_word, normalized_first_word)
            RETURNING id INTO new_hashtag_id;
            created_hashtags_count := created_hashtags_count + 1;
        END IF;
        
        -- Update all post_hashtags relationships from the spaced hashtag to the proper one
        FOR post_rec IN 
            SELECT DISTINCT post_id 
            FROM post_hashtags 
            WHERE hashtag_id = hashtag_rec.id
        LOOP
            -- Insert new relationship if it doesn't exist
            INSERT INTO post_hashtags (post_id, hashtag_id)
            VALUES (post_rec.post_id, new_hashtag_id)
            ON CONFLICT (post_id, hashtag_id) DO NOTHING;
            
            fixed_posts_count := fixed_posts_count + 1;
        END LOOP;
        
        -- Remove old spaced hashtag relationships
        DELETE FROM post_hashtags WHERE hashtag_id = hashtag_rec.id;
        
        -- Remove the spaced hashtag
        DELETE FROM hashtags WHERE id = hashtag_rec.id;
    END LOOP;
    
    -- Build result
    result := jsonb_build_object(
        'spaced_hashtags_removed', spaced_hashtag_count,
        'posts_fixed', fixed_posts_count,
        'new_hashtags_created', created_hashtags_count
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Add unique constraint to prevent duplicate hashtag relationships
ALTER TABLE post_hashtags 
ADD CONSTRAINT post_hashtags_unique 
UNIQUE (post_id, hashtag_id);

-- Step 3: Execute the cleanup
SELECT cleanup_spaced_hashtags() as cleanup_result;