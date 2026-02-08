

# Fix: Sign Up with Existing Email (Final Plan)

## Problem

When a user signs up with an email that already exists, Supabase returns a fake success (with `identities: []` and no error). The app then shows a misleading "Check Your Email" verification screen, even though no email was sent.

## Root Cause

Supabase intentionally does this to prevent email enumeration at the protocol level. But for a consumer/social app, this creates a broken UX. GitHub, Google, OpenAI, and Slack all explicitly tell the user the account exists.

## Fix

Two files. Two small, targeted changes.

### 1. Auth Gateway (`supabase/functions/auth-gateway/index.ts`)

After the `signUp` call succeeds (line 234), add a check before returning the success response:

- If `result.data?.user?.identities?.length === 0`, the email already exists
- Return a `409 Conflict` response with:
  - `error: "User already registered"`
  - `code: "USER_EXISTS"` (stable error code for frontend matching)

This goes right after the signup `break` statement (line 235), before the generic `result.error` check at line 275. Specifically, insert it between lines 235-236 as an early return within the signup case.

### 2. SignUpForm.tsx (`src/components/auth/SignUpForm.tsx`)

Update the error handling block (lines 124-145) to:

- Check `result.code === 'USER_EXISTS'` in the `if (result.error)` block (not in the catch)
- Show toast: "An account with this email already exists. Try signing in instead."
- Keep the string-match fallback in the catch block for safety, but the primary detection uses the stable code
- No layout or structural changes

### Why stable error codes matter

Current code uses brittle string matching:
```text
msg.toLowerCase().includes('user already registered')
```

Updated approach uses the stable code as primary check:
```text
result.code === 'USER_EXISTS'
```

This is safer, easier to maintain, and won't break if Supabase changes their error wording.

## Security Note

This does not meaningfully increase enumeration risk because:
- Rate limiting (3 signup attempts per 5 minutes) is already enforced on the gateway
- The same message pattern is used by GitHub, Google, OpenAI, and Slack
- Attackers gain no new signal beyond what rate-limited attempts already reveal

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/auth-gateway/index.ts` | Add empty `identities` check after signup, return 409 with `USER_EXISTS` code |
| `src/components/auth/SignUpForm.tsx` | Check `result.code === 'USER_EXISTS'` in error block instead of string matching |

## What does NOT change

- Sign-in form (inline errors already implemented)
- Google Sign-In button
- Email verification flow for genuinely new users
- Rate limiting behavior
- All other pages and components

