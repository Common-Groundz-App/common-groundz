

# Fix OAuth Redirect Race Condition + Linking Toast

Two small changes. One file modified, one file lightly touched.

---

## What's Already Covered

The ChatGPT suggestion to add an "auth hydration guard" is **already implemented**:
- `AuthInitializer` wraps the entire app and blocks rendering until `isLoading` is false
- `Index` page shows a loading spinner until auth state resolves
- `ProtectedRoute` also waits for `isLoading`

No changes needed there.

---

## Changes

### 1. Fix OAuth redirect target

**File:** `src/components/auth/GoogleSignInButton.tsx`

Change `redirectTo` from `/home` to `/`:

```
// Before
redirectTo: `${window.location.origin}/home`

// After
redirectTo: `${window.location.origin}/`
```

This prevents the race condition where `ProtectedRoute` on `/home` rejects the user before Supabase finishes processing OAuth tokens from the URL.

### 2. Add identity linking toast notification

**File:** `src/contexts/AuthContext.tsx`

In the `onAuthStateChange` listener, when the event is `USER_UPDATED` (which fires during identity linking), show a toast:

> "Your Google account has been linked to your existing account."

This only fires once during the linking event, not on regular logins. It builds user trust and prevents confusion about what just happened.

---

## Summary

| File | Change |
|------|--------|
| `GoogleSignInButton.tsx` | `redirectTo` -> `/` |
| `AuthContext.tsx` | Toast on `USER_UPDATED` auth event |

Two files. Two minimal edits. No structural changes.
