-- Clear all false duplicate records from today
DELETE FROM duplicate_entities 
WHERE detection_method = 'auto_name' 
AND DATE(created_at) = CURRENT_DATE;

-- Drop the existing broken function
DROP FUNCTION IF EXISTS detect_potential_duplicates();

-- Create a new function with proper similarity calculation using Levenshtein distance
CREATE OR REPLACE FUNCTION detect_potential_duplicates()
RETURNS TABLE(
  entity_a_id uuid,
  entity_b_id uuid,
  similarity_score numeric,
  detection_method text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entity_a RECORD;
  entity_b RECORD;
  name_similarity NUMERIC;
  min_similarity NUMERIC := 0.85; -- Minimum 85% similarity threshold
BEGIN
  -- Only compare entities of the same type to avoid false positives
  FOR entity_a IN 
    SELECT id, name, type, is_deleted 
    FROM entities 
    WHERE is_deleted = false 
    AND LENGTH(TRIM(name)) > 2 -- Skip very short names
  LOOP
    FOR entity_b IN 
      SELECT id, name, type, is_deleted 
      FROM entities 
      WHERE is_deleted = false 
      AND id > entity_a.id -- Avoid duplicate comparisons
      AND type = entity_a.type -- Only compare same entity types
      AND LENGTH(TRIM(name)) > 2
    LOOP
      -- Calculate similarity using a simple but effective approach
      -- This uses trigram similarity which is more reliable than the previous method
      SELECT similarity(LOWER(TRIM(entity_a.name)), LOWER(TRIM(entity_b.name))) INTO name_similarity;
      
      -- Only flag if similarity is above threshold and not already flagged
      IF name_similarity >= min_similarity THEN
        -- Check if this pair isn't already in duplicates table
        IF NOT EXISTS (
          SELECT 1 FROM duplicate_entities 
          WHERE (entity_a_id = entity_a.id AND entity_b_id = entity_b.id)
          OR (entity_a_id = entity_b.id AND entity_b_id = entity_a.id)
        ) THEN
          -- Return the potential duplicate
          entity_a_id := entity_a.id;
          entity_b_id := entity_b.id;
          similarity_score := name_similarity;
          detection_method := 'auto_name_trigram';
          RETURN NEXT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$;

-- Enable the pg_trgm extension if not already enabled (needed for similarity function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create an improved function that actually inserts the detected duplicates
CREATE OR REPLACE FUNCTION run_duplicate_detection()
RETURNS TABLE(
  duplicates_found integer,
  duplicates_inserted integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duplicate_record RECORD;
  found_count INTEGER := 0;
  inserted_count INTEGER := 0;
BEGIN
  -- Detect and insert potential duplicates
  FOR duplicate_record IN 
    SELECT * FROM detect_potential_duplicates()
  LOOP
    found_count := found_count + 1;
    
    -- Insert into duplicate_entities table
    INSERT INTO duplicate_entities (
      entity_a_id,
      entity_b_id,
      similarity_score,
      detection_method,
      status
    ) VALUES (
      duplicate_record.entity_a_id,
      duplicate_record.entity_b_id,
      duplicate_record.similarity_score,
      duplicate_record.detection_method,
      'pending'
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  duplicates_found := found_count;
  duplicates_inserted := inserted_count;
  RETURN NEXT;
END;
$$;