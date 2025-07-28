-- Create photo cache tables for Phase 2 smart caching system

-- Photo cache table to store cached photo metadata and URLs
CREATE TABLE public.cached_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('google_places', 'user_review')),
  original_reference TEXT, -- Google photo reference or review media ID
  original_url TEXT,
  cached_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  content_type TEXT,
  cache_quality_score INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache session tracking table
CREATE TABLE public.photo_cache_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  total_photos_found INTEGER DEFAULT 0,
  photos_cached INTEGER DEFAULT 0,
  cache_errors INTEGER DEFAULT 0,
  session_status TEXT DEFAULT 'running' CHECK (session_status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on cached_photos
ALTER TABLE public.cached_photos ENABLE ROW LEVEL SECURITY;

-- Create policies for cached_photos
CREATE POLICY "Anyone can view cached photos" 
ON public.cached_photos 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert cached photos" 
ON public.cached_photos 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update cached photos" 
ON public.cached_photos 
FOR UPDATE 
USING (true);

CREATE POLICY "System can delete cached photos" 
ON public.cached_photos 
FOR DELETE 
USING (true);

-- Enable RLS on photo_cache_sessions
ALTER TABLE public.photo_cache_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for photo_cache_sessions
CREATE POLICY "Anyone can view cache sessions" 
ON public.photo_cache_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage cache sessions" 
ON public.photo_cache_sessions 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_cached_photos_entity_id ON public.cached_photos(entity_id);
CREATE INDEX idx_cached_photos_source ON public.cached_photos(source);
CREATE INDEX idx_cached_photos_is_primary ON public.cached_photos(is_primary);
CREATE INDEX idx_cached_photos_created_at ON public.cached_photos(created_at);
CREATE INDEX idx_photo_cache_sessions_entity_id ON public.photo_cache_sessions(entity_id);
CREATE INDEX idx_photo_cache_sessions_status ON public.photo_cache_sessions(session_status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_cached_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_cached_photos_updated_at
  BEFORE UPDATE ON public.cached_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cached_photos_updated_at();