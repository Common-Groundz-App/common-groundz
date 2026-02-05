
# Phase 5 Completion: Simplified Final Plan

## Overview

This plan completes Phase 5 with the cleanest possible architecture, incorporating ChatGPT's feedback to avoid over-engineering.

---

## Architecture (Simplified)

```text
┌─────────────────────────────────────────────────────────────┐
│                    Guard Components                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ProtectedRoute                                             │
│  └── Authentication only (session validity)                 │
│                                                             │
│  RequireCompleteProfile                                     │
│  └── Soft-delete check (always)                             │
│  └── Username check (unless allowIncomplete=true)           │
│                                                             │
│  AppProtectedRoute                                          │
│  └── Composite: ProtectedRoute + RequireCompleteProfile     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: No separate `RequireActiveAccount` needed. Adding an `allowIncomplete` prop to `RequireCompleteProfile` is simpler and avoids duplicate DB fetches.

---

## Implementation Steps

### Step 1: Update RequireCompleteProfile

**File**: `src/components/auth/RequireCompleteProfile.tsx`

Add optional `allowIncomplete` prop:

```typescript
interface RequireCompleteProfileProps {
  children: React.ReactNode;
  allowIncomplete?: boolean; // Skip username check, but still check soft-delete
}

const RequireCompleteProfile: React.FC<RequireCompleteProfileProps> = ({ 
  children, 
  allowIncomplete = false 
}) => {
  // ... existing soft-delete logic (unchanged) ...

  // If no username, redirect to profile completion (unless allowIncomplete)
  if (!allowIncomplete && profile && !profile.username) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
};
```

### Step 2: Create AppProtectedRoute

**New File**: `src/components/AppProtectedRoute.tsx`

```typescript
import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import RequireCompleteProfile from '@/components/auth/RequireCompleteProfile';

interface AppProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Full protection wrapper for app routes.
 * Combines authentication + profile completion + soft-delete checks.
 * 
 * Use this for ALL normal protected routes.
 * Use ProtectedRoute + RequireCompleteProfile(allowIncomplete) only for /complete-profile.
 */
const AppProtectedRoute: React.FC<AppProtectedRouteProps> = ({ children }) => {
  return (
    <ProtectedRoute>
      <RequireCompleteProfile>
        {children}
      </RequireCompleteProfile>
    </ProtectedRoute>
  );
};

export default AppProtectedRoute;
```

### Step 3: Update App.tsx Routes

Replace `ProtectedRoute` with `AppProtectedRoute` for all normal routes.

Special handling for `/complete-profile`:

```tsx
{/* 
  IMPORTANT: Do NOT use AppProtectedRoute here.
  This route must be accessible to authenticated users
  whose profile is incomplete (no username yet).
  
  RequireCompleteProfile with allowIncomplete ensures:
  - Soft-deleted users are still caught and redirected
  - Users without usernames can access this page
*/}
<Route path="/complete-profile" element={
  <ProtectedRoute>
    <RequireCompleteProfile allowIncomplete>
      <CompleteProfile />
    </RequireCompleteProfile>
  </ProtectedRoute>
} />

{/* All other protected routes use AppProtectedRoute */}
<Route path="/home" element={
  <AppProtectedRoute>
    <Feed />
  </AppProtectedRoute>
} />
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/auth/RequireCompleteProfile.tsx` | MODIFY | Add `allowIncomplete` prop |
| `src/components/AppProtectedRoute.tsx` | CREATE | Composite full protection |
| `src/App.tsx` | MODIFY | Update all route wrappers |

**Total: 1 new file, 2 modified files**

---

## Why This Is Cleaner

| Concern | Previous Plan | This Plan |
|---------|---------------|-----------|
| Guards needed | 4 (ProtectedRoute, RequireActiveAccount, RequireCompleteProfile, AppProtectedRoute) | 3 (ProtectedRoute, RequireCompleteProfile, AppProtectedRoute) |
| DB fetches on /complete-profile | 2 (RequireActiveAccount + potential) | 1 (RequireCompleteProfile only) |
| Mental overhead | Higher (two guards doing similar things) | Lower (one guard with clear mode) |

The `allowIncomplete` prop is legitimate because:
- It's on the right guard (profile completion logic belongs here)
- It doesn't mix unrelated concerns
- The name is self-documenting

---

## Route Protection Summary

| Route | Wrapper | Soft-Delete | Username |
|-------|---------|-------------|----------|
| `/complete-profile` | ProtectedRoute + RequireCompleteProfile(allowIncomplete) | ✅ | ❌ (intentional) |
| `/home` | AppProtectedRoute | ✅ | ✅ |
| `/profile` | AppProtectedRoute | ✅ | ✅ |
| `/settings` | AppProtectedRoute | ✅ | ✅ |
| All other protected | AppProtectedRoute | ✅ | ✅ |

---

## Protection Flow

```text
User visits /complete-profile
         |
         v
    ProtectedRoute
    (Is logged in?)
         |
    No --+-- Yes
    |        |
    v        v
  /auth   RequireCompleteProfile
          (allowIncomplete=true)
              |
          Is deleted?
              |
         Yes -+-- No
         |        |
         v        v
    Sign out   Render
       +       CompleteProfile
  /account-    (username check
   deleted      SKIPPED)


User visits any other protected route
         |
         v
    AppProtectedRoute
         |
    ProtectedRoute
    (Is logged in?)
         |
    No --+-- Yes
    |        |
    v        v
  /auth   RequireCompleteProfile
          (allowIncomplete=false)
              |
          Is deleted?
              |
         Yes -+-- No
         |        |
         v        v
    Sign out   Has username?
       +            |
  /account-    No --+-- Yes
   deleted     |        |
               v        v
         /complete   Render
          -profile     App
```

---

## Testing Checklist

After implementation:

- [ ] New Google OAuth user → redirected to `/complete-profile`
- [ ] User completes profile → redirected to `/home`
- [ ] Existing user with username → goes to `/home` directly
- [ ] Soft-deleted user on any route → signed out + redirected to `/account-deleted`
- [ ] Soft-deleted user on `/complete-profile` → signed out + redirected to `/account-deleted`
- [ ] `/complete-profile` page → no infinite redirect loop
- [ ] All protected routes → blocked if profile incomplete
