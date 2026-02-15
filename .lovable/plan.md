

# Fix Entity Enrichment Trigger — Final Plan

## Root Cause

The `queue_entity_enrichment()` trigger inserts into `entity_enrichment_queue` without explicitly setting `requested_by`. That column defaults to `auth.uid()`, which is NULL under service_role context, violating the NOT NULL constraint and rolling back the entire entity update (image refresh, metadata fix).

## Fix: One Database Migration

Modify the trigger function to explicitly provide `requested_by` using COALESCE with an explicit UUID cast:

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

## What Changes

- The trigger now explicitly sets `requested_by` instead of relying on column default
- Service-role operations get the nil UUID (consistent with Migration 4 backfill pattern)
- User-triggered operations still record the real `auth.uid()`
- The `::uuid` cast ensures no type ambiguity

## What Does NOT Change

- No frontend code changes
- No edge function changes
- No RLS policy changes
- The NOT NULL constraint stays in place
- No UI changes

## Post-Fix Verification

1. Go to Admin, click image refresh on "Nagarjuna Chimney" -- should succeed
2. Go to Edit Entity, Advanced tab, click "Fix Metadata" -- should succeed
3. Check Supabase Postgres logs for zero NOT NULL violations
