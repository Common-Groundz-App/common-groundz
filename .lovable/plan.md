

# Auth Flow Polish: Inline Errors + Validation (Final Plan)

## Clarification: Google Sign-In Button

The `GoogleSignInButton` already has a loading/disabled state in the existing codebase (lines 11, 40, 42-43). It shows a spinner and disables the button on click. No change needed here.

---

## Changes

### 1. SignInForm.tsx -- Replace toast errors with inline errors

**Problem:** When incorrect credentials are entered, `toast.error()` fires but may not be visible. Even if it were, toasts are the wrong UX for credential errors. Industry standard (OpenAI, Google, GitHub) uses inline errors.

**What changes:**
- Add `formError` state variable
- Add a `getFriendlyAuthError()` helper to map Supabase errors to user-friendly messages
- Replace `toast.error()` in the credential error catch block with `setFormError()`
- Render error text below the password field in red (`text-destructive`)
- Add red border (`border-destructive`) to the password input when there's an error
- Clear error when user modifies email or password (via `useEffect`)
- Add client-side validation: check email format and non-empty password before calling the gateway
- Keep toasts only for rate limiting and success messages

**Error mapping:**

| Raw Supabase Error | Inline Message |
|---|---|
| `Invalid login credentials` | Incorrect email or password. Please try again. |
| `Email not confirmed` | Please verify your email before signing in. Check your inbox. |
| `User not found` | Incorrect email or password. Please try again. |
| Default fallback | Something went wrong. Please try again. |

**Visual behavior (matching OpenAI style):**
- Red error text appears below the password field, above the "Forgot password?" link
- Password input border turns red
- Error disappears when user starts typing in either field

### 2. SignUpForm.tsx -- Handle "already registered" + name validation

**What changes:**
- In the catch block, detect "User already registered" error and show a specific inline message suggesting the user sign in instead
- Add name validation before submit: trim whitespace, reject empty names, max 50 characters
- Keep toasts for rate limiting and system-level errors only

### 3. UserInfoFields.tsx -- Add maxLength to name inputs

**What changes:**
- Add `maxLength={50}` to first name and last name `Input` components
- No other visual changes

### 4. CredentialFields.tsx -- Add maxLength to email input

**What changes:**
- Add `maxLength={255}` to the email `Input` component
- No other visual changes

---

## Files Modified

| File | Change |
|---|---|
| `SignInForm.tsx` | Inline error state, error mapping helper, red border on error, client-side validation, remove toast for credential errors |
| `SignUpForm.tsx` | Handle "already registered" error specifically, add name validation |
| `UserInfoFields.tsx` | Add `maxLength={50}` to name inputs |
| `CredentialFields.tsx` | Add `maxLength={255}` to email input |

Four files. Targeted edits only. No layout, structure, or other component changes.

---

## What does NOT change

- GoogleSignInButton (already has loading state)
- Toasts for: rate limiting, account linked notification, password reset, system errors
- Form layout, card styling, structure
- All other pages and components

