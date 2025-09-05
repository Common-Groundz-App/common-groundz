-- Enhance cached_photos table for 48-hour photo URL caching
ALTER TABLE public.cached_photos 
ADD COLUMN IF NOT EXISTS fetch_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS max_width INTEGER,
ADD COLUMN IF NOT EXISTS quality_level TEXT DEFAULT 'medium';

-- Create index for efficient lookups by photo reference and quality
CREATE INDEX IF NOT EXISTS idx_cached_photos_reference_quality 
ON public.cached_photos(original_reference, max_width);

-- Create index for cleanup of expired photos
CREATE INDEX IF NOT EXISTS idx_cached_photos_expires_at 
ON public.cached_photos(expires_at);

-- Update existing records to have proper expiry (48 hours from creation)
UPDATE public.cached_photos 
SET expires_at = created_at + INTERVAL '48 hours'
WHERE expires_at IS NULL;

-- Create function to clean up expired cached photos
CREATE OR REPLACE FUNCTION public.cleanup_expired_cached_photos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.cached_photos 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;