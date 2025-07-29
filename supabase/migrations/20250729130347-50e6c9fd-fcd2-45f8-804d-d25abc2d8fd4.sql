-- Add moderation fields to entity_photos table
ALTER TABLE public.entity_photos 
ADD COLUMN moderation_status text NOT NULL DEFAULT 'approved',
ADD COLUMN moderated_by uuid,
ADD COLUMN moderated_at timestamp with time zone,
ADD COLUMN moderation_reason text;

-- Add check constraint for moderation_status
ALTER TABLE public.entity_photos 
ADD CONSTRAINT entity_photos_moderation_status_check 
CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

-- Add index for efficient moderation queries
CREATE INDEX idx_entity_photos_moderation_status ON public.entity_photos(moderation_status);
CREATE INDEX idx_entity_photos_moderated_at ON public.entity_photos(moderated_at);

-- Update photo_reports table to support multiple reasons and resolution tracking
ALTER TABLE public.photo_reports 
ADD COLUMN resolved_at timestamp with time zone,
ADD COLUMN resolved_by uuid,
ADD COLUMN resolution_reason text;

-- Create index for efficient photo reports queries
CREATE INDEX idx_photo_reports_status ON public.photo_reports(status);
CREATE INDEX idx_photo_reports_resolved_at ON public.photo_reports(resolved_at);