

# Authentication Enhancement - Final Implementation Plan

## Summary

This plan implements core authentication security features while keeping the scope appropriate for your current 8-user stage. It includes future-proofing hooks as recommended by external reviewers.

---

## What We're Building

| Feature | Priority | Status |
|---------|----------|--------|
| Password strength meter | Core | Implement now |
| Confirm password field | Core | Implement now |
| Show/hide password toggle | Core | Implement now |
| Forgot password flow | Core | Implement now |
| "Check your email" holding screen | Core | Implement now |
| `isEmailVerified` in AuthContext | Future-proofing | Implement now (for later use) |
| TODO hooks for restrictions | Future-proofing | Add comments only |

---

## Implementation Steps

### Step 1: Create Auth Configuration

**New File: `src/config/authConfig.ts`**

Centralized policy constants following existing codebase patterns. Contains `MIN_PASSWORD_SCORE`, `MIN_PASSWORD_LENGTH`, cooldown timers, and a commented `UNVERIFIED_USER_RESTRICTIONS` object for future use.

---

### Step 2: Create Password Strength Utility

**New File: `src/utils/passwordStrength.ts`**

Simple strength calculator (no external dependencies) that returns:
- Score (0-4)
- Label (Very Weak to Very Strong)
- Color class for visual feedback
- Improvement tips
- `meetsMinimum` boolean using config constant

---

### Step 3: Create Password Strength Indicator Component

**New File: `src/components/auth/PasswordStrengthIndicator.tsx`**

Visual 5-segment bar showing password strength with feedback tips below.

---

### Step 4: Update Auth Types

**File: `src/types/auth.ts`**

Add to `AuthContextType`:
- `isEmailVerified: boolean` (future-proofing hook)
- `resetPassword: (email: string) => Promise<{ error: Error | null }>`
- `updatePassword: (newPassword: string) => Promise<{ error: Error | null }>`
- `resendVerificationEmail: () => Promise<{ error: Error | null }>`

---

### Step 5: Update AuthContext

**File: `src/contexts/AuthContext.tsx`**

Add:
- `isEmailVerified` computed from `user?.email_confirmed_at`
- `resetPassword()` using `supabase.auth.resetPasswordForEmail()` with redirect URL
- `updatePassword()` using `supabase.auth.updateUser()`
- `resendVerificationEmail()` using `supabase.auth.resend()`
- Add `emailRedirectTo` option to existing `signUp()` for proper verification links

---

### Step 6: Update CredentialFields Component

**File: `src/components/auth/CredentialFields.tsx`**

Transform from simple email/password to full-featured credential input:
- Add show/hide password toggle (Eye/EyeOff icons from lucide-react)
- Add optional confirm password field with its own show/hide toggle
- Integrate PasswordStrengthIndicator below password field
- New optional props: `confirmPassword`, `setConfirmPassword`, `passwordError`, `showConfirmField`

---

### Step 7: Update SignUpForm

**File: `src/components/auth/SignUpForm.tsx`**

Add password validation flow:
- New state: `confirmPassword`, `passwordError`, `showVerificationPending`
- Validate passwords match before submit
- Validate password strength meets minimum before submit
- After successful signup: Show EmailVerificationPending screen instead of navigating away

---

### Step 8: Create Email Verification Pending Screen

**New File: `src/components/auth/EmailVerificationPending.tsx`**

Post-signup "Check your email" card with:
- Mail icon with clear confirmation message
- User's email displayed
- "Resend verification email" button with 60-second cooldown timer
- "Back to sign in" link

---

### Step 9: Create Forgot Password Form

**New File: `src/components/auth/ForgotPasswordForm.tsx`**

Request password reset form:
- Email input field
- Submit shows "Check your email" confirmation
- "Back to Sign In" button
- Uses config cooldown constant

---

### Step 10: Create Reset Password Page

**New File: `src/pages/ResetPassword.tsx`**

Password reset completion (user lands here from email link):
- New password field with strength indicator
- Confirm password field
- Both have show/hide toggles
- Validation before submit
- Success toast and redirect to /auth

---

### Step 11: Update SignInForm

**File: `src/components/auth/SignInForm.tsx`**

Add:
- Show/hide password toggle
- "Forgot password?" link below password field
- State to toggle between SignInForm and ForgotPasswordForm views

---

### Step 12: Add Reset Password Route

**File: `src/App.tsx`**

Add new route:
```
/auth/reset-password → <ResetPassword />
```

---

## Manual Dashboard Step Required

**Add Redirect URL** in Supabase Dashboard:
- Navigate to: Authentication → URL Configuration
- Add: `https://common-groundz.lovable.app/auth/reset-password`
- Add preview URL: `https://id-preview--1ce0faa5-5842-4fa5-acb5-1f9e3bdad6b9.lovable.app/auth/reset-password`

---

## Files Summary

| File | Change |
|------|--------|
| `src/config/authConfig.ts` | **NEW** - Policy constants + commented future restrictions |
| `src/utils/passwordStrength.ts` | **NEW** - Strength calculator |
| `src/components/auth/PasswordStrengthIndicator.tsx` | **NEW** - Visual meter |
| `src/types/auth.ts` | Add new methods + isEmailVerified |
| `src/contexts/AuthContext.tsx` | Add new methods + isEmailVerified |
| `src/components/auth/CredentialFields.tsx` | Add confirm password, show/hide, strength indicator |
| `src/components/auth/SignUpForm.tsx` | Add validation, show verification pending screen |
| `src/components/auth/EmailVerificationPending.tsx` | **NEW** - Post-signup screen |
| `src/components/auth/ForgotPasswordForm.tsx` | **NEW** - Request reset form |
| `src/pages/ResetPassword.tsx` | **NEW** - Reset completion page |
| `src/components/auth/SignInForm.tsx` | Add forgot password link, show/hide toggle |
| `src/App.tsx` | Add reset-password route |

---

## Future-Proofing Hooks (No Implementation Yet)

The config file will include a commented block for future restrictions:

```typescript
/**
 * DEFERRED: Unverified user restrictions
 * Uncomment and enforce when real users onboard
 * 
 * TODO: Add useEmailVerification hook when ready to enforce
 * TODO: Add EmailVerificationBanner component when ready
 */
// export const UNVERIFIED_USER_RESTRICTIONS = {
//   canBrowse: true,
//   canCreatePosts: false,
//   canComment: false,
//   canChangeUsername: false,
//   canFollowUsers: false,
// };
```

---

## Testing Checklist

1. **Signup with weak password** → Blocked with strength feedback
2. **Signup with mismatched passwords** → "Passwords do not match"
3. **Successful signup** → Shows "Check your email" screen
4. **Click resend** → Email sent, 60s cooldown enforced
5. **Forgot password from sign in** → Shows reset request form
6. **Submit forgot password** → Shows "Check your email" confirmation
7. **Click reset link in email** → Lands on /auth/reset-password
8. **Set new password** → Validates strength, redirects to sign in
9. **Show/hide password toggle** → Works on all password fields

---

## What's Explicitly Deferred

- Email verification banner (Phase 2)
- Unverified user action restrictions (Phase 2)
- `useEmailVerification` hook enforcement (Phase 2)
- Rate limiting / CAPTCHA (Phase 2)
- Magic link / social logins (Phase 2)

