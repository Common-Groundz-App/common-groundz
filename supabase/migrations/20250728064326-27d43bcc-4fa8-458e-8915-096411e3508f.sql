-- First, clean up existing duplicates (keep the most recent one for each entity_id + original_url combination)
DELETE FROM public.cached_photos 
WHERE id NOT IN (
  SELECT DISTINCT ON (entity_id, original_url) id
  FROM public.cached_photos
  ORDER BY entity_id, original_url, created_at DESC
);

-- Then add unique constraint to prevent future duplicates
ALTER TABLE public.cached_photos 
ADD CONSTRAINT unique_entity_original_url 
UNIQUE (entity_id, original_url);