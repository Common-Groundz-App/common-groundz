

# Final Plan: Fix "Last Used" Badge (with stale-flag cleanup)

The existing approved plan already handles staleness via a 5-minute TTL. One minor addition: clear stale pending flags on auth page mount.

## Changes

### 1. `src/lib/lastAuthMethod.ts` — Add pending intent helpers
- `setPendingGoogleAuth()` — stores `{ timestamp: Date.now() }` under `cg_pending_google_auth`
- `consumePendingGoogleAuth(): boolean` — returns `true` + removes flag if exists and < 5 min old; otherwise returns `false` and cleans up
- `clearPendingGoogleAuth()` — unconditionally removes the flag (for mount cleanup)

### 2. `src/components/auth/GoogleSignInButton.tsx`
- Call `setPendingGoogleAuth()` before `signInWithOAuth`
- If OAuth call errors, call `clearPendingGoogleAuth()`

### 3. `src/contexts/AuthContext.tsx`
- On `SIGNED_IN` event: call `consumePendingGoogleAuth()` → if true, `setLastAuthMethod('google')`
- Remove the old `app_metadata.provider` check

### 4. `src/components/auth/SignInForm.tsx`
- On mount, call `clearPendingGoogleAuth()` to clean up any stale flag from cancelled OAuth
- Fix email badge color: `text-white border-white/50`

