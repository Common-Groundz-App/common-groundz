CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS entities_name_trgm
  ON public.entities USING gin (lower(name) gin_trgm_ops)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS entities_lower_name_type
  ON public.entities (lower(name), type)
  WHERE is_deleted = false;

-- Preflight verified: zero existing pair/method groups in duplicate_entities.
CREATE UNIQUE INDEX IF NOT EXISTS duplicate_entities_pair_method_uniq
  ON public.duplicate_entities (entity_a_id, entity_b_id, detection_method);