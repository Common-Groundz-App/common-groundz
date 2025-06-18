
-- Create user similarity matrix for collaborative filtering
CREATE TABLE public.user_similarities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id UUID NOT NULL,
  user_b_id UUID NOT NULL,
  similarity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  similarity_type TEXT NOT NULL DEFAULT 'collaborative', -- 'collaborative', 'social', 'behavioral'
  last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_a_id, user_b_id, similarity_type)
);

-- Create recommendation explanations table
CREATE TABLE public.recommendation_explanations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  explanation_type TEXT NOT NULL, -- 'collaborative', 'social', 'content', 'temporal'
  explanation_text TEXT NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  algorithm_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create social influence scores table
CREATE TABLE public.social_influence_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  influence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  expertise_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- Create user behavior patterns for advanced personalization
CREATE TABLE public.user_behavior_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL, -- 'session', 'temporal', 'contextual'
  pattern_data JSONB NOT NULL DEFAULT '{}',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recommendation quality scores
CREATE TABLE public.recommendation_quality_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID,
  entity_id UUID,
  quality_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  spam_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  freshness_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  social_proof_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_user_similarities_user_a ON public.user_similarities(user_a_id);
CREATE INDEX idx_user_similarities_user_b ON public.user_similarities(user_b_id);
CREATE INDEX idx_user_similarities_score ON public.user_similarities(similarity_score DESC);
CREATE INDEX idx_recommendation_explanations_user_entity ON public.recommendation_explanations(user_id, entity_id);
CREATE INDEX idx_social_influence_category ON public.social_influence_scores(category);
CREATE INDEX idx_user_behavior_patterns_user_type ON public.user_behavior_patterns(user_id, pattern_type);
CREATE INDEX idx_recommendation_quality_entity ON public.recommendation_quality_scores(entity_id);

-- Add function to calculate user similarity based on ratings
CREATE OR REPLACE FUNCTION public.calculate_user_similarity(user_a_id UUID, user_b_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  similarity_score DOUBLE PRECISION := 0;
  common_entities INTEGER := 0;
BEGIN
  -- Calculate Pearson correlation coefficient for users based on their ratings
  WITH user_a_ratings AS (
    SELECT entity_id, rating::DOUBLE PRECISION as rating
    FROM public.recommendations
    WHERE user_id = user_a_id
  ),
  user_b_ratings AS (
    SELECT entity_id, rating::DOUBLE PRECISION as rating
    FROM public.recommendations
    WHERE user_id = user_b_id
  ),
  common_ratings AS (
    SELECT 
      a.rating as rating_a,
      b.rating as rating_b
    FROM user_a_ratings a
    JOIN user_b_ratings b ON a.entity_id = b.entity_id
  )
  SELECT 
    COUNT(*),
    CASE 
      WHEN COUNT(*) < 2 THEN 0
      ELSE COALESCE(
        (COUNT(*) * SUM(rating_a * rating_b) - SUM(rating_a) * SUM(rating_b)) /
        NULLIF(
          SQRT((COUNT(*) * SUM(rating_a * rating_a) - SUM(rating_a) * SUM(rating_a)) *
               (COUNT(*) * SUM(rating_b * rating_b) - SUM(rating_b) * SUM(rating_b))), 0
        ), 0
      )
    END
  INTO common_entities, similarity_score
  FROM common_ratings;
  
  -- Normalize similarity score between 0 and 1
  similarity_score := (similarity_score + 1) / 2;
  
  -- Apply penalty for users with few common entities
  IF common_entities < 3 THEN
    similarity_score := similarity_score * (common_entities::DOUBLE PRECISION / 3);
  END IF;
  
  RETURN GREATEST(0, LEAST(1, similarity_score));
END;
$$;

-- Add function to calculate social influence score
CREATE OR REPLACE FUNCTION public.calculate_social_influence_score(p_user_id UUID, p_category TEXT)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  follower_count INTEGER := 0;
  avg_rating DOUBLE PRECISION := 0;
  recommendation_count INTEGER := 0;
  engagement_rate DOUBLE PRECISION := 0;
  influence_score DOUBLE PRECISION := 0;
BEGIN
  -- Get follower count
  SELECT COUNT(*) INTO follower_count
  FROM public.follows
  WHERE following_id = p_user_id;
  
  -- Get average rating and recommendation count for the category
  SELECT 
    AVG(rating::DOUBLE PRECISION),
    COUNT(*)
  INTO avg_rating, recommendation_count
  FROM public.recommendations
  WHERE user_id = p_user_id 
    AND category::TEXT = p_category;
  
  -- Calculate engagement rate (likes per recommendation)
  SELECT 
    COALESCE(AVG(like_counts.like_count), 0)
  INTO engagement_rate
  FROM public.recommendations r
  LEFT JOIN (
    SELECT recommendation_id, COUNT(*) as like_count
    FROM public.recommendation_likes
    GROUP BY recommendation_id
  ) like_counts ON r.id = like_counts.recommendation_id
  WHERE r.user_id = p_user_id 
    AND r.category::TEXT = p_category;
  
  -- Calculate influence score using weighted factors
  influence_score := 
    (LEAST(follower_count, 1000)::DOUBLE PRECISION / 1000 * 0.3) + -- Follower influence (capped)
    (COALESCE(avg_rating, 0) / 5 * 0.3) + -- Rating quality
    (LEAST(recommendation_count, 100)::DOUBLE PRECISION / 100 * 0.2) + -- Activity level
    (LEAST(engagement_rate, 50)::DOUBLE PRECISION / 50 * 0.2); -- Engagement
  
  RETURN GREATEST(0, LEAST(1, influence_score));
END;
$$;
