
-- Step 1: Add latest_rating column to reviews table
ALTER TABLE public.reviews 
ADD COLUMN latest_rating numeric(2,1) DEFAULT NULL;

-- Step 2: Create enhanced timeline-aware auto-recommendation function
CREATE OR REPLACE FUNCTION public.auto_recommend_review_timeline_aware()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  effective_rating DECIMAL(2,1);
BEGIN
  -- Calculate effective rating: use latest_rating if available, otherwise original rating
  effective_rating := COALESCE(NEW.latest_rating, NEW.rating);
  
  -- Auto-recommend based on effective rating
  IF effective_rating >= 4 THEN
    NEW.is_recommended := true;
  ELSE
    NEW.is_recommended := false;
  END IF;
  
  -- Calculate initial trust score
  NEW.trust_score := public.calculate_trust_score(NEW.id);
  
  RETURN NEW;
END;
$function$;

-- Step 3: Enhanced timeline stats update function
CREATE OR REPLACE FUNCTION public.update_review_timeline_stats_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  latest_rating_value DECIMAL(2,1);
  timeline_count_value INTEGER;
BEGIN
  -- Get the latest rating from timeline updates (most recent non-null rating)
  SELECT rating INTO latest_rating_value
  FROM public.review_updates 
  WHERE review_id = NEW.review_id 
    AND rating IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Get timeline count
  SELECT COUNT(*) INTO timeline_count_value
  FROM public.review_updates 
  WHERE review_id = NEW.review_id;
  
  -- Update review with timeline stats and latest rating
  UPDATE public.reviews
  SET 
    timeline_count = timeline_count_value,
    has_timeline = true,
    latest_rating = latest_rating_value,
    trust_score = public.calculate_trust_score(NEW.review_id),
    updated_at = now()
  WHERE id = NEW.review_id;
  
  -- After updating latest_rating, trigger recommendation re-evaluation
  -- We do this by updating the review again to trigger the auto_recommend function
  UPDATE public.reviews
  SET updated_at = now()
  WHERE id = NEW.review_id;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Replace the existing auto-recommendation trigger with the enhanced version
DROP TRIGGER IF EXISTS auto_recommend_review_trigger ON public.reviews;

CREATE TRIGGER auto_recommend_review_timeline_aware_trigger
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recommend_review_timeline_aware();

-- Step 5: Replace the existing timeline stats trigger with the enhanced version
DROP TRIGGER IF EXISTS update_review_timeline_stats_trigger ON public.review_updates;

CREATE TRIGGER update_review_timeline_stats_enhanced_trigger
  AFTER INSERT ON public.review_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_timeline_stats_enhanced();

-- Step 6: Populate latest_rating for existing reviews with timeline updates
UPDATE public.reviews 
SET latest_rating = (
  SELECT rating 
  FROM public.review_updates 
  WHERE review_updates.review_id = reviews.id 
    AND rating IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE has_timeline = true;

-- Step 7: Update is_recommended status for existing reviews based on effective rating
UPDATE public.reviews
SET is_recommended = CASE 
  WHEN COALESCE(latest_rating, rating) >= 4 THEN true 
  ELSE false 
END
WHERE id IN (
  SELECT id FROM public.reviews 
  WHERE COALESCE(latest_rating, rating) != rating 
    OR (latest_rating IS NOT NULL AND is_recommended != (latest_rating >= 4))
);
