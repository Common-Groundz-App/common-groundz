BEGIN;

-- Fix linter: set immutable search_path on newly created functions
ALTER FUNCTION public.check_reserved_username() SET search_path = public;
ALTER FUNCTION public.track_username_change() SET search_path = public;

COMMIT;