-- Enforce 1-hour edit window for posts at the database level.
-- Mirrors src/utils/postEditPolicy.ts EDIT_WINDOW_MS = 3600000 ms.
-- Admins (per public.has_role) bypass the window.
--
-- Also: stamp last_edited_at automatically when meaningful user-facing
-- fields change, so background jobs touching denormalized counters never
-- produce a false "edited" indicator.

CREATE OR REPLACE FUNCTION public.enforce_post_edit_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_meaningful_change boolean;
BEGIN
  -- Only act on real updates
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Detect change to user-facing fields. Anything else (denormalized
  -- counters, trending, etc.) must NOT bump last_edited_at.
  v_meaningful_change :=
    NEW.title       IS DISTINCT FROM OLD.title
    OR NEW.content    IS DISTINCT FROM OLD.content
    OR NEW.post_type  IS DISTINCT FROM OLD.post_type
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
    OR NEW.media      IS DISTINCT FROM OLD.media;

  IF v_meaningful_change THEN
    -- Admin bypass for moderation
    v_is_admin := COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false);

    IF NOT v_is_admin THEN
      -- Ownership: only the author may edit content fields
      IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
        RAISE EXCEPTION 'Not authorized to edit this post'
          USING ERRCODE = '42501';
      END IF;

      -- Time window: 1 hour from creation
      IF (now() - OLD.created_at) > interval '1 hour' THEN
        RAISE EXCEPTION 'Edit window closed: posts can only be edited within 1 hour of posting'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    -- Server stamps the marker — clients never supply it
    NEW.last_edited_at := now();
  ELSE
    -- Background / denormalization update: preserve existing marker
    NEW.last_edited_at := OLD.last_edited_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_edit_window_trigger ON public.posts;

CREATE TRIGGER enforce_post_edit_window_trigger
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_post_edit_window();