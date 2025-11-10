-- Remove anon key dependency from generate_embedding_async function
-- This allows the function to call the public edge function without authentication

CREATE OR REPLACE FUNCTION public.generate_embedding_async(
  record_id UUID,
  content_text TEXT,
  content_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple guard against empty content
  IF content_text IS NULL OR TRIM(content_text) = '' THEN
    RETURN;
  END IF;
  
  -- Make async HTTP call to edge function (no auth needed - it's public)
  PERFORM net.http_post(
    url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/generate-embeddings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'texts', jsonb_build_array(
        jsonb_build_object(
          'id', record_id::text,
          'content', content_text,
          'type', content_type
        )
      )
    )
  );
END;
$$;