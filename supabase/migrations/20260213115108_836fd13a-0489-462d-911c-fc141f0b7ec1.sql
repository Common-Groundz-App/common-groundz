
-- Migration 2: Harden social_influence_scores
-- Used by frontend for reads + upserts via socialIntelligenceService.ts

ALTER TABLE public.social_influence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_influence_scores FORCE ROW LEVEL SECURITY;

-- Remove anon access entirely
REVOKE ALL ON public.social_influence_scores FROM anon;

-- SELECT: authenticated can read all (non-sensitive public metrics for social recommendations)
CREATE POLICY "Authenticated users can read social influence scores"
  ON public.social_influence_scores
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: authenticated can only insert their own
CREATE POLICY "Users can insert their own social influence scores"
  ON public.social_influence_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: authenticated can only update their own
CREATE POLICY "Users can update their own social influence scores"
  ON public.social_influence_scores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy (denied by default)
