
-- Migration 6: Function Search Path Hardening
-- Apply SET search_path = public, pg_temp to 18 SECURITY DEFINER functions

ALTER FUNCTION public.calculate_enhanced_trending_score(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_social_influence_score(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_trending_hashtags(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_trending_score(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_user_similarity(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.detect_potential_duplicates() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_categories_by_parent(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_category_hierarchy() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_child_entities(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_child_entities_with_ratings(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_comments_with_profiles(text, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_network_recommendations_discovery(uuid, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_personalized_entities(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.run_duplicate_detection() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_categories(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_ai_summary_generation() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_review_embedding() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_all_trending_scores() SET search_path = public, pg_temp;
