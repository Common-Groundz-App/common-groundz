

# Fix Profile Card Display: Real Name as Primary, Username as Secondary

## Problem

The profile card shows the **username** ("rishabhsr") as the primary bold name, even though first/last name ("Rishab Sr") is stored. This is because `transformToSafeProfile` prioritizes username over real name, which is backwards from industry standard (Instagram, Twitter/X, GitHub, LinkedIn all show real name as primary).

Additionally, the `username` field in `SafeUserProfile` is incorrectly set to `displayName` instead of the actual username, causing data confusion downstream.

## Root Cause

In `src/types/profile.ts`, line 92-95:
```text
const displayName = profile.username ||        // <-- username wins
    (first + last) ||
    first_name ||
    fallback;
```

And line 111:
```text
username: displayName,   // <-- actual username is lost
```

## Changes

### 1. `src/types/profile.ts` -- Fix display name priority and preserve actual username

**displayName priority** (line 92-95): Change to prefer full name over username:
```text
const displayName =
    (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : '') ||
    profile.first_name ||
    profile.username ||
    PROFILE_FALLBACKS.username;
```

**username field** (line 111): Preserve the actual username instead of overwriting with displayName:
```text
username: profile.username || PROFILE_FALLBACKS.username,
```

**initials** (line 97-103): Also flip priority to prefer real name initials:
```text
const initials = (profile.first_name && profile.last_name)
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.first_name
      ? profile.first_name.substring(0, 2).toUpperCase()
      : profile.username
        ? profile.username.substring(0, 2).toUpperCase()
        : PROFILE_FALLBACKS.initials;
```

### 2. `src/components/profile/ProfileUserInfo.tsx` -- Center-align name + edit icon

The edit icon sitting in a flex row can pull the layout off-center. Fix:

- Add `gap-1.5` to the flex container for consistent spacing
- Reduce edit button opacity slightly (`opacity-60 hover:opacity-100`) so it doesn't visually compete with the name

### 3. No other files changed

ProfileCard already passes `displayName` and `username` separately to ProfileUserInfo. The upstream data fix in `transformToSafeProfile` will flow correctly through the existing `useViewedProfile` hook and ProfileCard component.

## Result

| Element | Before | After |
|---|---|---|
| Bold primary name | `rishabhsr` (username) | `Rishab Sr` (first + last) |
| Secondary text | `@rishabhsr` | `@rishabhsr` (unchanged) |
| Initials in avatar | `RI` (from username) | `RS` (from real name) |
| Name + edit alignment | Slightly off-center | Properly centered with balanced gap |

## Files Modified

| File | Change |
|---|---|
| `src/types/profile.ts` | Fix displayName priority (full name first), preserve actual username, fix initials priority |
| `src/components/profile/ProfileUserInfo.tsx` | Add gap spacing, reduce edit icon visual weight |

## What stays the same

- All validation, auth, and form logic unchanged
- ProfileEditForm unchanged
- Database schema unchanged -- this is presentation-only
- Fallback behavior preserved (username used when no real name exists)

