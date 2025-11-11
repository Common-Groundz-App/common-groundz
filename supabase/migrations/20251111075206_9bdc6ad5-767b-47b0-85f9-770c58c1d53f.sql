-- Fix the ACTUAL trigger function being used for reviews
-- Function: trigger_review_embedding() (not trigger_reviews_embedding_update)
-- Fixes: 1) Remove body field references, 2) Use correct 3-parameter async call, 3) Add timestamp update

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
  
  -- Build content from review fields (title + description ONLY, no body field)
  content := COALESCE(NEW.title, '') || ' ' || 
             COALESCE(NEW.description, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if content changed (removed body comparison)
    IF COALESCE(OLD.title, '') IS DISTINCT FROM COALESCE(NEW.title, '') OR
       COALESCE(OLD.description, '') IS DISTINCT FROM COALESCE(NEW.description, '') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('reviews', NEW.id, 'review', length(content), FALSE);
    
    -- Call edge function asynchronously with correct 3-parameter signature
    PERFORM public.generate_embedding_async(NEW.id, content, 'review');
    
    -- Update timestamp for rate limiting
    NEW.embedding_updated_at := now();
  ELSE
    -- Log skip reason
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('reviews', NEW.id, 'review', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;