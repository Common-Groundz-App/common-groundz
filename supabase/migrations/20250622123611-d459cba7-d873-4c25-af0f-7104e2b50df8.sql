
-- Create table to store individual image health check results
CREATE TABLE public.image_health_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  is_healthy BOOLEAN NOT NULL,
  error_type TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id UUID
);

-- Create table to store health check sessions (overall statistics)
CREATE TABLE public.image_health_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_checked INTEGER NOT NULL DEFAULT 0,
  healthy_count INTEGER NOT NULL DEFAULT 0,
  broken_count INTEGER NOT NULL DEFAULT 0,
  error_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint for session reference
ALTER TABLE public.image_health_results 
ADD CONSTRAINT fk_health_results_session 
FOREIGN KEY (session_id) REFERENCES public.image_health_sessions(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX idx_image_health_results_entity_id ON public.image_health_results(entity_id);
CREATE INDEX idx_image_health_results_session_id ON public.image_health_results(session_id);
CREATE INDEX idx_image_health_results_checked_at ON public.image_health_results(checked_at DESC);
CREATE INDEX idx_image_health_sessions_started_at ON public.image_health_sessions(started_at DESC);

-- Enable RLS (Row Level Security) - since this is admin-only data, we'll allow all operations for now
ALTER TABLE public.image_health_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_health_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies to allow access (you may want to restrict this to admin users only)
CREATE POLICY "Allow all operations on image_health_results" ON public.image_health_results
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on image_health_sessions" ON public.image_health_sessions  
  FOR ALL USING (true) WITH CHECK (true);
