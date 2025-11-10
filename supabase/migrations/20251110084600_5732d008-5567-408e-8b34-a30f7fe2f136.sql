-- Phase 1.5.5: Auto-Embedding Triggers with Security & Performance Enhancements
-- Drop existing triggers and functions for idempotency
DROP TRIGGER IF EXISTS trigger_review_embedding_after ON public.reviews;
DROP TRIGGER IF EXISTS trigger_profile_embedding_after ON public.profiles;
DROP TRIGGER IF EXISTS trigger_memory_embedding_after ON public.user_conversation_memory;
DROP TRIGGER IF EXISTS trigger_relationship_embedding_after ON public.product_relationships;

DROP FUNCTION IF EXISTS public.trigger_review_embedding();
DROP FUNCTION IF EXISTS public.trigger_profile_embedding();
DROP FUNCTION IF EXISTS public.trigger_memory_embedding();
DROP FUNCTION IF EXISTS public.trigger_relationship_embedding();
DROP FUNCTION IF EXISTS public.generate_embedding_async(TEXT, TEXT);

-- Create embedding trigger log table
CREATE TABLE IF NOT EXISTS public.embedding_trigger_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  content_length INTEGER,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_embedding_log_table_record 
  ON public.embedding_trigger_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_embedding_log_table_created 
  ON public.embedding_trigger_log (table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_log_created_at 
  ON public.embedding_trigger_log (created_at DESC);

-- Helper function to call edge function asynchronously
CREATE OR REPLACE FUNCTION public.generate_embedding_async(
  content_text TEXT,
  content_type TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  anon_key TEXT;
  edge_function_url TEXT;
BEGIN
  -- Get anon key from database settings (NO FALLBACK - must be configured)
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  IF anon_key IS NULL OR anon_key = '' THEN
    RAISE EXCEPTION 'Supabase anon key not configured. Please run: ALTER DATABASE postgres SET app.settings.supabase_anon_key = ''YOUR_KEY'';';
  END IF;
  
  -- Skip if content is empty
  IF content_text IS NULL OR trim(content_text) = '' THEN
    RETURN;
  END IF;
  
  -- Build edge function URL
  edge_function_url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/generate-embeddings';
  
  -- Make async HTTP call to edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || anon_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'texts', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'content', content_text,
          'type', content_type
        )
      )
    )
  );
END;
$$;

