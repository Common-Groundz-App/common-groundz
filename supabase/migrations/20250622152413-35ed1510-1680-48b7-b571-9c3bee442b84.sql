
-- Add already_processed_count column to image_migration_sessions table
ALTER TABLE public.image_migration_sessions 
ADD COLUMN already_processed_count INTEGER NOT NULL DEFAULT 0;
