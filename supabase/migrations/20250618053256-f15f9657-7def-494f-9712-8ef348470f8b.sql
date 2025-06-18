
-- Add columns for enhanced trending algorithm
ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS view_velocity DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS recent_views_24h INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recent_likes_24h INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recent_recommendations_24h INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_trending_update TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add geographic and seasonal boost factors
ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS geographic_boost DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS seasonal_boost DOUBLE PRECISION DEFAULT 0;

-- Create function to calculate enhanced trending score with velocity and time-decay
CREATE OR REPLACE FUNCTION calculate_enhanced_trending_score(p_entity_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_views INTEGER := 0;
  recent_likes INTEGER := 0;
  recent_recs INTEGER := 0;
  view_velocity_score FLOAT := 0;
  time_decay_factor FLOAT := 1.0;
  geographic_factor FLOAT := 1.0;
  seasonal_factor FLOAT := 1.0;
  base_popularity FLOAT := 0;
  final_score FLOAT := 0;
BEGIN
  -- Get recent activity (last 24 hours)
  SELECT COUNT(*) INTO recent_views
  FROM entity_views
  WHERE entity_id = p_entity_id 
    AND created_at > now() - interval '24 hours';
    
  -- Get recent likes (recommendations and reviews)
  SELECT COUNT(*) INTO recent_likes
  FROM recommendation_likes rl
  JOIN recommendations r ON rl.recommendation_id = r.id
  WHERE r.entity_id = p_entity_id 
    AND rl.created_at > now() - interval '24 hours';
    
  -- Get recent recommendations
  SELECT COUNT(*) INTO recent_recs
  FROM recommendations
  WHERE entity_id = p_entity_id 
    AND created_at > now() - interval '24 hours';
    
  -- Calculate velocity (change in activity over time)
  view_velocity_score := recent_views * 0.5 + recent_likes * 0.3 + recent_recs * 0.2;
  
  -- Time decay factor (newer entities get slight boost)
  SELECT CASE 
    WHEN created_at > now() - interval '7 days' THEN 1.2
    WHEN created_at > now() - interval '30 days' THEN 1.1
    ELSE 1.0
  END INTO time_decay_factor
  FROM entities WHERE id = p_entity_id;
  
  -- Get base popularity score
  SELECT COALESCE(popularity_score, 0) INTO base_popularity
  FROM entities WHERE id = p_entity_id;
  
  -- Get geographic and seasonal boosts
  SELECT 
    COALESCE(geographic_boost, 0),
    COALESCE(seasonal_boost, 0)
  INTO geographic_factor, seasonal_factor
  FROM entities WHERE id = p_entity_id;
  
  -- Calculate final trending score with all factors
  final_score := (base_popularity * 0.3) + 
                 (view_velocity_score * 0.4) + 
                 (geographic_factor * 0.15) + 
                 (seasonal_factor * 0.15);
  
  final_score := final_score * time_decay_factor;
  
  -- Update entity with new scores
  UPDATE entities
  SET 
    trending_score = final_score,
    view_velocity = view_velocity_score,
    recent_views_24h = recent_views,
    recent_likes_24h = recent_likes,
    recent_recommendations_24h = recent_recs,
    last_trending_update = now()
  WHERE id = p_entity_id;
  
  RETURN final_score;
END;
$$;

-- Create function to update all trending scores (for background jobs)
CREATE OR REPLACE FUNCTION update_all_trending_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entity_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Update trending scores for entities that have been active recently
  FOR entity_record IN 
    SELECT DISTINCT e.id
    FROM entities e
    LEFT JOIN entity_views ev ON e.id = ev.entity_id
    LEFT JOIN recommendations r ON e.id = r.entity_id
    WHERE e.is_deleted = false
      AND (
        ev.created_at > now() - interval '48 hours' OR
        r.created_at > now() - interval '48 hours' OR
        e.last_trending_update < now() - interval '6 hours'
      )
  LOOP
    PERFORM calculate_enhanced_trending_score(entity_record.id);
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;

-- Create user activity patterns table for better personalization
CREATE TABLE IF NOT EXISTS user_activity_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  category TEXT NOT NULL,
  activity_score DOUBLE PRECISION DEFAULT 1.0,
  time_of_day INTEGER, -- 0-23 hour
  day_of_week INTEGER, -- 0-6 where 0 is Sunday
  interaction_velocity DOUBLE PRECISION DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, entity_type, category, time_of_day, day_of_week)
);

-- Add RLS policies for user_activity_patterns
ALTER TABLE user_activity_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity patterns" 
  ON user_activity_patterns 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity patterns" 
  ON user_activity_patterns 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity patterns" 
  ON user_activity_patterns 
  FOR UPDATE 
  USING (auth.uid() = user_id);
