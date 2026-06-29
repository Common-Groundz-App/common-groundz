
-- Phase 3.3B v7.4: created_by protection + invalid-transition guard + true no-op + grants

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
       NEW.approval_status   IS DISTINCT FROM OLD.approval_status
    OR NEW.approved_by       IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at       IS DISTINCT FROM OLD.approved_at
    OR NEW.rejected_by       IS DISTINCT FROM OLD.rejected_by
    OR NEW.rejected_at       IS DISTINCT FROM OLD.rejected_at
    OR NEW.rejection_reason  IS DISTINCT FROM OLD.rejection_reason
    OR NEW.created_by        IS DISTINCT FROM OLD.created_by;

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
    IF actor_uuid IS NOT NULL AND public.has_role(actor_uuid, 'admin'::public.app_role) THEN
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

CREATE OR REPLACE FUNCTION public.admin_moderate_entity(
  _entity_id       uuid,
  _action          text,
  _actor_id        uuid,
  _reason          text DEFAULT NULL,
  _expected_status text DEFAULT NULL
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
    RAISE EXCEPTION 'invalid_action: must be approve|reject' USING ERRCODE = '22023';
  END IF;

  IF _action = 'reject' AND (_reason IS NULL OR length(btrim(_reason)) = 0) THEN
    RAISE EXCEPTION 'reason_required: rejection reason is required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: actor is not an admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_row FROM public.entities WHERE id = _entity_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: entity %', _entity_id USING ERRCODE = 'P0002';
  END IF;

  IF _expected_status IS NOT NULL AND current_row.approval_status <> _expected_status THEN
    RAISE EXCEPTION 'conflict: expected status % but found %', _expected_status, current_row.approval_status
      USING ERRCODE = '40001';
  END IF;

  -- Block re-approve / un-reject (out of scope for 3.3B)
  IF current_row.approval_status = 'rejected' AND _action = 'approve' THEN
    RAISE EXCEPTION 'invalid_transition: re-approve/un-reject is out of scope for 3.3B'
      USING ERRCODE = '22023';
  END IF;

  -- True no-op short-circuit: do not touch metadata, do not write audit row
  IF _action = 'approve' AND current_row.approval_status = 'approved' THEN
    RETURN current_row;
  END IF;
  IF _action = 'reject' AND current_row.approval_status = 'rejected' THEN
    RETURN current_row;
  END IF;

  PERFORM set_config('app.bypass_approval',     'admin_verified', true);
  PERFORM set_config('app.moderation_actor_id', _actor_id::text,  true);

  IF _action = 'approve' THEN
    UPDATE public.entities
       SET approval_status   = 'approved',
           approved_by       = _actor_id,
           approved_at       = now(),
           rejected_by       = NULL,
           rejected_at       = NULL,
           rejection_reason  = NULL
     WHERE id = _entity_id
     RETURNING * INTO updated_row;
  ELSE
    UPDATE public.entities
       SET approval_status   = 'rejected',
           rejected_by       = _actor_id,
           rejected_at       = now(),
           rejection_reason  = _reason,
           approved_by       = NULL,
           approved_at       = NULL
     WHERE id = _entity_id
     RETURNING * INTO updated_row;
  END IF;

  PERFORM set_config('app.bypass_approval',     '', true);
  PERFORM set_config('app.moderation_actor_id', '', true);

  INSERT INTO public.admin_actions (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    _actor_id,
    'entity_' || _action,
    'entity',
    _entity_id,
    jsonb_build_object(
      'previous_status', current_row.approval_status,
      'new_status',      updated_row.approval_status,
      'reason',          _reason
    )
  );

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text)
  TO service_role;
