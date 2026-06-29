
-- =========================================================================
-- Phase 3.3B v7.2 — Moderation rails for entities
-- =========================================================================

-- -----------------------------------------------------------------------
-- 1) PREFLIGHT: abort if approval_status has unexpected values
-- -----------------------------------------------------------------------
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM public.entities
  WHERE approval_status IS NOT NULL
    AND approval_status NOT IN ('approved','pending','rejected');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % entities have unexpected approval_status values', bad_count;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 2) PREFLIGHT: abort if any unexpected permissive SELECT/ALL policy on entities
-- -----------------------------------------------------------------------
DO $$
DECLARE
  unexpected_policy text;
BEGIN
  SELECT polname INTO unexpected_policy
  FROM pg_policy
  WHERE polrelid = 'public.entities'::regclass
    AND polpermissive = true
    AND polcmd IN ('r','*')           -- SELECT or ALL
    AND polname NOT IN (
      'Admins can manage all entities',
      'Admins can view deleted entities',
      'Anyone can view non-deleted entities'
    )
  LIMIT 1;
  IF unexpected_policy IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight failed: unexpected SELECT/ALL policy on entities: %', unexpected_policy;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 3) Add moderation columns
-- -----------------------------------------------------------------------
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS approved_by       uuid,
  ADD COLUMN IF NOT EXISTS approved_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by       uuid,
  ADD COLUMN IF NOT EXISTS rejected_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason  text;

-- -----------------------------------------------------------------------
-- 4) Backfill ONLY NULL approval_status rows
-- -----------------------------------------------------------------------
UPDATE public.entities
   SET approval_status = 'approved'
 WHERE approval_status IS NULL;

-- -----------------------------------------------------------------------
-- 5) Lock down approval_status: default 'pending', NOT NULL, CHECK
-- -----------------------------------------------------------------------
ALTER TABLE public.entities ALTER COLUMN approval_status SET DEFAULT 'pending';
ALTER TABLE public.entities ALTER COLUMN approval_status SET NOT NULL;

-- Drop + recreate CHECK to guarantee exact definition
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_approval_status_check;
ALTER TABLE public.entities
  ADD CONSTRAINT entities_approval_status_check
  CHECK (approval_status IN ('approved','pending','rejected'));

-- -----------------------------------------------------------------------
-- 6) Indexes
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS entities_pending_queue_idx
  ON public.entities (created_at DESC)
  WHERE approval_status = 'pending' AND is_deleted = false;

CREATE INDEX IF NOT EXISTS entities_approval_status_idx
  ON public.entities (approval_status);

-- -----------------------------------------------------------------------
-- 7) Feature flag: non-admin entity creation (off by default)
-- -----------------------------------------------------------------------
INSERT INTO public.app_config (key, value, description)
VALUES (
  'entity_creation.non_admin_enabled',
  jsonb_build_object('enabled', false),
  'Phase 3.3B: enables non-admin users to insert into entities (lands as pending). Off by default.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_non_admin_entity_creation_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
       FROM public.app_config
      WHERE key = 'entity_creation.non_admin_enabled'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_non_admin_entity_creation_enabled() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_non_admin_entity_creation_enabled() TO authenticated, service_role;

-- -----------------------------------------------------------------------
-- 8) BEFORE INSERT trigger: enforce created_by + initial approval_status
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entities_enforce_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  -- Client sessions: force created_by to the authenticated caller (cannot be spoofed)
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- Service-role inserts MUST supply created_by explicitly
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required' USING ERRCODE = '23502';
  END IF;

  is_admin := public.has_role(NEW.created_by, 'admin'::public.app_role);

  IF is_admin THEN
    NEW.approval_status   := 'approved';
    NEW.approved_by       := NEW.created_by;
    NEW.approved_at       := now();
    NEW.rejected_by       := NULL;
    NEW.rejected_at       := NULL;
    NEW.rejection_reason  := NULL;
  ELSE
    NEW.approval_status   := 'pending';
    NEW.approved_by       := NULL;
    NEW.approved_at       := NULL;
    NEW.rejected_by       := NULL;
    NEW.rejected_at       := NULL;
    NEW.rejection_reason  := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entities_enforce_creation ON public.entities;
CREATE TRIGGER entities_enforce_creation
BEFORE INSERT ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.entities_enforce_creation();

-- -----------------------------------------------------------------------
-- 9) BEFORE UPDATE trigger: protect moderation fields
--    Bypass requires BOTH:
--      app.bypass_approval = 'admin_verified'
--      app.moderation_actor_id resolves to an admin uuid
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entities_protect_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin     boolean := false;
  bypass_ok    boolean := false;
  bypass_flag  text;
  actor_text   text;
  actor_uuid   uuid;
  fields_changed boolean;
