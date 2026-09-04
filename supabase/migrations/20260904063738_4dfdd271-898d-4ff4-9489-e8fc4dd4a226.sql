-- Stage 1 follow-up: close the TRUNCATE bypass of the RPC-only mutation boundary.
-- TRUNCATE removes every row and is not subject to RLS, so leaving it granted would
-- defeat the "no direct deletion path" invariant established above.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.review_updates FROM PUBLIC;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.review_updates FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.review_updates FROM authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.review_updates FROM service_role;

-- anon has no INSERT policy and never appends timeline updates; drop the privilege.
REVOKE INSERT ON public.review_updates FROM PUBLIC;
REVOKE INSERT ON public.review_updates FROM anon;