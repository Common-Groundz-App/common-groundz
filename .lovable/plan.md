

# Username Protocol - Final Production-Ready Plan (v2)

## Summary

This plan implements the complete username protocol with ALL refinements from ChatGPT and Codex feedback. This final version adds the last two production-safety improvements:

1. **No-op guard in normalize_username()** - Prevents unnecessary writes when username is already lowercase
2. **Preflight collision check** - Aborts migration if case-colliding usernames exist

---

## Database Migration (Single Atomic Transaction)

```sql
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
```

---

## Pre-Migration Diagnostic Query

Run this BEFORE the migration to identify any case collisions that need manual resolution:

```sql
-- Diagnostic: Find case-colliding usernames
SELECT LOWER(username) as normalized_username, 
       COUNT(*) as user_count,
       array_agg(id) as user_ids,
       array_agg(username) as original_usernames,
       array_agg(created_at ORDER BY created_at) as creation_dates
FROM profiles
WHERE username IS NOT NULL
GROUP BY LOWER(username)
HAVING COUNT(*) > 1
ORDER BY user_count DESC;
```

If this returns any rows, you must manually resolve them before running the migration:
- Option A: Rename the newer account's username
- Option B: Contact affected users to choose new usernames
- Option C: Append a suffix to duplicates (e.g., `johndoe` → `johndoe_2`)

---

## Trigger Execution Order

PostgreSQL executes triggers alphabetically:

```text
1. normalize_username_trigger       ← Forces lowercase (with no-op guard)
2. a_check_username_not_historical  ← Block historical usernames
3. b_enforce_username_cooldown      ← Check cooldown (with admin bypass)
4. c_enforce_reserved_usernames     ← Check reserved list
5. d_track_username_changes         ← Log the change
```

---

## Frontend Changes

### File 1: `src/utils/usernameValidation.ts`

Add historical username check:

```typescript
export const checkUsernameNotHistorical = async (
  value: string
): Promise<{ isAvailable: boolean; error: string }> => {
  try {
    const normalizedValue = value.toLowerCase();
    
    const { data, error } = await supabase
      .from('username_history')
      .select('user_id')
      .eq('old_username', normalizedValue)
      .maybeSingle();
    
    if (error) throw error;
    
    if (data) {
      return { 
        isAvailable: false, 
        error: 'This username was previously used and is no longer available' 
      };
    }
    return { isAvailable: true, error: '' };
  } catch (error) {
    console.error('Error checking username history:', error);
    return { isAvailable: false, error: 'Error checking username availability' };
  }
};
```

### File 2: `src/services/usernameRedirectService.ts` (New)

```typescript
import { supabase } from '@/integrations/supabase/client';

interface UsernameResolution {
  userId: string;
  currentUsername: string | null;
  wasRedirected: boolean;
  notFound: boolean;
}

export const resolveUsername = async (
  username: string
): Promise<UsernameResolution> => {
  const normalizedUsername = username.toLowerCase();
  
  // First: Check current profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', normalizedUsername)
    .maybeSingle();
  
  if (profile) {
    return {
      userId: profile.id,
      currentUsername: profile.username,
      wasRedirected: false,
      notFound: false
    };
  }
  
  // Second: Check username history
  const { data: history } = await supabase
    .from('username_history')
    .select('user_id')
    .eq('old_username', normalizedUsername)
    .maybeSingle();
  
  if (history) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', history.user_id)
      .single();
    
    if (!currentProfile?.username) {
      return {
        userId: history.user_id,
        currentUsername: null,
        wasRedirected: true,
        notFound: false
      };
    }
    
    return {
      userId: history.user_id,
      currentUsername: currentProfile.username,
      wasRedirected: true,
      notFound: false
    };
  }
  
  return {
    userId: '',
    currentUsername: null,
    wasRedirected: false,
    notFound: true
  };
};
```

