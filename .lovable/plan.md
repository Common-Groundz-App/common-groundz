

# Add Required Field Indicators and Inline Validation to Profile Form

## Changes

### `src/components/profile/ProfileEditForm.tsx`

**1. Red asterisks on required field labels**

Add `<span className="text-red-500">*</span>` after the label text for First Name, Last Name, and Username.

**2. react-hook-form validation rules on required FormFields**

Add `rules` prop to three FormField components:

- `firstName`: `{ required: 'First name is required', validate: v => v.trim().length > 0 || 'First name is required' }`
- `lastName`: `{ required: 'Last name is required', validate: v => v.trim().length > 0 || 'Last name is required' }`
- `username`: `{ required: !isUsernameLocked && 'Username is required', validate: v => isUsernameLocked || v.trim().length >= 3 || 'Username must be at least 3 characters' }` -- conditional so it does not conflict with the locked/cooldown state in edit mode

Errors display automatically via the existing `<FormMessage />` components already in each FormItem.

**3. Trim whitespace on submit**

In the `onSubmit` handler, add:
```
data.firstName = data.firstName.trim();
data.lastName = data.lastName.trim();
```

**4. No other files changed**

Location and Bio remain optional. Button stays always active. Toast remains for system/network errors only.

## Summary

| File | Change |
|---|---|
| `src/components/profile/ProfileEditForm.tsx` | Add red asterisks to 3 labels, add `rules` to 3 FormFields (username conditional on lock state), trim names on submit |

