-- Drop the old 2-parameter version of generate_embedding_async
-- This ensures only the correct 3-parameter version is used
DROP FUNCTION IF EXISTS public.generate_embedding_async(TEXT, TEXT);

-- Verify the 3-parameter version exists (it should from migration 20251110103806)
-- This function correctly includes the record_id parameter
-- CREATE OR REPLACE FUNCTION public.generate_embedding_async(record_id UUID, content TEXT, content_type TEXT) ...
-- (Already exists, no need to recreate)