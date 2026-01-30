

# Username System - Complete Final Implementation Plan

## Overview

This plan implements a production-grade username system with multi-layer enforcement, automated change tracking, and reserved username protection using a dedicated database table.

---

## Database Changes

### Phase 1: Migrate Legacy Users

Fix the 2 non-compliant dummy users before adding constraints:

```sql
UPDATE profiles 
SET username = 'rishab_sr', updated_at = NOW()
WHERE id = 'd4cef1d1-40f7-4b05-9462-32f0361877e6';

UPDATE profiles 
SET username = 'linda_williams', updated_at = NOW()
WHERE id = 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3';
```

### Phase 2: Add Tracking Column

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
```

### Phase 3: Replace Unique Index

```sql
-- Drop existing case-sensitive index
DROP INDEX IF EXISTS profiles_username_key;

-- Add case-insensitive unique index
CREATE UNIQUE INDEX profiles_username_unique_lower 
ON profiles (LOWER(username)) 
WHERE username IS NOT NULL;
```

### Phase 4: Add Format CHECK Constraint

```sql
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
```

### Phase 5: Create Reserved Usernames Table (with Lowercase Enforcement)

```sql
CREATE TABLE reserved_usernames (
  username TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all reserved usernames are lowercase
ALTER TABLE reserved_usernames
ADD CONSTRAINT reserved_username_lowercase
CHECK (username = LOWER(username));

-- Insert reserved usernames
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
  ('linda_williams', 'migrated');

-- Enable RLS
ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Reserved usernames are publicly readable"
ON reserved_usernames FOR SELECT
USING (true);

-- Explicitly block all writes (only superusers can modify)
CREATE POLICY "No public inserts on reserved_usernames"
ON reserved_usernames FOR INSERT
WITH CHECK (false);

CREATE POLICY "No public updates on reserved_usernames"
ON reserved_usernames FOR UPDATE
USING (false);

CREATE POLICY "No public deletes on reserved_usernames"
ON reserved_usernames FOR DELETE
USING (false);
```

### Phase 6: Create Trigger to Block Reserved Usernames

```sql
CREATE OR REPLACE FUNCTION check_reserved_username()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reserved_usernames 
    WHERE username = LOWER(NEW.username)
  ) THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_reserved_usernames
BEFORE INSERT OR UPDATE OF username ON profiles
FOR EACH ROW
WHEN (NEW.username IS NOT NULL)
EXECUTE FUNCTION check_reserved_username();
```

### Phase 7: Create Trigger to Auto-Track Username Changes

```sql
CREATE OR REPLACE FUNCTION track_username_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update timestamp if username actually changed
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    NEW.username_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_username_changes
BEFORE UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION track_username_change();
```

---

## Frontend Changes

### File 1: src/utils/usernameValidation.ts

**Changes:**
1. Add `RESERVED_USERNAMES` constant for immediate frontend feedback
2. Add leading/trailing special character check
3. Add consecutive special character check

```typescript
import { supabase } from '@/integrations/supabase/client';

// Reserved usernames for immediate frontend feedback
// (Database trigger is the source of truth)
const RESERVED_USERNAMES = [
  'admin', 'administrator', 'support', 'help', 'api', 
  'system', 'root', 'mod', 'moderator', 'staff',
  'commongroundz', 'official', 'verified', 'null', 'undefined',
  'rishab_sr', 'linda_williams'
];

export const validateUsernameFormat = (value: string): string => {
  if (!value) return 'Username is required';
  if (value !== value.toLowerCase()) return 'Username must be lowercase';
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (value.length > 20) return 'Username must be less than 20 characters';
  
  // Check for reserved usernames
  if (RESERVED_USERNAMES.includes(value.toLowerCase())) {
    return 'This username is reserved';
  }
  
  // Basic character check
  if (!/^[a-z0-9._]+$/.test(value)) {
    return 'Username can only contain lowercase letters, numbers, dots, and underscores';
  }
  
  // No leading/trailing dots or underscores
  if (/^[._]|[._]$/.test(value)) {
    return 'Username cannot start or end with a dot or underscore';
  }
  
  // No consecutive dots or underscores
  if (/[._]{2,}/.test(value)) {
    return 'Username cannot have consecutive dots or underscores';
  }
  
  return '';
};

export const checkUsernameUniqueness = async (value: string): Promise<{ isUnique: boolean; error: string }> => {
  try {
    const lowercaseValue = value.toLowerCase();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', lowercaseValue)
      .maybeSingle();
    
    if (error) throw error;
    
    if (data) {
      return { isUnique: false, error: 'Username is already taken' };
    } else {
      return { isUnique: true, error: '' };
    }
  } catch (error) {
    console.error('Error checking username:', error);
    return { isUnique: false, error: 'Error checking username availability' };
  }
};
```

### File 2: src/components/auth/UsernameField.tsx

**Changes:**
1. Import `useDebouncedCallback` from `use-debounce`
2. Debounce uniqueness check (400ms delay)
3. Update helper text to reflect new rules

### File 3: src/components/profile/ProfileEditForm.tsx

**Changes:**
1. Import `useDebouncedCallback` and `AtSign` icon
2. Add debounced uniqueness check
3. Add `@` icon prefix for visual consistency
4. Add helper text showing validation rules
5. Remove manual `username_changed_at` update (now handled by database trigger)

---

## Validation Rules Summary

| Rule | Valid | Invalid |
|------|-------|---------|
| Lowercase only | `john_doe` | `John_Doe` |
| 3-20 characters | `abc` | `ab` |
| Letters, numbers, dots, underscores | `john.doe_99` | `john@doe` |
| No leading dot/underscore | `johndoe` | `.johndoe` |
| No trailing dot/underscore | `johndoe` | `johndoe_` |
| No consecutive special chars | `john.doe` | `john..doe` |
| Not reserved | `myusername` | `admin` |
| Case-insensitive unique | `johndoe` exists | `JohnDoe` blocked |

---

## Implementation Order

1. Run SQL to migrate legacy users (Phase 1)
2. Run SQL to add tracking column (Phase 2)
3. Run SQL to update unique index (Phase 3)
4. Run SQL to add CHECK constraint (Phase 4)
5. Run SQL to create reserved_usernames table with RLS (Phase 5)
6. Run SQL to create reserved username trigger (Phase 6)
7. Run SQL to create change tracking trigger (Phase 7)
8. Update `src/utils/usernameValidation.ts`
9. Update `src/components/auth/UsernameField.tsx`
10. Update `src/components/profile/ProfileEditForm.tsx`
11. Test signup with valid/invalid/reserved usernames
12. Test profile edit with username change tracking

---

## What This Solves

| Problem | Solution |
|---------|----------|
| URL safety | No spaces, encoding issues, or case conflicts |
| Mention reliability | `@username` is predictable and unique |
| Security | Reserved names blocked at database level |
| Future-proofing | Automated change tracking enables cooldowns later |
| Maintainability | Reserved usernames in table, easy to update |
| Server-side enforcement | All paths covered via triggers |
| No data loss | Legacy users migrated, not deleted |

