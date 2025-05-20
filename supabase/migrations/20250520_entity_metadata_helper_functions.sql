
-- This migration adds helper functions for entity metadata operations

-- Function to get entity metadata
CREATE OR REPLACE FUNCTION public.get_entity_metadata(entity_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT metadata FROM entities WHERE id = entity_id;
$$;

-- Function to set a key in a jsonb object
CREATE OR REPLACE FUNCTION public.jsonb_set_key(json_data jsonb, key_name text, new_value text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN json_data IS NULL THEN jsonb_build_object(key_name, new_value::jsonb)
    ELSE jsonb_set(json_data, ARRAY[key_name], to_jsonb(new_value::text))
  END;
$$;
