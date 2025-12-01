-- Phase 1: Data Foundation - Create user inventory, journeys, and routines tables

-- 1. Create user_stuff table (My Stuff inventory)
CREATE TABLE IF NOT EXISTS public.user_stuff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'currently_using' 
    CHECK (status IN ('currently_using', 'used_before', 'want_to_try', 'wishlist', 'stopped')),
  sentiment_score INTEGER CHECK (sentiment_score >= -5 AND sentiment_score <= 5),
  
  -- Timeline
  started_using_at TIMESTAMP WITH TIME ZONE,
  stopped_using_at TIMESTAMP WITH TIME ZONE,
  
  -- Categorization (denormalized for performance)
  category TEXT,
  entity_type TEXT,
  
  -- Context
  context JSONB DEFAULT '{}',
  
  -- Source tracking (for hybrid population)
  source TEXT NOT NULL DEFAULT 'manual' 
    CHECK (source IN ('manual', 'auto_review', 'auto_save', 'auto_post')),
  source_reference_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, entity_id)
);

-- Indexes for user_stuff
CREATE INDEX idx_user_stuff_user_id ON user_stuff(user_id);
CREATE INDEX idx_user_stuff_entity_id ON user_stuff(entity_id);
CREATE INDEX idx_user_stuff_category ON user_stuff(user_id, category);
CREATE INDEX idx_user_stuff_status ON user_stuff(user_id, status);

-- RLS policies for user_stuff
ALTER TABLE user_stuff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stuff"
ON user_stuff FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own stuff"
ON user_stuff FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for user_stuff updated_at
CREATE TRIGGER update_user_stuff_updated_at
BEFORE UPDATE ON user_stuff
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Create user_entity_journeys table (transition tracking)
CREATE TABLE IF NOT EXISTS public.user_entity_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Journey entities
  from_entity_id UUID NOT NULL REFERENCES entities(id),
  to_entity_id UUID NOT NULL REFERENCES entities(id),
  
  -- Category denormalization for performance
  from_category TEXT NOT NULL,
  to_category TEXT NOT NULL,
  from_entity_type TEXT,
  to_entity_type TEXT,
  
  -- Journey details
  transition_type TEXT NOT NULL 
    CHECK (transition_type IN ('upgrade', 'downgrade', 'switch', 'complement', 'alternative')),
  from_sentiment INTEGER CHECK (from_sentiment >= -5 AND from_sentiment <= 5),
  to_sentiment INTEGER CHECK (to_sentiment >= -5 AND to_sentiment <= 5),
  
  -- Evidence
  evidence_text TEXT,
  source_review_id UUID REFERENCES reviews(id),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for user_entity_journeys
CREATE INDEX idx_user_journeys_user_id ON user_entity_journeys(user_id);
CREATE INDEX idx_user_journeys_from_entity ON user_entity_journeys(from_entity_id);
CREATE INDEX idx_user_journeys_to_entity ON user_entity_journeys(to_entity_id);
CREATE INDEX idx_user_journeys_category ON user_entity_journeys(from_category, to_category);
CREATE INDEX idx_user_journeys_type ON user_entity_journeys(transition_type);

-- RLS policies for user_entity_journeys
ALTER TABLE user_entity_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journeys"
ON user_entity_journeys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journeys"
ON user_entity_journeys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all journeys for recommendations"
ON user_entity_journeys FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Create user_routines table
CREATE TABLE IF NOT EXISTS public.user_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Routine info
  routine_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  
  -- Steps with entity references
  steps JSONB DEFAULT '[]',
  
  -- Metadata
  frequency TEXT DEFAULT 'daily',
  time_of_day TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for user_routines
CREATE INDEX idx_user_routines_user_id ON user_routines(user_id);
CREATE INDEX idx_user_routines_category ON user_routines(user_id, category);
CREATE INDEX idx_user_routines_active ON user_routines(user_id, is_active);

-- RLS policies for user_routines
ALTER TABLE user_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own routines"
ON user_routines FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own routines"
ON user_routines FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for user_routines updated_at
CREATE TRIGGER update_user_routines_updated_at
BEFORE UPDATE ON user_routines
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Enhance user_similarities table
ALTER TABLE public.user_similarities
ADD COLUMN IF NOT EXISTS overall_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifestyle_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS category_overlap FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS journey_alignment FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stuff_overlap JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS routines_similarity JSONB DEFAULT '{}';

-- Add index for user_similarities
CREATE INDEX IF NOT EXISTS idx_user_similarities_overall 
ON user_similarities(user_a_id, overall_score DESC);

-- 5. Enhance product_relationships table
ALTER TABLE public.product_relationships
ADD COLUMN IF NOT EXISTS consensus_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS avg_confidence FLOAT,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add comments for future migration clarity
COMMENT ON TABLE user_stuff IS 'User inventory - tracks what users own, use, want to try (My Stuff feature)';
COMMENT ON TABLE user_entity_journeys IS 'User transition tracking - records when users switch from one entity to another';
COMMENT ON TABLE user_routines IS 'User routines - skincare, haircare, workout routines with entity references';
COMMENT ON COLUMN user_entity_journeys.from_entity_type IS 'Enables cross-domain recommendations like "watched movie → read book"';
COMMENT ON COLUMN user_entity_journeys.to_entity_type IS 'Enables cross-domain recommendations like "used product → tried service"';