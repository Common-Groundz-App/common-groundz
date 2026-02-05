

# Phase 5: Google OAuth + Account Management (Final Production Plan)

## Summary

This is the **final, production-ready plan** with all security refinements incorporated. It adds Google OAuth login with a profile completion flow, essential account management features with **minimal soft delete**, **full RLS protection** (SELECT + UPDATE), a **session-level guard**, and a **double-delete guard** in the edge function.

---

## Final Additions (From ChatGPT Review)

### 1. RLS Protection for UPDATE Operations

The current UPDATE policy only checks `auth.uid() = id`. We need to also verify the user is not soft-deleted:

```sql
-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

-- Create new UPDATE policy that checks deletion status
CREATE POLICY "Users can update their own active profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);
```

**Why**: Prevents a deleted user (in a session edge case) from modifying their profile before the route guard triggers.

### 2. Double-Delete Guard in Edge Function

Before setting `deleted_at`, check if already deleted:

```typescript
// Check if already deleted
const { data: profile } = await supabaseClient
  .from('profiles')
  .select('deleted_at')
  .eq('id', user.id)
  .single();

if (profile?.deleted_at) {
  return new Response(JSON.stringify({ 
    error: 'Account already deleted',
    code: 'ALREADY_DELETED'
  }), { status: 400, ... });
}
```

**Why**: Prevents race conditions, duplicate operations, and cleaner logging.

---

## Architecture: Defense-in-Depth (5 Layers)

```text
PROTECTION LAYERS
=================

Layer 1: Edge Function
  - Checks if already deleted (double-delete guard)
  - Sets deleted_at = NOW()
  - Calls auth.admin.signOut(scope: 'global')
  - Immediate session termination

Layer 2: Database RLS - SELECT
  - Policy: deleted_at IS NULL
  - Blocks public queries for deleted profiles
  - Users can still view own profile (for guard logic)

Layer 3: Database RLS - UPDATE
  - Policy: auth.uid() = id AND deleted_at IS NULL
  - Deleted users cannot modify their profile
  - True database-level enforcement

Layer 4: Profile Service
  - Fetches deleted_at with profile data
  - Returns isDeleted flag alongside profile
  - Single query, no redundancy

Layer 5: Route Guard
  - Checks deleted_at from profile fetch
  - Forces signOut if deleted
  - Redirects to /account-deleted
  - Catches race conditions / cached sessions
```

---

## Implementation Steps

### Step 1: Manual Setup - Google OAuth in Supabase

**Google Cloud Console**
- Create OAuth 2.0 Client ID (Web application)
- Authorized JavaScript origins:
  - `https://common-groundz.lovable.app`
  - `https://id-preview--1ce0faa5-5842-4fa5-acb5-1f9e3bdad6b9.lovable.app`
- Authorized redirect URIs:
  - `https://uyjtgybbktgapspodajy.supabase.co/auth/v1/callback`

**Supabase Dashboard**
- Authentication → Providers → Enable Google
- Add Client ID and Client Secret
- Authentication → URL Configuration → Add redirect URLs

---

### Step 2: Database Migrations

**Migration 1: Add `deleted_at` column**

```sql
-- Add soft delete column
ALTER TABLE public.profiles
ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Create partial index for filtering active profiles
CREATE INDEX idx_profiles_deleted_at ON public.profiles (deleted_at)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.deleted_at IS 
  'Timestamp when user requested account deletion. NULL = active account.';
```

**Migration 2: Update RLS policies for soft delete**

```sql
-- Update SELECT policy: public queries exclude soft-deleted
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone (active only)"
  ON public.profiles FOR SELECT
  USING (deleted_at IS NULL);

-- Allow users to view their own profile (even if deleted, for edge cases)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Update UPDATE policy: deleted users cannot modify profile
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update their own active profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);
```

**Migration 3: Update `handle_new_user` trigger for OAuth**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    first_name, 
    last_name, 
    avatar_url
  )
  VALUES (
    new.id,
    -- Only set username if explicitly provided (email signup)
    -- OAuth users get NULL -> triggers completion flow
    new.raw_user_meta_data->>'username',
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'given_name'
    ),
    COALESCE(
      new.raw_user_meta_data->>'last_name',
      new.raw_user_meta_data->>'family_name'
    ),
    COALESCE(
      new.raw_user_meta_data->>'picture',
      new.raw_user_meta_data->>'avatar_url'
    )
  );
  RETURN new;
END;
$$;
```

---

### Step 3: Update Profile Types

**Modified: `src/types/profile.ts`**

Add `deleted_at` to all profile interfaces:

```typescript
export interface BaseUserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  location: string | null;
  created_at: string | null;
  username_changed_at: string | null;
  deleted_at: string | null;  // NEW
}

export interface SafeUserProfile {
  // ... existing fields ...
  deleted_at: string | null;  // NEW
}
```

Update `transformToSafeProfile` to include `deleted_at`.

---

### Step 4: Update Profile Service

**Modified: `src/services/enhancedUnifiedProfileService.ts`**

Include `deleted_at` in profile queries:

```typescript
// In fetchSingleProfileDirect
const { data, error } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, first_name, last_name, bio, location, created_at, username_changed_at, deleted_at')
  .eq('id', userId)
  .single();
