-- Drop the existing unique index on website_url
DROP INDEX IF EXISTS public.entities_website_url_idx;

-- Recreate the unique index with partial condition
-- Only enforce uniqueness for non-deleted entities with non-null website URLs
CREATE UNIQUE INDEX entities_website_url_idx
ON public.entities (website_url)
WHERE website_url IS NOT NULL AND is_deleted = false;

-- Add comment explaining the design decision
COMMENT ON INDEX public.entities_website_url_idx IS 
'Ensures website_url uniqueness only for active (non-deleted) entities. This allows URL reuse after soft deletion, matching behavior of platforms like GitHub, Notion, and Linear.';