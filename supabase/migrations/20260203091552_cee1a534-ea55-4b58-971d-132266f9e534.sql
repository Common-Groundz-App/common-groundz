-- Phase 4: Rate limiting for auth endpoints
CREATE TABLE public.auth_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,           -- IP address
    action text NOT NULL,               -- 'login', 'signup', 'password_reset', 'resend_verification'
    attempt_count int DEFAULT 1,
    window_start timestamptz DEFAULT now(),
    blocked_until timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE (identifier, action)
);

-- RLS enabled but service role can access
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Fast lookup index
CREATE INDEX idx_auth_rate_limits_lookup 
ON public.auth_rate_limits (identifier, action, window_start);

-- Cleanup function for old records (can be scheduled)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM public.auth_rate_limits 
  WHERE window_start < now() - interval '1 hour';
$$;

COMMENT ON TABLE public.auth_rate_limits IS 
'Phase 4: Tracks auth attempts for rate limiting. Cleaned up hourly.';