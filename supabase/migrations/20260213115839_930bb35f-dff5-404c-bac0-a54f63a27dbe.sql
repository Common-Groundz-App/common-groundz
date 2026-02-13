
-- Migration 4: Harden entity_enrichment_queue
-- Safe 3-step approach for 271 existing rows

-- Step 1: Add nullable column
ALTER TABLE public.entity_enrichment_queue ADD COLUMN requested_by uuid;

-- Step 2: Backfill existing rows with RFC 4122 nil UUID (pre-RLS system rows)
UPDATE public.entity_enrichment_queue
  SET requested_by = '00000000-0000-0000-0000-000000000000'
  WHERE requested_by IS NULL;

-- Step 3: Add NOT NULL constraint + default for future rows
ALTER TABLE public.entity_enrichment_queue
  ALTER COLUMN requested_by SET NOT NULL,
  ALTER COLUMN requested_by SET DEFAULT auth.uid();

-- Enable RLS
ALTER TABLE public.entity_enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_enrichment_queue FORCE ROW LEVEL SECURITY;

-- Drop all 4 existing permissive policies
DROP POLICY IF EXISTS "Users can insert enrichment requests" ON public.entity_enrichment_queue;
DROP POLICY IF EXISTS "Users can view enrichment queue" ON public.entity_enrichment_queue;
DROP POLICY IF EXISTS "Users can update enrichment queue" ON public.entity_enrichment_queue;
DROP POLICY IF EXISTS "Users can delete enrichment requests" ON public.entity_enrichment_queue;

-- New INSERT policy: only authenticated users can insert their own requests
CREATE POLICY "Authenticated users can insert enrichment requests"
  ON public.entity_enrichment_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid() AND auth.uid() IS NOT NULL);

-- No SELECT/UPDATE/DELETE policies for anon or authenticated
-- Edge functions use service_role which bypasses RLS
