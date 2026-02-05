

# Refined Plan: Orphaned Auth State Detection (Production-Grade)

## Summary

Implementing server-side JWT validation and orphan detection to prevent deleted users from appearing as "Anonymous User". This incorporates ChatGPT's critical refinement to distinguish between "user not found" (fatal) and "temporary failure" (retry).

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  Defense in Depth Layers                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: AuthContext                                       │
│  └── getUser() validates JWT with Supabase server           │
│  └── TOKEN_REFRESHED event revalidates user existence       │
│  └── If invalid → signOut() + clear state                   │
│                                                             │
│  Layer 2: RequireCompleteProfile                            │
│  └── Profile fetch checks for PGRST116 (not found)          │
│  └── Only NOT FOUND = orphaned state = force logout         │
│  └── Other errors = show error state, NOT auto-logout       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Step 1: AuthContext Server Validation

**File**: `src/contexts/AuthContext.tsx`

**Changes**:
1. After getting cached session with `getSession()`, validate with `getUser()`
2. If user is deleted/invalid, force `signOut()` and clear state
3. Add revalidation on `TOKEN_REFRESHED` event

**Logic flow**:
```text
initializeAuth():
  1. getSession() → get cached session from localStorage
  2. If session exists:
     a. getUser() → validate JWT with Supabase server
     b. If error (user deleted/invalid):
        - signOut()
        - setSession(null), setUser(null)
     c. If valid:
        - setSession, setUser normally
  3. Setup onAuthStateChange listener
     - On TOKEN_REFRESHED: revalidate user with getUser()
```

### Step 2: RequireCompleteProfile Orphan Detection

**File**: `src/components/auth/RequireCompleteProfile.tsx`

**Changes**:
1. Detect `PGRST116` error code specifically (means "not found")
2. Return `{ _orphaned: true }` marker for this case
3. Add useEffect to force logout on orphaned state
4. For OTHER errors → do NOT logout, just log and return null (component will handle gracefully)

**Critical distinction** (ChatGPT's refinement):
```text
Error type: PGRST116 ("not found")
  → User was deleted but JWT still valid
  → Force signOut() + redirect to /
  
Error type: ANY OTHER error  
  → Temporary DB failure, network issue, etc.
  → Do NOT auto-logout (prevents false logouts)
  → Log error, return null, let component handle
```

### Step 3: Profile Fallback Context (No Code Changes)

**Current behavior is actually correct for most cases**:

- `UserMenu` already falls back to email: `profile?.displayName || user?.email?.split('@')[0] || 'User'`
- This is safe because if profile is missing but user exists, they see their email
- The "Anonymous User" string only appears when `transformToSafeProfile(null)` is used

**Where fallback IS appropriate** (no changes needed):
- Viewing other users' old content (deleted user's posts)
- Batch profile fetching where some users may be deleted
- Public profile views

**The real fix**: Layers 1 & 2 catch orphaned states BEFORE they reach components that use fallbacks.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add `getUser()` validation in init + `TOKEN_REFRESHED` handler |
| `src/components/auth/RequireCompleteProfile.tsx` | Add `PGRST116` detection + orphan handling |

**Total: 2 files modified**

---

## Protection Flow After Implementation

```text
App loads with stale JWT (user deleted from Supabase)
         │
         ▼
    AuthContext.initializeAuth()
         │
    getSession() returns cached session
         │
         ▼
    getUser() validates with server ← NEW LAYER 1
         │
    Error returned ──────────────────┐
         │                           │
         ▼                           ▼
    Valid user              signOut() + clear state
         │                  Redirect to /
         ▼                  (User never sees "Anonymous")
    RequireCompleteProfile
         │
    Fetch profile from DB
         │
    Error: PGRST116 ────────────────┐ ← NEW LAYER 2
         │                          │
    Other error                signOut() + redirect
         │                     (Backup protection)
         ▼
    Log + return null
    (Don't logout - temp failure)
         │
         ▼
    Has valid profile
         │
         ▼
    Render app normally
```

---

## Why This Matches Production Standards

| Pattern | Implementation |
|---------|---------------|
| Server validation | `getUser()` contacts Supabase Auth server |
| Error classification | Only `PGRST116` triggers logout, not temp failures |
| Defense in depth | Auth layer + Profile layer both validate |
| Clean failure | Immediate redirect, never "Anonymous User" |
| Event-based revalidation | `TOKEN_REFRESHED` triggers check |
| No over-engineering | Just 2 files, minimal code changes |

---

## Testing Checklist

After implementation:

- [ ] Delete user from Supabase dashboard → user immediately logged out on page load
- [ ] Delete user while app is open → logged out on token refresh
- [ ] Temporary DB outage → user NOT auto-logged out (just see error/retry)
- [ ] Normal users with valid profiles → no change in behavior
- [ ] OAuth users completing onboarding → still works correctly
- [ ] Soft-deleted users → still caught and redirected to /account-deleted
- [ ] View deleted user's old posts → shows "Anonymous User" (correct for public context)

---

## What We're NOT Doing (Avoiding Over-Engineering)

ChatGPT mentioned optional future enhancements:
- Background revalidation on tab focus
- Global session invalidation strategy  
- Audit logging for orphaned states

**Decision**: Skip these for now. The 2-layer defense is sufficient for production. We can add these if needed later, but they're enterprise-level concerns that would add complexity without immediate benefit.

