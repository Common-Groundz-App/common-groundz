
-- ============================================================
-- Phase 2: RBAC + Break-Glass + Last-Admin Guard
-- ============================================================

-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helper (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. RLS policies on user_roles
CREATE POLICY "Admins can read user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin settings table (K-V store for break-glass config)
CREATE TABLE public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin_settings"
  ON public.admin_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin_settings"
  ON public.admin_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert admin_settings"
  ON public.admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No one can delete admin_settings"
  ON public.admin_settings FOR DELETE
  TO authenticated
  USING (false);

-- 6. Seed break-glass config
INSERT INTO public.admin_settings (key, value)
VALUES ('break_glass', jsonb_build_object(
  'enabled', true,
  'created_at', now()::text,
  'expiry_days', 90
));

-- 7. Updated is_admin_user with RBAC + break-glass fallback
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _has_admin BOOLEAN;
  _admin_count INT;
  _bg_settings JSONB;
  _bg_enabled BOOLEAN;
  _bg_created_at TIMESTAMPTZ;
  _bg_expiry_days INT;
BEGIN
  -- Look up the user
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = user_email;

  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check user_roles for admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO _has_admin;

  IF _has_admin THEN
    RETURN TRUE;
  END IF;

  -- Break-glass fallback: only if zero admins exist
  SELECT COUNT(*) INTO _admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF _admin_count > 0 THEN
    RETURN FALSE;
  END IF;

  -- Check break-glass settings
  SELECT value INTO _bg_settings
  FROM public.admin_settings
  WHERE key = 'break_glass';

  IF _bg_settings IS NULL THEN
    RETURN FALSE;
  END IF;

  _bg_enabled := COALESCE((_bg_settings->>'enabled')::BOOLEAN, FALSE);
  IF NOT _bg_enabled THEN
    RETURN FALSE;
  END IF;

  _bg_created_at := COALESCE(
    (_bg_settings->>'created_at')::TIMESTAMPTZ,
    now()
  );
  _bg_expiry_days := COALESCE((_bg_settings->>'expiry_days')::INT, 90);

  -- Check if within the fallback window
  IF now() > (_bg_created_at + (_bg_expiry_days || ' days')::INTERVAL) THEN
    RETURN FALSE;
  END IF;

  -- Allow @lovable.dev emails as fallback
  RETURN user_email LIKE '%@lovable.dev';
END;
$$;

-- 8. Last-admin guard trigger
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining INT;
BEGIN
  -- For DELETE: check if removing this row leaves zero admins
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT COUNT(*) INTO _remaining
    FROM public.user_roles
    WHERE role = 'admin' AND id != OLD.id;

    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;

  -- For UPDATE: check if changing away from admin leaves zero admins
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
    SELECT COUNT(*) INTO _remaining
    FROM public.user_roles
    WHERE role = 'admin' AND id != OLD.id;

    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_last_admin_removal
BEFORE DELETE OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_removal();

-- 9. Seed current admin user
INSERT INTO public.user_roles (user_id, role)
VALUES ('c8508bd3-35a9-4cce-a7c8-0b5fc2bca965', 'admin')
ON CONFLICT DO NOTHING;
