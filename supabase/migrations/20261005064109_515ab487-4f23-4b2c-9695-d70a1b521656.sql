DROP POLICY IF EXISTS "Users can view all review updates" ON public.review_updates;
CREATE POLICY "Timeline updates follow parent review visibility"
ON public.review_updates
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_updates.review_id
  )
);