-- Drop the mismatched trigger and function that references non-existent columns
DROP TRIGGER IF EXISTS trigger_memory_embedding_after ON public.user_conversation_memory;
DROP FUNCTION IF EXISTS public.trigger_memory_embedding();

-- Create a new trigger function that matches the actual schema
CREATE OR REPLACE FUNCTION public.trigger_memory_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
BEGIN
  -- Build content from actual field: memory_summary
  content := COALESCE(NEW.memory_summary, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only generate if memory_summary changed
    IF COALESCE(OLD.memory_summary, '') IS DISTINCT FROM COALESCE(NEW.memory_summary, '') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    -- Log the trigger event
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('user_conversation_memory', NEW.id, 'memory', length(content), FALSE)
    ON CONFLICT DO NOTHING;
    
    -- Note: Edge function call would go here if needed
    -- For now, we'll just log and let the embedding generation happen via edge function
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_memory_embedding_after
AFTER INSERT OR UPDATE ON public.user_conversation_memory
FOR EACH ROW
EXECUTE FUNCTION public.trigger_memory_embedding();