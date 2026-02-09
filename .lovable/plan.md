

# Fix: Save first_name and last_name to profiles table

## Root Cause

The profile card changes from the previous plan ARE correctly applied in code. However, the **display name still shows the username** because `first_name` and `last_name` are `null` in the `profiles` database table.

The bug is in `ProfileEditForm.tsx` line 170-178. When saving, it only writes `bio`, `location`, and `username` to the `profiles` table. The first/last name are saved ONLY to `auth.user_metadata` (line 189-193), but the profile display reads from the `profiles` table -- where those fields remain `null`.

Database proof:
```text
rishabhsr -> first_name: null, last_name: null
```

This means `transformToSafeProfile` falls through to the username fallback because there's no first/last name data.

## Fix

### File: `src/components/profile/ProfileEditForm.tsx`

**Line 170-173** -- Add `first_name` and `last_name` to the profile update object:

Change:
```typescript
const profileUpdate: { bio: string; location: string; username?: string } = {
  bio: data.bio,
  location: data.location
};
```

To:
```typescript
const profileUpdate: { bio: string; location: string; first_name: string; last_name: string; username?: string } = {
  bio: data.bio,
  location: data.location,
  first_name: data.firstName,
  last_name: data.lastName
};
```

This ensures first/last name are persisted to the `profiles` table alongside the auth metadata update. No other files need changes.

## Impact

After this fix, when a user saves their profile (either during onboarding or via edit), both the `profiles` table AND `auth.user_metadata` will have the correct first/last name. The existing `transformToSafeProfile` logic will then correctly show "Rishab Sr" as the primary display name.

## Note for existing users

The user `rishabhsr` will need to re-save their profile once (open Edit Profile, click Save) to populate the `first_name`/`last_name` fields in the profiles table. After that, the display will work correctly.

