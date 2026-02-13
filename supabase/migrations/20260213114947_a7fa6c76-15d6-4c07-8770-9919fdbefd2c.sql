
-- Migration 1: Lock down 5 internal tables
-- These tables are not used by the frontend; only edge functions (service_role) access them.

-- 1. embedding_trigger_log
ALTER TABLE public.embedding_trigger_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_trigger_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.embedding_trigger_log FROM anon;
REVOKE ALL ON public.embedding_trigger_log FROM authenticated;

-- 2. recommendation_explanations
ALTER TABLE public.recommendation_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_explanations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_explanations FROM anon;
REVOKE ALL ON public.recommendation_explanations FROM authenticated;

-- 3. recommendation_quality_scores
ALTER TABLE public.recommendation_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_quality_scores FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendation_quality_scores FROM anon;
REVOKE ALL ON public.recommendation_quality_scores FROM authenticated;

-- 4. user_behavior_patterns
ALTER TABLE public.user_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_patterns FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_behavior_patterns FROM anon;
REVOKE ALL ON public.user_behavior_patterns FROM authenticated;

-- 5. user_similarities
ALTER TABLE public.user_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_similarities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_similarities FROM anon;
REVOKE ALL ON public.user_similarities FROM authenticated;