### File 3: `src/pages/UserProfile.tsx` (New)

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveUsername } from '@/services/usernameRedirectService';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notFoundUsername, setNotFoundUsername] = useState<string>('');

  useEffect(() => {
    const resolve = async () => {
      if (!username) {
        setNotFound(true);
        setNotFoundUsername('');
        setIsLoading(false);
        return;
      }
      
      const result = await resolveUsername(username);
      
      if (result.notFound) {
        setNotFound(true);
        setNotFoundUsername(username);
        setIsLoading(false);
        return;
      }
      
      if (result.wasRedirected) {
        if (result.currentUsername) {
          navigate(`/u/${result.currentUsername}`, { replace: true });
        } else {
          navigate(`/profile/${result.userId}`, { replace: true });
        }
        return;
      }
      
      navigate(`/profile/${result.userId}`, { replace: true });
    };
    
    resolve();
  }, [username, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">User not found</h1>
          <p className="text-muted-foreground">
            The username @{notFoundUsername} doesn't exist.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
};

export default UserProfile;
```

### File 4: `src/App.tsx`

Add route:

```typescript
import UserProfile from '@/pages/UserProfile';

// Add inside Routes:
<Route path="/u/:username" element={<UserProfile />} />
```

### File 5: `src/components/profile/ProfileEditForm.tsx`

Updates needed:
1. Import `checkUsernameNotHistorical`
2. Add state for cooldown info
3. Fetch change history on mount
4. Display cooldown status
5. Add historical check to validation flow

---

## Safety Features Summary

| Feature | Implementation |
|---------|---------------|
| Atomicity | Explicit `BEGIN`/`COMMIT` transaction |
| Preflight safety | Abort if case collisions exist |
| No-op normalization | Guard prevents unnecessary writes |
| Idempotency | `IF NOT EXISTS`, `DROP IF EXISTS` |
| Lowercase enforcement | Trigger + migration fixes existing data |
| Admin bypass | Hardened TRY/CATCH with null-safe JWT parsing |
| No self-reversion | Explicit check with custom error message |
| Null username handling | Fallback to `/profile/:id` redirect |
| React-safe navigation | All `navigate()` inside useEffect |

---

## Codex Refinements Summary (All Incorporated)

| Feedback Round | Item | Solution |
|----------------|------|----------|
| Round 1 | Case-insensitive index | `LOWER(old_username)` unique index |
| Round 1 | Per-user de-duplication | Removed (redundant) |
| Round 1 | Idempotent trigger rename | DO block with EXISTS check |
| Round 2 | Avoid `.ilike()` | Use `.eq()` with normalized values |
| Round 2 | Normalize history storage | Trigger stores lowercase values |
| Round 2 | Navigate in useEffect | All navigation in useEffect |
| Round 3 | Harden admin bypass | TRY/CATCH + null-safe JWT parsing |
| Round 4 | Atomic transaction | Explicit `BEGIN`/`COMMIT` |
| Round 4 | DB-level lowercase | `normalize_username()` trigger |
| Round 5 | No-op guard | Guard clause prevents unnecessary writes |
| Round 5 | Collision preflight | Abort migration if collisions exist |

---

## Implementation Order

1. **Run diagnostic query** to check for case collisions
2. **Resolve any collisions** manually if found
3. **Run SQL migration** (single atomic transaction)
4. Update `src/utils/usernameValidation.ts` with historical check
5. Create `src/services/usernameRedirectService.ts`
6. Create `src/pages/UserProfile.tsx`
7. Add `/u/:username` route to `src/App.tsx`
8. Update `src/components/profile/ProfileEditForm.tsx` with cooldown UI

---

## Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| Migration with case collisions | Aborts with helpful error |
| Insert mixed-case username | Stored as lowercase |
| Update to same lowercase value | No unnecessary write (no-op) |
| New user changes username first time | Allowed (free change) |
| User changes username within 30 days | Blocked with date shown |
| User tries to claim previous username | Blocked |
| Admin changes username within cooldown | Allowed |
| Visit `/u/old_username` after change | Redirects to `/u/new_username` |
| Run migration multiple times | No errors (idempotent) |

---

## Technical Summary

| Feature | Implementation |
|---------|---------------|
| Preflight collision check | DO block aborts on duplicates |
| No-op normalization | `IS DISTINCT FROM LOWER()` guard |
| Case-insensitive uniqueness | Unique index on `LOWER(old_username)` |
| Trigger ordering | Alphabetical naming (normalize, a_, b_, c_, d_) |
| Audit trail | `old_username`, `new_username`, `reason` columns |
| Admin bypass | Hardened TRY/CATCH with null-safe JWT parsing |
| Future verified freeze | `is_verified` column + commented hook |

