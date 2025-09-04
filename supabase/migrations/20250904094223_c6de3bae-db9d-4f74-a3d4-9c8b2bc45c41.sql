-- Create a function to notify about entity updates
CREATE OR REPLACE FUNCTION notify_entity_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform any additional logic here if needed
  -- This function helps with cache invalidation patterns
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that fires after entity updates
CREATE OR REPLACE TRIGGER entity_update_notification
  AFTER UPDATE ON public.entities
  FOR EACH ROW
  WHEN (OLD.is_claimed IS DISTINCT FROM NEW.is_claimed OR 
        OLD.name IS DISTINCT FROM NEW.name OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.website_url IS DISTINCT FROM NEW.website_url OR
        OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION notify_entity_update();