-- Add is_claimed field to entities table
ALTER TABLE public.entities 
ADD COLUMN is_claimed BOOLEAN NOT NULL DEFAULT FALSE;