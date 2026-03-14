

# "Last Used" Auth Method Badge — Final Plan

## New file: `src/lib/lastAuthMethod.ts`
- `setLastAuthMethod(method: 'email' | 'google')` — stores `{ method, timestamp: Date.now() }` as JSON in localStorage key `cg_last_auth_method`
- `getLastAuthMethod(): 'email' | 'google' | null` — parses stored JSON, returns `null` if:
  - No value exists
  - Older than 30 days
  - `method` is not `'email'` or `'google'` (corruption guard)

## `src/contexts/AuthContext.tsx`
- Import `setLastAuthMethod`
- In the `onAuthStateChange` listener, when `event === 'SIGNED_IN'`:
  - Check `currentSession?.user?.app_metadata?.provider`
  - **Only** if provider is `'google'`, call `setLastAuthMethod('google')`
  - This guards against overwriting email logins that also trigger `SIGNED_IN`

## `src/components/auth/SignInForm.tsx`
- Import `getLastAuthMethod` and `setLastAuthMethod`
- On mount, read `getLastAuthMethod()` into state
- After successful email login (before `navigate('/home')`), call `setLastAuthMethod('email')`
- If `lastMethod === 'email'`, render a "Last used" badge inline next to the Sign In button
- Pass `lastMethod === 'google'` as `showLastUsed` prop to `GoogleSignInButton`

## `src/components/auth/GoogleSignInButton.tsx`
- Add optional `showLastUsed?: boolean` prop
- If true, render "Last used" badge inline after the button text
- No localStorage logic in this component

## `src/components/auth/SignUpForm.tsx`
- Same pattern: read `getLastAuthMethod()` on mount, pass `showLastUsed` to `GoogleSignInButton`

## Badge styling
```tsx
<span className="text-[10px] font-medium text-brand-orange border border-brand-orange/50 rounded-full px-2 py-0.5">
  Last used
</span>
```

## Summary of refinements incorporated
- Store only after confirmed auth success (not on click)
- 30-day TTL expiry
- Provider guard in AuthContext (only write `'google'` when provider is Google)
- Corruption guard in `getLastAuthMethod()`
- No method reordering (badge only)

