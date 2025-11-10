-- Phase 1.5.2: Create Long-Term Memory & Product Relationship Tables

-- ============================================================================
-- Part A: Create user_conversation_memory table
-- ============================================================================

-- Create the table
CREATE TABLE public.user_conversation_memory (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Memory classification
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'goal', 'context', 'fact', 'interest')),
  
  -- The actual memory content
  content TEXT NOT NULL,
  
  -- Importance scoring (1-10, determines retention priority)
  importance_score INTEGER DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10),
  
  -- Vector embedding for semantic search
  embedding vector(1536),
  
  -- Source tracking
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  
  -- Metadata for additional context
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for user_conversation_memory
CREATE INDEX user_memory_user_id_idx ON public.user_conversation_memory(user_id);
CREATE INDEX user_memory_embedding_idx ON public.user_conversation_memory 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 50);
CREATE INDEX user_memory_type_idx ON public.user_conversation_memory(memory_type);
CREATE INDEX user_memory_importance_idx ON public.user_conversation_memory(importance_score DESC);
CREATE INDEX user_memory_last_accessed_idx ON public.user_conversation_memory(last_accessed_at DESC);
CREATE INDEX user_memory_user_type_idx ON public.user_conversation_memory(user_id, memory_type);

-- Enable RLS
ALTER TABLE public.user_conversation_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_conversation_memory
CREATE POLICY "Users can view their own memories"
ON public.user_conversation_memory
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories"
ON public.user_conversation_memory
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
ON public.user_conversation_memory
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
ON public.user_conversation_memory
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all memories"
ON public.user_conversation_memory
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Documentation comments for user_conversation_memory
COMMENT ON TABLE public.user_conversation_memory IS 'Stores long-term user memories extracted from conversations for personalized AI interactions';
COMMENT ON COLUMN public.user_conversation_memory.memory_type IS 'Category: preference, goal, context, fact, or interest';
COMMENT ON COLUMN public.user_conversation_memory.importance_score IS 'Priority score 1-10, determines memory retention and recall priority';
COMMENT ON COLUMN public.user_conversation_memory.embedding IS 'Vector embedding for semantic memory retrieval';
COMMENT ON COLUMN public.user_conversation_memory.access_count IS 'Number of times this memory has been accessed/used';

-- ============================================================================
-- Part B: Create product_relationships table
-- ============================================================================

-- Create the table
CREATE TABLE public.product_relationships (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity references (the two products/entities being related)
  entity_a_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  entity_b_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  
  -- Relationship type
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'complementary',
    'alternative',
    'similar',
    'conflicting',
    'prerequisite',
    'upgrade'
  )),
  
  -- Confidence score (0.0-1.0)
  confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  
  -- Discovery tracking
  discovered_from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Evidence for why this relationship exists
  evidence_text TEXT,
  
  -- Vector embedding of the relationship description
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Validation tracking
  confirmation_count INTEGER DEFAULT 1,
  rejection_count INTEGER DEFAULT 0,
  
  -- Metadata for additional context
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT different_entities CHECK (entity_a_id != entity_b_id),
  CONSTRAINT unique_relationship UNIQUE (entity_a_id, entity_b_id, relationship_type)
);

-- Indexes for product_relationships
CREATE INDEX product_rel_entity_a_idx ON public.product_relationships(entity_a_id);
CREATE INDEX product_rel_entity_b_idx ON public.product_relationships(entity_b_id);
CREATE INDEX product_rel_type_idx ON public.product_relationships(relationship_type);
CREATE INDEX product_rel_confidence_idx ON public.product_relationships(confidence_score DESC);
CREATE INDEX product_rel_embedding_idx ON public.product_relationships 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 50);
CREATE INDEX product_rel_entity_type_idx ON public.product_relationships(entity_a_id, relationship_type);
CREATE INDEX product_rel_confirmations_idx ON public.product_relationships(confirmation_count DESC);
CREATE INDEX product_rel_bidirectional_idx ON public.product_relationships(entity_a_id, entity_b_id);

-- Enable RLS
ALTER TABLE public.product_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_relationships
CREATE POLICY "Anyone can view approved relationships"
ON public.product_relationships
FOR SELECT
TO authenticated
USING (confidence_score >= 0.6);

CREATE POLICY "Users can suggest relationships"
ON public.product_relationships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = discovered_from_user_id 
  AND confidence_score <= 0.7
);

CREATE POLICY "Users can update their suggestions"
ON public.product_relationships
FOR UPDATE
TO authenticated
USING (auth.uid() = discovered_from_user_id AND confidence_score < 0.8)
WITH CHECK (auth.uid() = discovered_from_user_id);

CREATE POLICY "Service role can manage all relationships"
ON public.product_relationships
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can view verified relationships"
ON public.product_relationships
FOR SELECT
TO anon
USING (confidence_score >= 0.8);

-- Documentation comments for product_relationships
COMMENT ON TABLE public.product_relationships IS 'Stores semantic relationships between products/entities discovered through user interactions';
COMMENT ON COLUMN public.product_relationships.relationship_type IS 'Type of relationship: complementary, alternative, similar, conflicting, prerequisite, or upgrade';
COMMENT ON COLUMN public.product_relationships.confidence_score IS 'Confidence level 0.0-1.0, increases with confirmations';
COMMENT ON COLUMN public.product_relationships.evidence_text IS 'Natural language explanation of why this relationship exists';
COMMENT ON COLUMN public.product_relationships.embedding IS 'Vector embedding for semantic relationship search';
COMMENT ON COLUMN public.product_relationships.confirmation_count IS 'Number of times this relationship has been confirmed by users or AI';