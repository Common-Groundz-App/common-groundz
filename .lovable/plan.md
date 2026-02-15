

# Apply the Entity Enrichment Trigger Fix

## Current State

The `queue_entity_enrichment()` trigger function still uses the old code — it inserts only `(entity_id, priority)` without setting `requested_by`. This confirms the migration was never executed.

## Action Required

Run one database migration to replace the trigger function:

```sql
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
```

## What This Changes

- Adds explicit `requested_by` column to the INSERT statement
- Uses `COALESCE(auth.uid(), '00000000-...'::uuid)` so service-role operations get the nil UUID instead of NULL
- Fixes image refresh and metadata refresh failures

## No Other Changes

No frontend, edge function, or RLS changes needed. Just this one migration.

## After Approval

1. Test image refresh on "Nagarjuna Chimney" in Admin
2. Test "Fix Metadata" in Edit Entity Advanced tab
3. Verify no more constraint errors in Postgres logs
