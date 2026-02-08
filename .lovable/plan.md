

# Signup Form Polish: Inline Errors + Stronger Password Enforcement

## Changes

### 1. Real-time "passwords don't match" inline error

Show an inline error below the Confirm Password field as the user types (after they've started typing in it), clearing it when they match.

**File: `src/components/auth/CredentialFields.tsx`**
- Add an `onBlur` or live-check that compares `password` and `confirmPassword`
- Display a red inline error message ("Passwords do not match") below the confirm field when they differ and the confirm field is non-empty
- Clear the error when they match

### 2. Raise minimum password strength to "Strong" (score 3)

Currently `MIN_PASSWORD_SCORE = 2` (Fair), which allows passwords like "password1" through. Raising to 3 means users need at least 3 of: length >= 8, length >= 12, mixed case, number, special character.

**File: `src/config/authConfig.ts`**
- Change `MIN_PASSWORD_SCORE: 2` to `MIN_PASSWORD_SCORE: 3`

### 3. No change to button disabled behavior

The button stays always active (current behavior). Validation happens on submit with clear inline/toast feedback. This matches industry standards.

## Technical Details

### CredentialFields.tsx changes

Add local state to track whether the confirm field has been interacted with:

```
const [confirmTouched, setConfirmTouched] = useState(false);
```

On the confirm password input, add `onBlur={() => setConfirmTouched(true)}`.

Show inline mismatch error when:
- `confirmTouched` is true
- `confirmPassword` is non-empty
- `password !== confirmPassword`

The existing `passwordError` prop (used for submit-time errors) continues to work alongside this new real-time check.

### authConfig.ts change

```
MIN_PASSWORD_SCORE: 3  // was 2 — now requires "Strong" password
```

This means the password strength indicator will show feedback tips until the user reaches "Strong" (score 3), which naturally requires a combination of length + character variety without rigid mandates.

## Files Modified

| File | Change |
|---|---|
| `src/components/auth/CredentialFields.tsx` | Add real-time inline "passwords don't match" error |
| `src/config/authConfig.ts` | Raise `MIN_PASSWORD_SCORE` from 2 to 3 |

## What stays the same

- "Create Account" button remains always active (no greying out)
- No mandatory "must have uppercase" or "must have special character" rules
- Password strength indicator continues to show helpful tips
- Submit-time validation still catches everything as a safety net

