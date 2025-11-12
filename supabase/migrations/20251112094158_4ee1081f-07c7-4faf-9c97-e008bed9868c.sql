-- Drop the 4-parameter version of match_reviews to resolve PGRST203 function overloading ambiguity
DROP FUNCTION IF EXISTS public.match_reviews(
  vector,
  double precision,
  integer,
  uuid
);

-- Add comment to the remaining 7-parameter version for documentation
COMMENT ON FUNCTION public.match_reviews(
  vector,
  double precision,
  integer,
  uuid,
  uuid,
  text,
  numeric
) IS 'Semantic search for reviews with optional filters. Resolves PGRST203 overloading issue.';