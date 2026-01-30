

# Fix: Profile Embedding Trigger Function (Production-Ready)

## Problem

When editing your profile, the update fails with:
```
function public.generate_embedding_async(text, unknown) does not exist
```

## Root Cause

The `trigger_profile_embedding()` function calls the old 2-parameter signature, but only the 3-parameter version exists after migration `20251112131707` dropped the old function.

## Solution

Create a database migration with these fixes:

1. **Correct function signature**: `generate_embedding_async(NEW.id, content, 'profile')`
2. **BEFORE trigger timing**: So `NEW.embedding_updated_at := now()` persists
3. **NEW.id guard**: Generate UUID if null (BEFORE INSERT safety)
4. **Stable trigger name**: Keep `trigger_profile_embedding_after` for downstream compatibility
5. **Column restriction**: Only fire on `username, first_name, last_name, bio`
6. **Documentation**: Comment explaining the timing/name mismatch

## Implementation

### New Migration File

Create `supabase/migrations/[timestamp]_fix_profile_embedding_trigger.sql`:

```sql
-- =============================================
-- Fix Profile Embedding Trigger Function
-- =============================================
-- This migration fixes the profile embedding trigger to:
-- 1. Use the correct 3-parameter signature for generate_embedding_async
-- 2. Change to BEFORE trigger so NEW.embedding_updated_at persists
-- 3. Guard against NULL NEW.id in BEFORE INSERT
-- 4. Keep trigger name stable for downstream migration compatibility

CREATE OR REPLACE FUNCTION public.trigger_profile_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  content TEXT;
  should_generate BOOLEAN := FALSE;
BEGIN
  -- Ensure NEW.id exists (BEFORE trigger safety for INSERT)
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  -- Rate limiting: Skip if embedding was updated in last 5 minutes
  IF NEW.embedding_updated_at IS NOT NULL AND 
     NEW.embedding_updated_at > (now() - interval '5 minutes') THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('profiles', NEW.id, 'profile', TRUE, 'Rate limited (5 min cooldown)');
    RETURN NEW;
  END IF;
  
  -- Build content from profile fields
  content := COALESCE(NEW.username, '') || ' ' || 
             COALESCE(NEW.first_name, '') || ' ' || 
             COALESCE(NEW.last_name, '') || ' ' || 
             COALESCE(NEW.bio, '');
  content := trim(content);
  
  -- Determine if we should generate embedding
  IF TG_OP = 'INSERT' THEN
    should_generate := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.username, '') IS DISTINCT FROM COALESCE(NEW.username, '') OR
       COALESCE(OLD.first_name, '') IS DISTINCT FROM COALESCE(NEW.first_name, '') OR
       COALESCE(OLD.last_name, '') IS DISTINCT FROM COALESCE(NEW.last_name, '') OR
       COALESCE(OLD.bio, '') IS DISTINCT FROM COALESCE(NEW.bio, '') THEN
      should_generate := TRUE;
    END IF;
  END IF;
  
  IF should_generate AND length(content) > 0 THEN
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, content_length, skipped)
    VALUES ('profiles', NEW.id, 'profile', length(content), FALSE);
    
    -- Correct 3-parameter signature: (record_id, content, content_type)
    PERFORM public.generate_embedding_async(NEW.id, content, 'profile');
    
    -- Persist rate-limit timestamp (works in BEFORE trigger)
    NEW.embedding_updated_at := now();
  ELSE
    INSERT INTO public.embedding_trigger_log (table_name, record_id, content_type, skipped, skip_reason)
    VALUES ('profiles', NEW.id, 'profile', TRUE, 'No content change or empty content');
  END IF;
  
  RETURN NEW;
END;
$$;

-- NOTE: We keep the name "trigger_profile_embedding_after" even though this is
-- now a BEFORE trigger. This is INTENTIONAL for compatibility with downstream
-- migrations (e.g., 20260130065112_username_protocol.sql) that reference this
-- trigger name. DO NOT rename this trigger.
DROP TRIGGER IF EXISTS trigger_profile_embedding_after ON profiles;

CREATE TRIGGER trigger_profile_embedding_after
BEFORE INSERT OR UPDATE OF username, first_name, last_name, bio ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_profile_embedding();
```

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| Function signature | 2-param (broken) | 3-param (correct) |
| Trigger timing | AFTER | BEFORE |
| NEW.id handling | Assumed present | Guarded with fallback |
| Trigger name | `trigger_profile_embedding_after` | Same (for compatibility) |
| Column restriction | All columns | `username, first_name, last_name, bio` |
| Documentation | None | Comment explaining timing |

## Testing

After implementing:
1. Go to your profile page
2. Click the pencil icon on the profile card
3. Edit your username or bio
4. Save changes - should succeed without errors
5. Edit again within 5 minutes - should be rate-limited

