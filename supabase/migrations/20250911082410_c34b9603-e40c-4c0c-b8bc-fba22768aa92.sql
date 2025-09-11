-- Phase 4A: Create Moderation & Quality Control Infrastructure

-- Create enum for content flag types
CREATE TYPE public.flag_type AS ENUM (
  'inappropriate_content',
  'spam',
  'misleading_information',
  'copyright_violation',
  'duplicate',
  'other'
);

-- Create enum for flag status
CREATE TYPE public.flag_status AS ENUM (
  'pending',
  'resolved',
  'dismissed'
);

-- Create content_flags table for community moderation
CREATE TABLE public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagger_user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('entity', 'review', 'post', 'recommendation', 'photo')),
  content_id UUID NOT NULL,
  flag_type flag_type NOT NULL,
  reason TEXT,
  description TEXT,
  status flag_status NOT NULL DEFAULT 'pending',
  moderator_id UUID,
  moderator_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100)
);

-- Create user_reputation table for community quality scoring
CREATE TABLE public.user_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  overall_score INTEGER DEFAULT 100 CHECK (overall_score >= 0 AND overall_score <= 1000),
  contributions_count INTEGER DEFAULT 0,
  helpful_flags_count INTEGER DEFAULT 0,
  accurate_reports_count INTEGER DEFAULT 0,
  quality_content_score DECIMAL(3,2) DEFAULT 1.0 CHECK (quality_content_score >= 0 AND quality_content_score <= 5.0),
  community_standing TEXT DEFAULT 'member' CHECK (community_standing IN ('new', 'member', 'trusted', 'moderator')),
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create duplicate_entities table for tracking potential duplicates
CREATE TABLE public.duplicate_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id UUID NOT NULL,
  entity_b_id UUID NOT NULL,
  similarity_score DECIMAL(3,2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1.0),
  detection_method TEXT NOT NULL DEFAULT 'manual' CHECK (detection_method IN ('manual', 'auto_name', 'auto_content', 'auto_location')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'merged')),
  reported_by_user_id UUID,
  reviewed_by_admin_id UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  merged_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_a_id, entity_b_id)
);

-- Enable RLS on new tables
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_entities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for content_flags
CREATE POLICY "Users can create content flags" ON public.content_flags
FOR INSERT WITH CHECK (auth.uid() = flagger_user_id);

CREATE POLICY "Users can view their own flags" ON public.content_flags
FOR SELECT USING (auth.uid() = flagger_user_id);

CREATE POLICY "Admins can view all flags" ON public.content_flags
FOR SELECT USING (public.is_current_user_admin());

CREATE POLICY "Admins can update all flags" ON public.content_flags
FOR UPDATE USING (public.is_current_user_admin());

-- Create RLS policies for user_reputation
CREATE POLICY "Users can view all reputation scores" ON public.user_reputation
FOR SELECT USING (true);

CREATE POLICY "System can manage user reputation" ON public.user_reputation
FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for duplicate_entities
CREATE POLICY "Users can report duplicates" ON public.duplicate_entities
FOR INSERT WITH CHECK (auth.uid() = reported_by_user_id);

CREATE POLICY "Users can view pending duplicates" ON public.duplicate_entities
FOR SELECT USING (status = 'pending' OR auth.uid() = reported_by_user_id);

CREATE POLICY "Admins can manage duplicates" ON public.duplicate_entities
FOR ALL USING (public.is_current_user_admin());

-- Create indexes for performance
CREATE INDEX idx_content_flags_content ON public.content_flags (content_type, content_id);
CREATE INDEX idx_content_flags_status ON public.content_flags (status);
CREATE INDEX idx_content_flags_priority ON public.content_flags (priority_score DESC);
CREATE INDEX idx_user_reputation_score ON public.user_reputation (overall_score DESC);
CREATE INDEX idx_duplicate_entities_status ON public.duplicate_entities (status);
CREATE INDEX idx_duplicate_entities_similarity ON public.duplicate_entities (similarity_score DESC);

-- Create triggers for updated_at
CREATE TRIGGER update_content_flags_updated_at
  BEFORE UPDATE ON public.content_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_reputation_updated_at
  BEFORE UPDATE ON public.user_reputation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_duplicate_entities_updated_at
  BEFORE UPDATE ON public.duplicate_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to calculate user reputation score
CREATE OR REPLACE FUNCTION public.calculate_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_score INTEGER := 100;
  contribution_bonus INTEGER := 0;
  quality_bonus INTEGER := 0;
  flag_accuracy_bonus INTEGER := 0;
  final_score INTEGER;