-- Trigger function for reviews table
CREATE OR REPLACE FUNCTION public.trigger_review_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
BEGIN
  -- Rate limiting: Skip if embedding was updated in last 5 minutes
  IF NEW.embedding_updated_at IS NOT NULL AND 
     NEW.embedding_updated_at > (now() - interval '5 minutes') THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('reviews', NEW.id, 'review', TRUE, 'Rate limited (5 min cooldown)');
    RETURN NEW;
  END IF;
  
  -- Build content from review fields
  content := COALESCE(NEW.title, '') || ' ' || 
             COALESCE(NEW.description, '') || ' ' || 
             COALESCE(NEW.body, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if content changed
    IF COALESCE(OLD.title, '') IS DISTINCT FROM COALESCE(NEW.title, '') OR
       COALESCE(OLD.description, '') IS DISTINCT FROM COALESCE(NEW.description, '') OR
       COALESCE(OLD.body, '') IS DISTINCT FROM COALESCE(NEW.body, '') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('reviews', NEW.id, 'review', length(content), FALSE);
    
    -- Call edge function asynchronously
    PERFORM public.generate_embedding_async(content, 'review');
  ELSE
    -- Log skip reason
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('reviews', NEW.id, 'review', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for profiles table
CREATE OR REPLACE FUNCTION public.trigger_profile_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
BEGIN
  -- Rate limiting: Skip if embedding was updated in last 5 minutes
  IF NEW.embedding_updated_at IS NOT NULL AND 
     NEW.embedding_updated_at > (now() - interval '5 minutes') THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('profiles', NEW.id, 'profile', TRUE, 'Rate limited (5 min cooldown)');
    RETURN NEW;
  END IF;
  
  -- Build content from profile fields
  content := COALESCE(NEW.username, '') || ' ' || 
             COALESCE(NEW.first_name, '') || ' ' || 
             COALESCE(NEW.last_name, '') || ' ' || 
             COALESCE(NEW.bio, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if content changed
    IF COALESCE(OLD.username, '') IS DISTINCT FROM COALESCE(NEW.username, '') OR
       COALESCE(OLD.first_name, '') IS DISTINCT FROM COALESCE(NEW.first_name, '') OR
       COALESCE(OLD.last_name, '') IS DISTINCT FROM COALESCE(NEW.last_name, '') OR
       COALESCE(OLD.bio, '') IS DISTINCT FROM COALESCE(NEW.bio, '') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('profiles', NEW.id, 'profile', length(content), FALSE);
    
    -- Call edge function asynchronously
    PERFORM public.generate_embedding_async(content, 'profile');
  ELSE
    -- Log skip reason
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('profiles', NEW.id, 'profile', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for user_conversation_memory table
CREATE OR REPLACE FUNCTION public.trigger_memory_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
  context_text TEXT;
BEGIN
  -- Rate limiting: Skip if embedding was updated in last 5 minutes
  IF NEW.embedding_updated_at IS NOT NULL AND 
     NEW.embedding_updated_at > (now() - interval '5 minutes') THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('user_conversation_memory', NEW.id, 'memory', TRUE, 'Rate limited (5 min cooldown)');
    RETURN NEW;
  END IF;
  
  -- Helper to extract text from jsonb array
  CREATE OR REPLACE FUNCTION jsonb_array_to_text(arr jsonb) RETURNS TEXT AS $inner$
  DECLARE
    result TEXT := '';
    element jsonb;
  BEGIN
    FOR element IN SELECT * FROM jsonb_array_elements(arr)
    LOOP
      result := result || ' ' || (element::text);
    END LOOP;
    RETURN trim(result);
  END;
  $inner$ LANGUAGE plpgsql;
  
  -- Build content from memory fields
  context_text := CASE 
    WHEN NEW.context IS NOT NULL THEN jsonb_array_to_text(NEW.context)
    ELSE ''
  END;
  
  content := COALESCE(NEW.memory_text, '') || ' ' || context_text;
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if content changed
    IF COALESCE(OLD.memory_text, '') IS DISTINCT FROM COALESCE(NEW.memory_text, '') OR
       COALESCE(OLD.context::text, '[]') IS DISTINCT FROM COALESCE(NEW.context::text, '[]') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('user_conversation_memory', NEW.id, 'memory', length(content), FALSE);
    
    -- Call edge function asynchronously
    PERFORM public.generate_embedding_async(content, 'memory');
  ELSE
    -- Log skip reason
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('user_conversation_memory', NEW.id, 'memory', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for product_relationships table (WITH COLUMN NAME FIX)
CREATE OR REPLACE FUNCTION public.trigger_relationship_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
  entity1_name TEXT;
  entity2_name TEXT;
BEGIN
  -- Rate limiting: Skip if embedding was updated in last 5 minutes
  IF NEW.embedding_updated_at IS NOT NULL AND 
     NEW.embedding_updated_at > (now() - interval '5 minutes') THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('product_relationships', NEW.id, 'relationship', TRUE, 'Rate limited (5 min cooldown)');
    RETURN NEW;
  END IF;
  
  -- Get entity names for better context (FIXED: using entity_a_id and entity_b_id)
  SELECT name INTO entity1_name FROM public.entities WHERE id = NEW.entity_a_id;
  SELECT name INTO entity2_name FROM public.entities WHERE id = NEW.entity_b_id;
  
  -- Build content from relationship fields
  content := COALESCE(entity1_name, 'Entity A') || ' ' || 
             COALESCE(NEW.relationship_type, 'related to') || ' ' || 
             COALESCE(entity2_name, 'Entity B') || ' ' || 
             COALESCE(NEW.evidence_text, '') || ' ' || 
             COALESCE(NEW.metadata::text, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if content changed (FIXED: using entity_a_id and entity_b_id)
    IF OLD.entity_a_id IS DISTINCT FROM NEW.entity_a_id OR
       OLD.entity_b_id IS DISTINCT FROM NEW.entity_b_id OR
       COALESCE(OLD.relationship_type, '') IS DISTINCT FROM COALESCE(NEW.relationship_type, '') OR
       COALESCE(OLD.evidence_text, '') IS DISTINCT FROM COALESCE(NEW.evidence_text, '') OR
       COALESCE(OLD.metadata::text, '{}') IS DISTINCT FROM COALESCE(NEW.metadata::text, '{}') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('product_relationships', NEW.id, 'relationship', length(content), FALSE);
    
    -- Call edge function asynchronously
    PERFORM public.generate_embedding_async(content, 'relationship');
  ELSE
    -- Log skip reason
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('product_relationships', NEW.id, 'relationship', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for all four tables
CREATE TRIGGER trigger_review_embedding_after
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_review_embedding();

CREATE TRIGGER trigger_profile_embedding_after
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_profile_embedding();

CREATE TRIGGER trigger_memory_embedding_after
  AFTER INSERT OR UPDATE ON public.user_conversation_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_memory_embedding();

CREATE TRIGGER trigger_relationship_embedding_after
  AFTER INSERT OR UPDATE ON public.product_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_relationship_embedding();