```

RLS handles filtering for public queries. The user's own profile (with `deleted_at`) is still accessible for the route guard to check.

---

### Step 5: Update Auth Config

**Modified: `src/config/authConfig.ts`**

Add recovery policy and Phase 5 documentation:

```typescript
/**
 * Account Recovery Policy for Soft-Deleted Accounts
 */
export const ACCOUNT_RECOVERY_POLICY = {
  windowDays: 30,
  method: 'Contact support',
  supportEmail: 'support@commongroundz.com',
  description: 'Accounts can be restored within 30 days of deletion by contacting support.',
} as const;
```

---

### Step 6: Update ProfileEditForm with Mode Support

**Modified: `src/components/profile/ProfileEditForm.tsx`**

Add `mode?: 'edit' | 'onboarding'` prop:

| Behavior | mode="edit" | mode="onboarding" |
|----------|-------------|-------------------|
| Cancel button | Shown | Hidden |
| Dialog dismissable | Yes | No |
| Username field | Locked if in cooldown | Always editable |
| CTA text | "Save changes" | "Continue" |
| 30-day warning | Shown | Hidden |
| Title | "Edit Profile" | "Complete Your Profile" |
| On success | Close dialog | Navigate to `/home` |

---

### Step 7: Create Profile Completion Page

**New File: `src/pages/CompleteProfile.tsx`**

- Renders `ProfileEditForm` in `mode="onboarding"`
- Full-page layout, non-escapable
- User must set username to proceed

---

### Step 8: Create Account Deleted Page

**New File: `src/pages/AccountDeleted.tsx`**

- Message: "Your account has been deleted"
- Recovery info from `ACCOUNT_RECOVERY_POLICY`
- Link to sign up again or contact support

---

### Step 9: Create Profile Completion Guard

**New File: `src/components/auth/RequireCompleteProfile.tsx`**

Route guard checking both completeness and deletion status:

```typescript
const RequireCompleteProfile = ({ children }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile(user?.id);
  
  // Handle soft-deleted user: force sign out
  useEffect(() => {
    if (profile?.deleted_at) {
      signOut();
      navigate('/account-deleted', { replace: true });
    }
  }, [profile, signOut, navigate]);
  
  if (isLoading) return <LoadingSpinner />;
  if (profile?.deleted_at) return null;
  if (!profile?.username) {
    return <Navigate to="/complete-profile" replace />;
  }
  
  return children;
};
```

Single query - merged deletion check with profile fetch.

---

### Step 10: Create GoogleSignInButton Component

**New File: `src/components/auth/GoogleSignInButton.tsx`**

- Google logo + "Continue with Google"
- Calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Loading and error states

---

### Step 11: Update SignInForm and SignUpForm

**Modified: `src/components/auth/SignInForm.tsx` and `SignUpForm.tsx`**

Add below existing form:
- Visual divider ("or continue with")
- `GoogleSignInButton` component

---

### Step 12: Update App Router

**Modified: `src/App.tsx`**

Add routes:
- `/complete-profile` - Profile completion (protected, allows incomplete)
- `/account-deleted` - Account deleted page (public)

Update ProtectedRoute to include RequireCompleteProfile guard.

---

### Step 13: Create ChangePasswordModal

**New File: `src/components/settings/ChangePasswordModal.tsx`**

- Current password verification via `signInWithPassword()`
- New password + confirm fields
- Password strength indicator
- Hidden for OAuth-only users

---

### Step 14: Create DeleteAccountModal

**New File: `src/components/settings/DeleteAccountModal.tsx`**

- Warning about deletion
- Shows recovery policy info (30 days)
- Typing "DELETE" confirmation
- Calls `deactivate-account` edge function

---

### Step 15: Create deactivate-account Edge Function

**New File: `supabase/functions/deactivate-account/index.ts`**

With double-delete guard:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DOUBLE-DELETE GUARD: Check if already deleted
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .single();

    if (profile?.deleted_at) {
      console.log('Account already deleted:', user.id);
      return new Response(JSON.stringify({ 
        error: 'Account already deleted',
        code: 'ALREADY_DELETED'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Soft delete: set deleted_at timestamp
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw updateError;
    }

    console.log('Account soft-deleted:', user.id);

    // Sign out all sessions using admin client
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await adminClient.auth.admin.signOut(user.id, 'global');
    console.log('All sessions invalidated for:', user.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deactivating account:', error);
    return new Response(JSON.stringify({ error: 'Failed to deactivate account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

### Step 16: Update Settings Account Tab

**Modified: `src/pages/Settings.tsx`**

Enhanced Account tab:

```text
+--------------------------------------------------+
| Account Settings                                 |
+--------------------------------------------------+
| Email                                            |
| user@example.com  [Verified] or [! Unverified]   |
| [Resend Verification] (if unverified)            |
+--------------------------------------------------+
| Password                    (email users only)   |
| [Change Password]                                |
| (Hidden for OAuth-only users)                    |
+--------------------------------------------------+
| Active Sessions                                  |
| [Logout from all devices]                        |
+--------------------------------------------------+
| Danger Zone                                      |
| Recovery: 30 days via support                    |
| [Delete Account] -> Opens DeleteAccountModal     |
+--------------------------------------------------+
```

OAuth Detection:
```typescript
const isOAuthOnlyUser = (user: User): boolean => {
  return !user.identities?.some(i => i.provider === 'email');
};
```

---

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| Database Migration (3 parts) | NEW | `deleted_at`, RLS (SELECT+UPDATE), trigger |
| `src/types/profile.ts` | UPDATE | Add `deleted_at` to types |
| `src/services/enhancedUnifiedProfileService.ts` | UPDATE | Include `deleted_at` in queries |
| `src/config/authConfig.ts` | UPDATE | Add recovery policy |
| `src/components/profile/ProfileEditForm.tsx` | UPDATE | Add `mode='onboarding'` |
| `src/pages/CompleteProfile.tsx` | NEW | Profile completion for OAuth |
| `src/pages/AccountDeleted.tsx` | NEW | Deleted account information |
| `src/components/auth/RequireCompleteProfile.tsx` | NEW | Route guard with session check |
| `src/components/auth/GoogleSignInButton.tsx` | NEW | Google OAuth button |
| `src/components/settings/ChangePasswordModal.tsx` | NEW | Password change with verification |
| `src/components/settings/DeleteAccountModal.tsx` | NEW | Deletion confirmation |
| `supabase/functions/deactivate-account/index.ts` | NEW | Soft delete with double-delete guard |
| `supabase/config.toml` | UPDATE | Add edge function config |
| `src/components/auth/SignInForm.tsx` | UPDATE | Add Google OAuth |
| `src/components/auth/SignUpForm.tsx` | UPDATE | Add Google OAuth |
| `src/App.tsx` | UPDATE | Add routes and guards |
| `src/pages/Settings.tsx` | UPDATE | Enhanced Account tab |

**Total: 8 new files, 8 updated files, 3 database migrations**

---

## Defense-in-Depth Summary

| Layer | Location | Protection |
|-------|----------|------------|
| 1 | Edge Function | Double-delete guard + `deleted_at` + global signOut |
| 2 | RLS - SELECT | `deleted_at IS NULL` for public queries |
| 3 | RLS - UPDATE | `auth.uid() = id AND deleted_at IS NULL` |
| 4 | Profile Service | Returns `deleted_at` with profile data |
| 5 | Route Guard | Forces signOut if `deleted_at` is set |

---

## Recovery Policy

| Aspect | Value |
|--------|-------|
| Recovery Window | 30 days |
| Method | Contact support@commongroundz.com |
| Data Preserved | All (not anonymized) |
| Admin Action | Set `deleted_at = NULL` to restore |

---

## Testing Checklist

### Google OAuth
- [ ] Button appears on Sign In and Sign Up pages
- [ ] Redirects to Google consent screen
- [ ] New users redirected to /complete-profile
- [ ] Existing users with username go to /home
- [ ] Avatar and name imported from Google

### Profile Completion
- [ ] Cannot close/dismiss the form
- [ ] Username validation works
- [ ] On success, redirects to /home

### Password Change
- [ ] Hidden for OAuth-only users
- [ ] Requires current password verification
- [ ] Password strength indicator works

### Soft Delete - All 5 Protection Layers
- [ ] Double-delete returns error (Layer 1)
- [ ] Deletion sets `deleted_at` timestamp (Layer 1)
- [ ] User signed out immediately (Layer 1)
- [ ] Public profile queries blocked by RLS (Layer 2)
- [ ] Deleted user cannot update profile via RLS (Layer 3)
- [ ] Profile service returns `deleted_at` (Layer 4)
- [ ] Route guard forces signOut and redirects (Layer 5)
- [ ] /account-deleted page shows recovery info

### Logout All Sessions
- [ ] Works for all user types
- [ ] All sessions invalidated

---

## Explicitly Deferred

| Feature | When to Add |
|---------|-------------|
| OAuth re-consent for deletion | When abuse patterns observed |
| Password re-auth for deletion | When abuse patterns observed |
| Username anonymization | When privacy policy defined |
| Account recovery UI | When users request it |
| Hard delete | With admin tooling + data retention |

---

## Implementation Order

1. Database migrations (`deleted_at` + RLS + trigger)
2. Google OAuth setup (manual in dashboards)
3. Update profile types
4. Update profile service
5. Update authConfig (recovery policy)
6. GoogleSignInButton component
7. Update SignInForm + SignUpForm
8. ProfileEditForm mode support
9. CompleteProfile page
10. AccountDeleted page
11. RequireCompleteProfile guard
12. Update App.tsx routes
13. ChangePasswordModal
14. deactivate-account edge function
15. DeleteAccountModal
16. Update Settings Account tab
17. End-to-end testing

