-- Migration 1: Add deleted_at column for soft delete
-- Add soft delete column to profiles table
ALTER TABLE public.profiles
ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Create partial index for filtering active profiles efficiently
CREATE INDEX idx_profiles_deleted_at ON public.profiles (deleted_at)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.deleted_at IS 
  'Timestamp when user requested account deletion. NULL = active account. Recovery window: 30 days.';