-- Remove the restrictive RLS policy that filters by approval_status
-- This allows all non-deleted brands to be visible to everyone immediately
DROP POLICY IF EXISTS "Users can view approved entities and their own" ON public.entities;

-- The existing "Anyone can view non-deleted entities" policy will handle all SELECT permissions
-- This ensures all brands are visible regardless of approval status, preventing duplicates