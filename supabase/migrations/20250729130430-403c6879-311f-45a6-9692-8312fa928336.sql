-- Add moderation fields to entity_photos table
ALTER TABLE public.entity_photos 
ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS moderated_by uuid,
ADD COLUMN IF NOT EXISTS moderated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS moderation_reason text;

-- Add check constraint for moderation_status (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'entity_photos_moderation_status_check'
    ) THEN
        ALTER TABLE public.entity_photos 
        ADD CONSTRAINT entity_photos_moderation_status_check 
        CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Add indexes for efficient moderation queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_entity_photos_moderation_status ON public.entity_photos(moderation_status);
CREATE INDEX IF NOT EXISTS idx_entity_photos_moderated_at ON public.entity_photos(moderated_at);

-- Update photo_reports table to support resolution tracking
ALTER TABLE public.photo_reports 
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS resolved_by uuid,
ADD COLUMN IF NOT EXISTS resolution_reason text;

-- Create index for efficient photo reports queries (skip status as it exists)
CREATE INDEX IF NOT EXISTS idx_photo_reports_resolved_at ON public.photo_reports(resolved_at);