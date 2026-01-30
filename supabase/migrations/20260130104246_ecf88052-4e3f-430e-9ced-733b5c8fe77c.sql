BEGIN;

-- =============================================
-- PHASE 0: Preflight Check for Case Collisions
-- =============================================
DO $$
DECLARE
  collision_count INT;
BEGIN
  SELECT COUNT(*) INTO collision_count
  FROM (
    SELECT LOWER(username) as normalized
    FROM profiles
    WHERE username IS NOT NULL
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) collisions;
  
  IF collision_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % case-colliding username(s) detected. Run the diagnostic query and resolve manually before proceeding.', collision_count;
  END IF;
END $$;

-- =============================================
-- PHASE 1: Create Username History Table
-- =============================================
CREATE TABLE IF NOT EXISTS username_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  reason TEXT DEFAULT 'user_change',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive global uniqueness (prevents ANY re-claiming)
DROP INDEX IF EXISTS username_history_old_username_unique;
CREATE UNIQUE INDEX username_history_old_username_unique
ON username_history (LOWER(old_username));

-- Lookup index for user-specific queries
DROP INDEX IF EXISTS idx_username_history_user_id;
CREATE INDEX idx_username_history_user_id 
ON username_history (user_id);

-- RLS policies (read-only for public)
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Username history is publicly readable" ON username_history;
CREATE POLICY "Username history is publicly readable"
ON username_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "No public inserts on username_history" ON username_history;
CREATE POLICY "No public inserts on username_history"
ON username_history FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "No public updates on username_history" ON username_history;
CREATE POLICY "No public updates on username_history"
ON username_history FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No public deletes on username_history" ON username_history;
CREATE POLICY "No public deletes on username_history"
ON username_history FOR DELETE USING (false);

-- =============================================
-- PHASE 2: Enforce Lowercase Storage (with No-Op Guard)
-- =============================================
CREATE OR REPLACE FUNCTION normalize_username()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only normalize if username exists AND is not already lowercase
  -- This prevents unnecessary writes and potential trigger loops
  IF NEW.username IS NOT NULL 
     AND NEW.username IS DISTINCT FROM LOWER(NEW.username) THEN
    NEW.username := LOWER(NEW.username);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_username_trigger ON profiles;

CREATE TRIGGER normalize_username_trigger
BEFORE INSERT OR UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION normalize_username();

-- Normalize any existing mixed-case usernames
-- (Preflight check already verified no collisions exist)
UPDATE profiles 
SET username = LOWER(username)
WHERE username IS NOT NULL 
  AND username IS DISTINCT FROM LOWER(username);

-- =============================================
-- PHASE 3: Block Re-Claiming Historical Usernames
-- =============================================
CREATE OR REPLACE FUNCTION check_username_not_historical()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  history_user_id UUID;
BEGIN
  -- Skip if username isn't changing
  IF OLD.username IS NOT DISTINCT FROM NEW.username THEN
    RETURN NEW;
  END IF;
  
  -- Check against history (both are lowercase at this point)
  SELECT user_id INTO history_user_id
  FROM username_history
  WHERE old_username = NEW.username
  LIMIT 1;
  
  IF history_user_id IS NOT NULL THEN
    IF history_user_id = NEW.id THEN
      RAISE EXCEPTION 'You cannot revert to a previous username. Please choose a new one.';
    ELSE
      RAISE EXCEPTION 'This username was previously used and is no longer available.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS a_check_username_not_historical ON profiles;

CREATE TRIGGER a_check_username_not_historical
BEFORE UPDATE OF username ON profiles
FOR EACH ROW
WHEN (NEW.username IS NOT NULL)
EXECUTE FUNCTION check_username_not_historical();

-- =============================================
-- PHASE 4: Cooldown Enforcement with Hardened Admin Bypass
-- =============================================
CREATE OR REPLACE FUNCTION enforce_username_cooldown()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  change_count INT;
  last_change TIMESTAMPTZ;
  is_admin BOOLEAN := false;
  jwt_claims TEXT;
BEGIN
  -- Skip if username isn't changing
  IF OLD.username IS NOT DISTINCT FROM NEW.username THEN
    RETURN NEW;
  END IF;
  
  -- Hardened admin bypass: Safely check for service_role
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true);
    IF jwt_claims IS NOT NULL AND jwt_claims != '' THEN
      is_admin := (jwt_claims::json->>'role') = 'service_role';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    is_admin := false;
  END;
  
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- Future hook: Block verified accounts
  -- IF OLD.is_verified = true THEN
  --   RAISE EXCEPTION 'Verified accounts cannot change usernames';
  -- END IF;
  
  -- Count previous username changes
  SELECT COUNT(*) INTO change_count
  FROM username_history
  WHERE user_id = OLD.id;
  
  -- First change is free (no prior history)
  IF change_count = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Check 30-day cooldown
  last_change := COALESCE(OLD.username_changed_at, OLD.created_at);
  
  IF last_change > NOW() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Username can only be changed once every 30 days. Next change available: %', 
      (last_change + INTERVAL '30 days')::DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS b_enforce_username_cooldown ON profiles;

CREATE TRIGGER b_enforce_username_cooldown
BEFORE UPDATE OF username ON profiles
FOR EACH ROW
WHEN (OLD.username IS DISTINCT FROM NEW.username)
EXECUTE FUNCTION enforce_username_cooldown();

-- =============================================
-- PHASE 5: Idempotent Rename of Reserved Username Trigger
-- =============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'enforce_reserved_usernames'
    AND tgrelid = 'profiles'::regclass
  ) THEN
    ALTER TRIGGER enforce_reserved_usernames ON profiles 
    RENAME TO c_enforce_reserved_usernames;
  END IF;
END $$;

-- =============================================
-- PHASE 6: Track Username Changes
-- =============================================
CREATE OR REPLACE FUNCTION track_username_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  change_reason TEXT := 'user_change';
  jwt_claims TEXT;
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    -- Hardened admin detection for audit trail
    BEGIN
      jwt_claims := current_setting('request.jwt.claims', true);
      IF jwt_claims IS NOT NULL AND jwt_claims != '' THEN
        IF (jwt_claims::json->>'role') = 'service_role' THEN
          change_reason := 'admin_change';
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      change_reason := 'user_change';
    END;
    
    -- Log the change to history (already lowercase from normalize trigger)
    IF OLD.username IS NOT NULL THEN
      INSERT INTO username_history (user_id, old_username, new_username, reason)
      VALUES (OLD.id, OLD.username, NEW.username, change_reason);
    END IF;
    
    -- Update timestamp
    NEW.username_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_username_changes ON profiles;
DROP TRIGGER IF EXISTS d_track_username_changes ON profiles;

CREATE TRIGGER d_track_username_changes
BEFORE UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION track_username_change();

-- =============================================
-- PHASE 7: Add Verified Column (Future Hook)
-- =============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

COMMIT;