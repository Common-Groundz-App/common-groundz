

# Username Cooldown UX Implementation (Final Plan)

## Problem

When users are in the 30-day username change cooldown period:
1. The username field appears editable
2. Users can type a new username  
3. Error only appears when they click "Save changes"
4. No indication of when they can change again

This is frustrating - users waste time editing only to be blocked at save time.

## Solution

Implement proactive cooldown UX that prevents frustration by showing restrictions **before** users attempt to save.

### Visual States

**Locked State (In Cooldown):**
```
Username
[ 🔒 linda_williamss                    ] (greyed out, disabled)
Username changes available: March 1, 2026
```

**Editable State (First Change or Cooldown Expired):**
```
Username  
[ @ new_username                         ]
3-20 characters. Letters, numbers, dots, and underscores only.
You can only change your username once every 30 days. Your old username will be permanently retired.
```

---

## Implementation Steps

### Step 1: Add Fields to Profile Types

**File: `src/types/profile.ts`**

Add `username_changed_at` and ensure `created_at` is included:

| Interface | Add Field |
|-----------|-----------|
| `BaseUserProfile` | `created_at: string \| null;` and `username_changed_at: string \| null;` |
| `SafeUserProfile` | `username_changed_at: string \| null;` |
| `transformToSafeProfile` | Pass through the new field |

---

### Step 2: Update Profile Service Queries

**File: `src/services/enhancedUnifiedProfileService.ts`**

Update select queries in two locations:

| Line | Current | Updated |
|------|---------|---------|
| 129 | `'id, username, avatar_url, first_name, last_name, bio, location'` | `'id, username, avatar_url, first_name, last_name, bio, location, created_at, username_changed_at'` |
| 305 | `'id, username, avatar_url, first_name, last_name, bio, location'` | `'id, username, avatar_url, first_name, last_name, bio, location, created_at, username_changed_at'` |

---

### Step 3: Create Cooldown Utility

**New File: `src/utils/usernameCooldown.ts`**

```typescript
const COOLDOWN_DAYS = 30;

export interface UsernameCooldownState {
  isLocked: boolean;
  nextChangeDate: Date | null;
  formattedNextChangeDate: string | null;
  isFirstChange: boolean;
}

export const calculateUsernameCooldown = (
  usernameChangedAt: string | null
): UsernameCooldownState => {
  // First change is always free
  if (!usernameChangedAt) {
    return {
      isLocked: false,
      nextChangeDate: null,
      formattedNextChangeDate: null,
      isFirstChange: true
    };
  }
  
  const lastChange = new Date(usernameChangedAt);
  const nextChange = new Date(lastChange);
  nextChange.setDate(nextChange.getDate() + COOLDOWN_DAYS);
  
  const now = new Date();
  const isLocked = now < nextChange;
  
  return {
    isLocked,
    nextChangeDate: isLocked ? nextChange : null,
    formattedNextChangeDate: isLocked 
      ? nextChange.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : null,
    isFirstChange: false
  };
};
```

---

### Step 4: Expose `usernameChangedAt` in useViewedProfile

**File: `src/hooks/use-viewed-profile.ts`**

| Change | Details |
|--------|---------|
| Add to interface | `usernameChangedAt: string \| null;` in `ViewedProfile` |
| Add to initial state | `usernameChangedAt: null` |
| Set from profile | `usernameChangedAt: profile.username_changed_at \|\| null` |
| Return value | Already returns `...profile_state` so it will be included |

---

### Step 5: Update ProfileCard to Pass Cooldown Data

**File: `src/components/profile/ProfileCard.tsx`**

Extract `usernameChangedAt` from the hook and pass to form:

```tsx
const { usernameChangedAt, createdAt, ...rest } = useViewedProfile(profileUserId);

<ProfileEditForm 
  // ... existing props
  usernameChangedAt={usernameChangedAt}
  profileCreatedAt={createdAt}
/>
```

---

### Step 6: Update ProfileEditForm with Cooldown-Aware UI

**File: `src/components/profile/ProfileEditForm.tsx`**

**6a. Add new props:**
```typescript
interface ProfileEditFormProps {
  // ... existing props
  usernameChangedAt: string | null;
  profileCreatedAt: string;
}
```

**6b. Add imports and calculate cooldown:**
```typescript
import { calculateUsernameCooldown } from '@/utils/usernameCooldown';
import { Lock, AlertTriangle, AtSign } from 'lucide-react';

// In component:
const cooldownState = calculateUsernameCooldown(usernameChangedAt);
```

**6c. Clear username error when locked (prevents blocking other edits):**
```typescript
// Add useEffect to reset username error when locked
useEffect(() => {
  if (cooldownState.isLocked) {
    setUsernameError('');
  }
}, [cooldownState.isLocked]);
```

**6d. Update username field rendering:**

```tsx
{cooldownState.isLocked ? (
  // LOCKED STATE
  <>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input 
        value={field.value}
        disabled
        className="pl-10 bg-muted cursor-not-allowed"
      />
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      Username changes available: {cooldownState.formattedNextChangeDate}
    </p>
  </>
) : (
  // EDITABLE STATE
  <>
    <div className="relative">
      <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input 
        placeholder="username" 
        {...field} 
        // ... existing onChange logic
        className={`pl-10 ${usernameError ? 'border-red-500' : ''}`}
      />
    </div>
    {/* Existing error display */}
    {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
    {isCheckingUsername && <p className="text-gray-500 text-xs mt-1">Checking username availability...</p>}
    
    {/* Format rules + static warning */}
    <p className="text-xs text-gray-500">
      3-20 characters. Letters, numbers, dots, and underscores only. Cannot start or end with dots/underscores.
    </p>
    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
      <AlertTriangle className="h-3 w-3" />
      You can only change your username once every 30 days. Your old username will be permanently retired.
    </p>
  </>
)}
```

**6e. Update save button to allow saving when username is locked:**
```typescript
<Button 
  type="submit" 
  disabled={(!!usernameError && !cooldownState.isLocked) || isCheckingUsername}
>
  Save changes
</Button>
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/types/profile.ts` | Add `created_at` and `username_changed_at` to interfaces and transform |
| `src/services/enhancedUnifiedProfileService.ts` | Add fields to two select queries |
| `src/utils/usernameCooldown.ts` | **NEW** - Centralized cooldown calculation |
| `src/hooks/use-viewed-profile.ts` | Add `usernameChangedAt` to interface, state, and data flow |
| `src/components/profile/ProfileCard.tsx` | Pass cooldown props to form |
| `src/components/profile/ProfileEditForm.tsx` | Cooldown-aware UI with locked/editable states |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Static warning (not dynamic banner) | Simpler, fewer edge cases, still sets expectations |
| Centralized cooldown logic in utility | Single source of truth, prevents drift |
| Allow form save when username locked | Users can still edit bio, location, name during cooldown |
| Always show warning when editable | Users know the consequence before they type |
| Disable field when locked | Follows Instagram/Discord/VRChat pattern |

---

## Testing

After implementing:

1. **Account that has never changed username:**
   - Username field should be editable
   - Static warning text should be visible below field

2. **Change username and save:**
   - Profile card updates immediately
   - Success toast appears

3. **Reopen edit form:**
   - Username field should be disabled/greyed out
   - Lock icon visible
   - Shows "Username changes available: [date 30 days from now]"
   - Bio, location, first/last name should still be editable

4. **Edit bio while username is locked:**
   - Bio change should save successfully
   - Form should not be blocked by username cooldown

