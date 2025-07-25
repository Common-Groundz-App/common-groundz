-- Add media support to review_updates table
ALTER TABLE public.review_updates 
ADD COLUMN media jsonb DEFAULT '[]'::jsonb;