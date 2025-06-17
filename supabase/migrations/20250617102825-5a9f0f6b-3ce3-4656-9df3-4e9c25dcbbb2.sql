
-- Add trending and engagement tracking columns to entities table
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS last_trending_update TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS view_velocity FLOAT DEFAULT 0;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS recent_views_24h INTEGER DEFAULT 0;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS recent_likes_24h INTEGER DEFAULT 0;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS recent_recommendations_24h INTEGER DEFAULT 0;

-- Create entity views tracking table
CREATE TABLE IF NOT EXISTS public.entity_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  view_duration INTEGER DEFAULT 0, -- in seconds
  interaction_type TEXT DEFAULT 'view', -- view, click, save, like
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create entity collections table for themed content
CREATE TABLE IF NOT EXISTS public.entity_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'seasonal', 'themed', 'location', 'trending'
  category TEXT, -- 'place', 'movie', 'book', etc.
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table for entities in collections
CREATE TABLE IF NOT EXISTS public.collection_entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.entity_collections(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(collection_id, entity_id)
);

-- Create user interests tracking table
CREATE TABLE IF NOT EXISTS public.user_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  interest_score FLOAT DEFAULT 1.0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT now(),
  interaction_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, category, entity_type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_entity_views_entity_id ON public.entity_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_views_user_id ON public.entity_views(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_views_created_at ON public.entity_views(created_at);
CREATE INDEX IF NOT EXISTS idx_entities_trending_score ON public.entities(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_view_velocity ON public.entities(view_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON public.user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_entities_collection_id ON public.collection_entities(collection_id);

-- Create function to calculate trending score
CREATE OR REPLACE FUNCTION public.calculate_trending_score(
  p_entity_id UUID
) RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_views INTEGER := 0;
  recent_likes INTEGER := 0;
  recent_recs INTEGER := 0;
  trending_score FLOAT := 0;
BEGIN
  -- Get recent views (last 24 hours)
  SELECT COUNT(*) INTO recent_views
  FROM public.entity_views
  WHERE entity_id = p_entity_id 
    AND created_at > now() - interval '24 hours';
    
  -- Get recent likes (recommendations and reviews)
  SELECT COUNT(*) INTO recent_likes
  FROM public.recommendation_likes rl
  JOIN public.recommendations r ON rl.recommendation_id = r.id
  WHERE r.entity_id = p_entity_id 
    AND rl.created_at > now() - interval '24 hours';
    
  -- Get recent recommendations
  SELECT COUNT(*) INTO recent_recs
  FROM public.recommendations
  WHERE entity_id = p_entity_id 
    AND created_at > now() - interval '24 hours';
    
  -- Calculate trending score with weights
  trending_score := (recent_views * 0.4) + (recent_likes * 0.3) + (recent_recs * 0.3);
  
  -- Update entity with new scores
  UPDATE public.entities
  SET 
    trending_score = trending_score,
    recent_views_24h = recent_views,
    recent_likes_24h = recent_likes,
    recent_recommendations_24h = recent_recs,
    last_trending_update = now()
  WHERE id = p_entity_id;
  
  RETURN trending_score;
END;
$$;

-- Create function to get personalized recommendations for a user
CREATE OR REPLACE FUNCTION public.get_personalized_entities(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE(
  entity_id UUID,
  personalization_score FLOAT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_interests_cte AS (
    SELECT category, entity_type, interest_score
    FROM public.user_interests
    WHERE user_id = p_user_id
  ),
  following_activity AS (
    SELECT r.entity_id, COUNT(*) as activity_count
    FROM public.recommendations r
    JOIN public.follows f ON r.user_id = f.following_id
    WHERE f.follower_id = p_user_id
      AND r.created_at > now() - interval '30 days'
    GROUP BY r.entity_id
  )
  SELECT 
    e.id as entity_id,
    COALESCE(ui.interest_score, 0) + 
    COALESCE(fa.activity_count::FLOAT * 0.1, 0) + 
    (e.trending_score * 0.2) as personalization_score,
    CASE 
      WHEN ui.interest_score > 0 THEN 'Based on your interests'
      WHEN fa.activity_count > 0 THEN 'Popular with people you follow'
      ELSE 'Trending now'
    END as reason
  FROM public.entities e
  LEFT JOIN user_interests_cte ui ON e.type::text = ui.entity_type
  LEFT JOIN following_activity fa ON e.id = fa.entity_id
  WHERE e.is_deleted = false
  ORDER BY personalization_score DESC
  LIMIT p_limit;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.entity_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all entity views" ON public.entity_views FOR SELECT USING (true);
CREATE POLICY "Users can insert their own entity views" ON public.entity_views FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view all collections" ON public.entity_collections FOR SELECT USING (is_active = true);
CREATE POLICY "Users can view all collection entities" ON public.collection_entities FOR SELECT USING (true);

CREATE POLICY "Users can view their own interests" ON public.user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own interests" ON public.user_interests FOR ALL USING (auth.uid() = user_id);

-- Insert some initial themed collections
INSERT INTO public.entity_collections (name, description, type, category, priority) VALUES
('Hidden Gems', 'Quality content with low view counts but high ratings', 'themed', 'all', 10),
('Trending This Week', 'Popular entities gaining traction', 'trending', 'all', 20),
('Cozy Coffee Shops', 'Perfect spots for a warm cup and good vibes', 'themed', 'place', 15),
('Date Night Movies', 'Perfect films for a romantic evening', 'themed', 'movie', 15),
('Weekend Reads', 'Books perfect for leisure reading', 'themed', 'book', 15),
('Local Favorites', 'Popular in your area', 'location', 'place', 25)
ON CONFLICT DO NOTHING;