BEGIN
  -- Calculate contribution bonus (5 points per quality contribution)
  SELECT COUNT(*) * 5 INTO contribution_bonus
  FROM (
    SELECT 1 FROM public.reviews WHERE user_id = p_user_id AND status = 'published'
    UNION ALL
    SELECT 1 FROM public.recommendations WHERE user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.posts WHERE user_id = p_user_id AND NOT is_deleted
    UNION ALL
    SELECT 1 FROM public.entities WHERE created_by = p_user_id AND NOT is_deleted
  ) AS contributions;
  
  -- Calculate quality bonus based on helpful flags (3 points per accurate flag)
  SELECT COALESCE(helpful_flags_count * 3, 0) INTO flag_accuracy_bonus
  FROM public.user_reputation
  WHERE user_id = p_user_id;
  
  -- Calculate final score (min 0, max 1000)
  final_score := GREATEST(0, LEAST(1000, base_score + contribution_bonus + quality_bonus + flag_accuracy_bonus));
  
  -- Update or insert reputation record
  INSERT INTO public.user_reputation (user_id, overall_score, contributions_count, last_calculated_at)
  VALUES (p_user_id, final_score, contribution_bonus / 5, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    overall_score = final_score,
    contributions_count = contribution_bonus / 5,
    last_calculated_at = now(),
    updated_at = now();
  
  RETURN final_score;
END;
$$;

-- Function to get moderation queue metrics
CREATE OR REPLACE FUNCTION public.get_moderation_metrics()
RETURNS TABLE(
  pending_flags_count BIGINT,
  resolved_flags_count BIGINT,
  high_priority_flags_count BIGINT,
  pending_duplicates_count BIGINT,
  total_users_with_reputation BIGINT,
  avg_user_reputation DECIMAL,
  content_quality_score DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.content_flags WHERE status = 'pending') as pending_flags_count,
    (SELECT COUNT(*) FROM public.content_flags WHERE status = 'resolved') as resolved_flags_count,
    (SELECT COUNT(*) FROM public.content_flags WHERE status = 'pending' AND priority_score >= 80) as high_priority_flags_count,
    (SELECT COUNT(*) FROM public.duplicate_entities WHERE status = 'pending') as pending_duplicates_count,
    (SELECT COUNT(*) FROM public.user_reputation) as total_users_with_reputation,
    (SELECT COALESCE(AVG(overall_score), 0) FROM public.user_reputation) as avg_user_reputation,
    (SELECT COALESCE(AVG(quality_content_score), 0) FROM public.user_reputation) as content_quality_score;
END;
$$;

-- Function to detect potential duplicate entities
CREATE OR REPLACE FUNCTION public.detect_potential_duplicates(similarity_threshold DECIMAL DEFAULT 0.8)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  entity_record RECORD;
  compare_record RECORD;
  name_similarity DECIMAL;
  duplicates_found INTEGER := 0;
BEGIN
  -- Clear old auto-detected duplicates
  DELETE FROM public.duplicate_entities 
  WHERE detection_method LIKE 'auto_%' AND status = 'pending';
  
  -- Compare all entities with each other for name similarity
  FOR entity_record IN 
    SELECT id, name, type FROM public.entities 
    WHERE NOT is_deleted AND approval_status = 'approved'
  LOOP
    FOR compare_record IN 
      SELECT id, name, type FROM public.entities 
      WHERE NOT is_deleted 
        AND approval_status = 'approved'
        AND id > entity_record.id  -- Avoid duplicate comparisons
        AND type = entity_record.type  -- Only compare same types
    LOOP
      -- Calculate simple name similarity (can be enhanced with better algorithms)
      name_similarity := CASE 
        WHEN LOWER(entity_record.name) = LOWER(compare_record.name) THEN 1.0
        WHEN LENGTH(entity_record.name) > 0 AND LENGTH(compare_record.name) > 0 THEN
          1.0 - (LENGTH(entity_record.name || compare_record.name) - LENGTH(REPLACE(LOWER(entity_record.name || compare_record.name), LOWER(GREATEST(entity_record.name, compare_record.name)), ''))) / 
          GREATEST(LENGTH(entity_record.name), LENGTH(compare_record.name))::DECIMAL
        ELSE 0.0
      END;
      
      -- If similarity is high enough, record as potential duplicate
      IF name_similarity >= similarity_threshold THEN
        INSERT INTO public.duplicate_entities (
          entity_a_id, entity_b_id, similarity_score, detection_method, status
        ) VALUES (
          entity_record.id, compare_record.id, name_similarity, 'auto_name', 'pending'
        ) ON CONFLICT (entity_a_id, entity_b_id) DO NOTHING;
        
        duplicates_found := duplicates_found + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN duplicates_found;
END;
$$;