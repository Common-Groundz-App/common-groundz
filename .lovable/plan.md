

# Phase 3: RLS Enforcement for Email Verification - Final Plan

## Summary

This plan adds server-side (database-level) enforcement for email verification, complementing the Phase 2 UI restrictions. Incorporates all reviewer feedback:
- ✅ Transaction wrapping (atomic migration)
- ✅ Policy comments for traceability
- ✅ Post-migration verification guidance
- ✅ Proper timestamped migration naming

---

## Why This Matters

| Layer | Purpose | Bypass Risk |
|-------|---------|-------------|
| Phase 2 (UI) | Good UX, helpful feedback | Easy to bypass via API calls |
| Phase 3 (RLS) | True security enforcement | Cannot bypass |

After Phase 3: **UI = UX, RLS = Law**

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Client Application                           │
│  (Phase 2 UI gates - helpful feedback, not security)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase RLS                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  is_email_verified(user_id) - SECURITY DEFINER function   │  │
│  │  Queries auth.users.email_confirmed_at                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │           Modified INSERT Policies                         │  │
│  │  - posts                  - recommendation_likes           │  │
│  │  - post_comments          - follows                        │  │
│  │  - post_likes             - recommendations                │  │
│  │  - recommendation_comments                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Complete Migration File (Transaction-Wrapped)

**New File: Migration via Supabase tool**

The entire migration is wrapped in a single transaction for atomicity:

```sql
-- ============================================
-- Phase 3: Email Verification RLS Enforcement
-- ============================================
-- Wrapped in transaction: if ANY step fails, ALL changes rollback
-- ============================================

BEGIN;

-- Step 1: Create the verification check function
CREATE OR REPLACE FUNCTION public.is_email_verified(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT email_confirmed_at IS NOT NULL 
     FROM auth.users 
     WHERE id = check_user_id),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_email_verified(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_email_verified IS 
'Phase 3: Checks if user email is verified. Used in RLS INSERT policies.';

-- Step 2: Update posts INSERT policy
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own posts" ON posts IS 
'Phase 3: Requires email verification to create posts';

-- Step 3: Update post_comments INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add post comments" ON post_comments;
CREATE POLICY "Authenticated users can add post comments" ON post_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Authenticated users can add post comments" ON post_comments IS 
'Phase 3: Requires email verification to comment on posts';

-- Step 4: Update post_likes INSERT policy
DROP POLICY IF EXISTS "Users can create their own likes" ON post_likes;
CREATE POLICY "Users can create their own likes" ON post_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can create their own likes" ON post_likes IS 
'Phase 3: Requires email verification to like posts';

-- Step 5: Update recommendation_comments INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add comments" ON recommendation_comments;
CREATE POLICY "Authenticated users can add comments" ON recommendation_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Authenticated users can add comments" ON recommendation_comments IS 
'Phase 3: Requires email verification to comment on recommendations';

-- Step 6: Update recommendation_likes INSERT policy
DROP POLICY IF EXISTS "Users can insert their own likes" ON recommendation_likes;
CREATE POLICY "Users can insert their own likes" ON recommendation_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own likes" ON recommendation_likes IS 
'Phase 3: Requires email verification to like recommendations';

-- Step 7: Update follows INSERT policy
DROP POLICY IF EXISTS "Users can create follows" ON follows;
CREATE POLICY "Users can create follows" ON follows
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can create follows" ON follows IS 
'Phase 3: Requires email verification to follow users';

-- Step 8: Update recommendations INSERT policy
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON recommendations;
CREATE POLICY "Users can insert their own recommendations" ON recommendations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own recommendations" ON recommendations IS 
'Phase 3: Requires email verification to create recommendations';

COMMIT;
```

---

### Step 2: Update authConfig.ts Documentation

**File: `src/config/authConfig.ts`**

Update the Phase 3 TODO comment to mark completion:

