CREATE OR REPLACE FUNCTION public.queue_entity_enrichment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.last_enriched_at IS NULL OR NEW.last_enriched_at < (now() - interval '7 days') THEN
    INSERT INTO public.entity_enrichment_queue (entity_id, priority, requested_by)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.api_source IS NOT NULL THEN 3
        ELSE 5 
      END,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    )
    ON CONFLICT (entity_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;