BEGIN
  fields_changed :=
       NEW.approval_status  IS DISTINCT FROM OLD.approval_status
    OR NEW.approved_by      IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at      IS DISTINCT FROM OLD.approved_at
    OR NEW.rejected_by      IS DISTINCT FROM OLD.rejected_by
    OR NEW.rejected_at      IS DISTINCT FROM OLD.rejected_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason;

  IF NOT fields_changed THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  END IF;

  BEGIN
    bypass_flag := current_setting('app.bypass_approval',     true);
    actor_text  := current_setting('app.moderation_actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    bypass_flag := NULL; actor_text := NULL;
  END;

  IF bypass_flag = 'admin_verified'
     AND actor_text IS NOT NULL AND actor_text <> '' THEN
    BEGIN
      actor_uuid := actor_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      actor_uuid := NULL;
    END;
    IF actor_uuid IS NOT NULL
       AND public.has_role(actor_uuid, 'admin'::public.app_role) THEN
      bypass_ok := true;
    END IF;
  END IF;

  IF NOT (is_admin OR bypass_ok) THEN
    RAISE EXCEPTION 'insufficient_privilege: moderation fields are admin-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entities_protect_moderation_fields ON public.entities;
CREATE TRIGGER entities_protect_moderation_fields
BEFORE UPDATE ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.entities_protect_moderation_fields();

-- -----------------------------------------------------------------------
-- 10) admin_moderate_entity RPC (service-role only, approve|reject)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_moderate_entity(
  _entity_id        uuid,
  _action           text,
  _actor_id         uuid,
  _reason           text DEFAULT NULL,
  _expected_status  text DEFAULT NULL
)
RETURNS public.entities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.entities;
  updated_row public.entities;
BEGIN
  IF _action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid_action: %', _action USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: actor is not admin' USING ERRCODE = '42501';
  END IF;

  IF _action = 'reject' AND (_reason IS NULL OR length(btrim(_reason)) = 0) THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.entities WHERE id = _entity_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _expected_status IS NOT NULL AND current_row.approval_status <> _expected_status THEN
    RAISE EXCEPTION 'conflict: expected % but found %', _expected_status, current_row.approval_status
      USING ERRCODE = '40001';
  END IF;

  -- No-op short-circuit: don't write trigger-protected fields and don't audit
  IF (_action = 'approve' AND current_row.approval_status = 'approved')
     OR (_action = 'reject'  AND current_row.approval_status = 'rejected'
         AND current_row.rejection_reason IS NOT DISTINCT FROM _reason) THEN
    RETURN current_row;
  END IF;

  PERFORM set_config('app.bypass_approval',     'admin_verified', true);
  PERFORM set_config('app.moderation_actor_id', _actor_id::text,  true);

  IF _action = 'approve' THEN
    UPDATE public.entities
       SET approval_status  = 'approved',
           approved_by      = _actor_id,
           approved_at      = now(),
           rejected_by      = NULL,
           rejected_at      = NULL,
           rejection_reason = NULL,
           updated_at       = now()
     WHERE id = _entity_id
     RETURNING * INTO updated_row;
  ELSE
    UPDATE public.entities
       SET approval_status  = 'rejected',
           rejected_by      = _actor_id,
           rejected_at      = now(),
           rejection_reason = _reason,
           updated_at       = now()
     WHERE id = _entity_id
     RETURNING * INTO updated_row;
  END IF;

  PERFORM set_config('app.bypass_approval',     '', true);
  PERFORM set_config('app.moderation_actor_id', '', true);

  INSERT INTO public.admin_actions (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    _actor_id,
    CASE WHEN _action = 'approve' THEN 'entity_approve' ELSE 'entity_reject' END,
    'entity',
    _entity_id,
    jsonb_build_object(
      'from_status', current_row.approval_status,
      'to_status',   updated_row.approval_status,
      'reason',      _reason
    )
  );

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text) TO service_role;

-- -----------------------------------------------------------------------
-- 11) admin_pending_entity_count RPC (admin nav badge)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pending_entity_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::int INTO n
    FROM public.entities
   WHERE approval_status = 'pending' AND is_deleted = false;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pending_entity_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_pending_entity_count() TO authenticated, service_role;

-- -----------------------------------------------------------------------
-- 12) check_entity_creation_quota (prepared, unused; self-or-admin only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_entity_creation_quota(
  _user_id       uuid,
  _max_pending   integer DEFAULT 10,
  _window_hours  integer DEFAULT 24
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() <> _user_id
         AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO n
    FROM public.entities
   WHERE created_by = _user_id
     AND approval_status = 'pending'
     AND created_at > now() - (_window_hours || ' hours')::interval;

  RETURN n < _max_pending;
END;
$$;

REVOKE ALL ON FUNCTION public.check_entity_creation_quota(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_entity_creation_quota(uuid, integer, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------
-- 13) RLS swap: hide rejected rows from public; gate non-admin INSERT
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view non-deleted entities" ON public.entities;
CREATE POLICY "Public can view approved or pending entities"
ON public.entities
FOR SELECT
USING (
  is_deleted = false
  AND (
    approval_status IN ('approved','pending')
    OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can create entities" ON public.entities;
CREATE POLICY "Authenticated can create entities (gated)"
ON public.entities
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_non_admin_entity_creation_enabled()
  )
);
