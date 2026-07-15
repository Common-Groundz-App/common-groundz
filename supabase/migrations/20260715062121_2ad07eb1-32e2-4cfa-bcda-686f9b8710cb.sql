-- Phase 3.5c — Funnel telemetry for search-to-draft flow.
-- Privacy: raw queries are never stored; only SHA-256 hex hashes.
-- Writes only via service_role (edge function). Reads restricted to admins via RLS.

CREATE TABLE IF NOT EXISTS public.search_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN (
    'search_run','candidate_pick','review_opened','entity_created'
  )),
  query_hash text NULL,
  entity_type text NULL,
  candidate_index int NULL,
  source text NOT NULL CHECK (source IN ('search','existing_match')),
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.search_funnel_events TO authenticated;
GRANT ALL ON public.search_funnel_events TO service_role;

ALTER TABLE public.search_funnel_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all funnel events. No user INSERT/UPDATE/DELETE policy —
-- writes go through the log-search-funnel edge function using service_role.
CREATE POLICY "Admins can read search funnel events"
  ON public.search_funnel_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_search_funnel_events_created_at
  ON public.search_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_funnel_events_event_created_at
  ON public.search_funnel_events (event, created_at DESC);
