-- Migration 2: Update RLS policies for soft delete protection

-- Update SELECT policy: public queries exclude soft-deleted profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone (active only)"
  ON public.profiles FOR SELECT
  USING (deleted_at IS NULL);

-- Allow users to view their own profile (even if deleted, for session guard edge cases)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Update UPDATE policy: deleted users cannot modify their profile
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update their own active profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);