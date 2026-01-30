

# Username System - Final Implementation Plan (with Transaction Wrapper)

## Overview

This plan implements a production-grade username system with multi-layer enforcement, automated change tracking, and reserved username protection. All SQL operations are idempotent, NULL-safe, and wrapped in an explicit transaction for atomicity.

---

## Database Migration (Single Atomic Transaction)

```sql
BEGIN;

-- =============================================
-- PHASE 1: Migrate Legacy Users (Defensive)
-- =============================================
UPDATE profiles 
SET username = 'rishab_sr', updated_at = NOW()
WHERE id = 'd4cef1d1-40f7-4b05-9462-32f0361877e6'
  AND username IS DISTINCT FROM 'rishab_sr';

UPDATE profiles 
SET username = 'linda_williams', updated_at = NOW()
WHERE id = 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3'
  AND username IS DISTINCT FROM 'linda_williams';

-- =============================================
-- PHASE 2: Add Tracking Column
-- =============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

-- =============================================
-- PHASE 3: Replace Unique Index
-- =============================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS profiles_username_unique_lower;

CREATE UNIQUE INDEX profiles_username_unique_lower 
ON profiles (LOWER(username)) 
WHERE username IS NOT NULL;

-- =============================================
-- PHASE 4: Add Format CHECK Constraint
-- =============================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS username_format_check;

ALTER TABLE profiles 
ADD CONSTRAINT username_format_check 
CHECK (
  username IS NULL OR 
  (
    username ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' AND
    username !~ '[._]{2}'
  ) OR
  (length(username) = 3 AND username ~ '^[a-z0-9]{3}$')
);

-- =============================================
-- PHASE 5: Create Reserved Usernames Table
-- =============================================
CREATE TABLE IF NOT EXISTS reserved_usernames (
  username TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reserved_username_lowercase'
  ) THEN
    ALTER TABLE reserved_usernames
    ADD CONSTRAINT reserved_username_lowercase
    CHECK (username = LOWER(username));
  END IF;
END $$;

INSERT INTO reserved_usernames (username, reason) VALUES
  ('admin', 'system'),
  ('administrator', 'system'),
  ('support', 'system'),
  ('help', 'system'),
  ('api', 'system'),
  ('system', 'system'),
  ('root', 'system'),
  ('mod', 'system'),
  ('moderator', 'system'),
  ('staff', 'system'),
  ('commongroundz', 'brand'),
  ('official', 'brand'),
  ('verified', 'brand'),
  ('null', 'system'),
  ('undefined', 'system'),
  ('rishab_sr', 'migrated'),
  ('linda_williams', 'migrated')
ON CONFLICT (username) DO NOTHING;

ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reserved usernames are publicly readable" ON reserved_usernames;
DROP POLICY IF EXISTS "No public inserts on reserved_usernames" ON reserved_usernames;
DROP POLICY IF EXISTS "No public updates on reserved_usernames" ON reserved_usernames;
DROP POLICY IF EXISTS "No public deletes on reserved_usernames" ON reserved_usernames;

CREATE POLICY "Reserved usernames are publicly readable"
ON reserved_usernames FOR SELECT USING (true);

CREATE POLICY "No public inserts on reserved_usernames"
ON reserved_usernames FOR INSERT WITH CHECK (false);

CREATE POLICY "No public updates on reserved_usernames"
ON reserved_usernames FOR UPDATE USING (false);

CREATE POLICY "No public deletes on reserved_usernames"
ON reserved_usernames FOR DELETE USING (false);

-- =============================================
-- PHASE 6: Create Reserved Username Trigger (NULL-safe)
-- =============================================
CREATE OR REPLACE FUNCTION check_reserved_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL AND EXISTS (
    SELECT 1 FROM reserved_usernames 
    WHERE username = LOWER(NEW.username)
  ) THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_reserved_usernames ON profiles;

CREATE TRIGGER enforce_reserved_usernames
BEFORE INSERT OR UPDATE OF username ON profiles
FOR EACH ROW
WHEN (NEW.username IS NOT NULL)
EXECUTE FUNCTION check_reserved_username();

-- =============================================
-- PHASE 7: Create Username Change Tracking Trigger
-- =============================================
CREATE OR REPLACE FUNCTION track_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    NEW.username_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_username_changes ON profiles;

CREATE TRIGGER track_username_changes
BEFORE UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION track_username_change();

COMMIT;
```

---

## Frontend Changes

### File 1: src/utils/usernameValidation.ts

Full replacement with enhanced validation including reserved username check:

- Add `RESERVED_USERNAMES` constant for immediate frontend feedback
- Add leading/trailing special character check
- Add consecutive special character check

### File 2: src/components/auth/UsernameField.tsx

- Import `useDebouncedCallback` from `use-debounce`
- Debounce uniqueness check with 400ms delay
- Update helper text: "3-20 characters. Letters, numbers, dots, and underscores only. Cannot start or end with dots/underscores."

### File 3: src/components/profile/ProfileEditForm.tsx

- Import `useDebouncedCallback` and `AtSign` icon
- Add debounced uniqueness check (400ms delay)
- Add `@` icon prefix for visual consistency
- Add helper text showing validation rules
- Remove manual `username_changed_at` update (now handled by database trigger)

---

## Safety Features Summary

| Feature | Implementation |
|---------|---------------|
| Atomicity | Explicit `BEGIN`/`COMMIT` transaction wrapper |
| Idempotency | `IF NOT EXISTS`, `DROP IF EXISTS`, `ON CONFLICT DO NOTHING` |
| NULL-safety | Guard in both trigger `WHEN` clause AND function body |
| Defensive updates | `WHERE username IS DISTINCT FROM 'target'` |
| Re-runnable | Can safely run migration multiple times |

---

## Implementation Order

1. Run SQL migration (atomic transaction)
2. Update `src/utils/usernameValidation.ts`
3. Update `src/components/auth/UsernameField.tsx`
4. Update `src/components/profile/ProfileEditForm.tsx`
5. Test signup with valid/invalid/reserved usernames
6. Test profile edit with username change tracking