```typescript
/**
 * Email verification enforcement - COMPLETE
 * 
 * PHASE 2 (COMPLETE): UI-level enforcement via useEmailVerification hook
 *   - Centralized in useEmailVerification.ts
 *   - All UI gates marked with: // Email verification gate (Phase 2 — UI only)
 * 
 * PHASE 3 (COMPLETE): RLS enforcement via is_email_verified() function
 *   - SECURITY DEFINER function queries auth.users.email_confirmed_at
 *   - Applied to INSERT policies on:
 *     - posts
 *     - post_comments
 *     - recommendation_comments
 *     - post_likes
 *     - recommendation_likes
 *     - follows
 *     - recommendations
 * 
 * Both layers work together:
 *   - UI provides helpful feedback before action
 *   - RLS enforces at database level (cannot bypass)
 */
```

---

### Step 3: Post-Migration Verification (Manual Step)

**IMPORTANT**: After migration, ensure your 8 test accounts are verified.

**Option A - Via Supabase Dashboard:**
1. Go to Authentication > Users
2. For each test user, check that `email_confirmed_at` is set
3. If not, manually confirm them

**Option B - Via SQL (faster for multiple accounts):**
```sql
-- Run this in Supabase SQL Editor if needed
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email IN (
  'test1@example.com',
  'test2@example.com'
  -- Add your test account emails
)
AND email_confirmed_at IS NULL;
```

---

## Files Summary

| File | Change Type | Notes |
|------|-------------|-------|
| Database Migration | **NEW** | Transaction-wrapped RLS migration |
| `src/config/authConfig.ts` | **UPDATE** | Mark Phase 3 complete |

**Total: 1 migration, 1 code file update**

---

## What This Does NOT Break

| Concern | Status |
|---------|--------|
| Existing data | ✅ Unaffected (policies only affect new INSERTs) |
| SELECT operations | ✅ Unchanged |
| UPDATE operations | ✅ Unchanged |
| DELETE operations | ✅ Unchanged |
| Performance | ✅ Single PK lookup on auth.users (indexed) |
| Verified users | ✅ All actions work normally |

---

## Rollback Plan

If issues are discovered:

```sql
BEGIN;

-- Restore original policies (without email verification)
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can add post comments" ON post_comments;
CREATE POLICY "Authenticated users can add post comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own likes" ON post_likes;
CREATE POLICY "Users can create their own likes" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can add comments" ON recommendation_comments;
CREATE POLICY "Authenticated users can add comments" ON recommendation_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own likes" ON recommendation_likes;
CREATE POLICY "Users can insert their own likes" ON recommendation_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create follows" ON follows;
CREATE POLICY "Users can create follows" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can insert their own recommendations" ON recommendations;
CREATE POLICY "Users can insert their own recommendations" ON recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Optionally remove function
DROP FUNCTION IF EXISTS public.is_email_verified(uuid);

COMMIT;
```

---

## Testing Checklist

### After Migration

1. **Function works correctly**:
   ```sql
   -- Test with a verified user ID
   SELECT is_email_verified('verified-user-uuid'); -- Should return true
   
   -- Test with an unverified user ID  
   SELECT is_email_verified('unverified-user-uuid'); -- Should return false
   ```

2. **Verified user can perform all actions** (posts, comments, likes, follows, recommendations)

3. **Unverified user gets RLS error** when attempting INSERT on protected tables

4. **UI still shows helpful toast** before RLS error would occur (Phase 2 + Phase 3 working together)

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Function accesses `auth.users` | `SECURITY DEFINER` with explicit `SET search_path` |
| Partial migration failure | Entire migration wrapped in transaction |
| Performance overhead | Single indexed PK lookup (negligible) |
| Error messages | RLS gives generic error; UI (Phase 2) provides context |

---

## After Phase 3: What's Complete

| Feature | Status |
|---------|--------|
| Password strength validation | ✅ Phase 1 |
| Email verification flow | ✅ Phase 1 |
| Forgot password flow | ✅ Phase 1 |
| UI restrictions for unverified users | ✅ Phase 2 |
| RLS enforcement for email verification | ✅ Phase 3 |

---

## What's Deferred to Phase 4+

| Feature | Phase |
|---------|-------|
| Rate limiting on auth endpoints | Phase 4 |
| CAPTCHA for signup | Phase 4 |
| Magic link / OTP login | Phase 4+ |
| Social logins (Google, GitHub) | Phase 4+ |

