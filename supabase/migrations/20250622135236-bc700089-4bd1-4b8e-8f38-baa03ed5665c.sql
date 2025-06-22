
-- Create table to store image migration sessions
CREATE TABLE public.image_migration_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_entities INTEGER NOT NULL DEFAULT 0,
  migrated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store individual migration results
CREATE TABLE public.image_migration_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  original_url TEXT NOT NULL,
  new_url TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  migrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint for session reference
ALTER TABLE public.image_migration_results 
ADD CONSTRAINT fk_migration_results_session 
FOREIGN KEY (session_id) REFERENCES public.image_migration_sessions(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX idx_image_migration_sessions_started_at ON public.image_migration_sessions(started_at DESC);
CREATE INDEX idx_image_migration_sessions_status ON public.image_migration_sessions(status);
CREATE INDEX idx_image_migration_results_session_id ON public.image_migration_results(session_id);
CREATE INDEX idx_image_migration_results_entity_id ON public.image_migration_results(entity_id);
CREATE INDEX idx_image_migration_results_success ON public.image_migration_results(success);
CREATE INDEX idx_image_migration_results_migrated_at ON public.image_migration_results(migrated_at DESC);

-- Enable RLS (Row Level Security) - since this is admin-only data, we'll allow all operations for now
ALTER TABLE public.image_migration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_migration_results ENABLE ROW LEVEL SECURITY;

-- Create policies to allow access (you may want to restrict this to admin users only)
CREATE POLICY "Allow all operations on image_migration_sessions" ON public.image_migration_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on image_migration_results" ON public.image_migration_results
  FOR ALL USING (true) WITH CHECK (true);
