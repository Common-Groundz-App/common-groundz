

# Fix: Profile Card Not Updating After Username Change (Final)

## Problem

When you change your username from "linda_williams" to "linda_williamss", the database updates successfully but the profile card and edit form still show the old username due to stale React Query cache.

## Root Cause

`useViewedProfile` uses `useProfile(userId)` with a 5-minute cache. After saving in `ProfileEditForm`, the cache is never invalidated for the profile page.

## Solution (Streamlined)

Based on feedback, we'll implement the core fix without over-engineering:

### Changes Required

**1. `src/components/profile/ProfileEditForm.tsx`**
- Add cache invalidation after successful save
- Attach userId to `profile-updated` event for targeted invalidation

```typescript
// Add import
import { useProfileCacheActions } from '@/hooks/use-profile-cache';

// In component
const { invalidateProfile } = useProfileCacheActions();

// In onSubmit, after successful database update:
if (user?.id) {
  invalidateProfile(user.id);
}

// Update the event dispatch to include userId:
window.dispatchEvent(new CustomEvent('profile-updated', { 
  detail: { userId: user.id } 
}));
```

**2. `src/hooks/use-viewed-profile.ts`**
- Add listener for `profile-updated` event with userId check
- Only invalidate if the event matches the profile being viewed

```typescript
// Add import
import { useProfileCacheActions } from '@/hooks/use-profile-cache';

// In hook
const { invalidateProfile } = useProfileCacheActions();

// Add useEffect for profile-updated event
useEffect(() => {
  const handleProfileUpdated = (event: CustomEvent) => {
    const eventUserId = event.detail?.userId;
    // Only invalidate if this is the profile we're viewing
    if (viewingUserId && (!eventUserId || eventUserId === viewingUserId)) {
      invalidateProfile(viewingUserId);
    }
  };
  
  window.addEventListener('profile-updated', handleProfileUpdated as EventListener);
  return () => window.removeEventListener('profile-updated', handleProfileUpdated as EventListener);
}, [viewingUserId, invalidateProfile]);
```

## What We're NOT Doing (and why)

| Feature | Decision | Reason |
|---------|----------|--------|
| Optimistic cache updates | DEFERRED | Adds complexity; invalidate+refetch is fast enough |
| New `setProfileCache` method | SKIPPED | Not needed since we're using invalidation only |

## Summary of Changes

| File | Change |
|------|--------|
| `ProfileEditForm.tsx` | Add `invalidateProfile(user.id)` after save, attach `userId` to event |
| `use-viewed-profile.ts` | Add `profile-updated` event listener with userId check |

## Why This Approach

1. **Fixes the bug** - Cache invalidation ensures fresh data
2. **Future-proof** - Event listener handles updates from any source
3. **Safe** - No risk of key mismatches (using existing `invalidateProfile`)
4. **Simple** - No optimistic updates or complex cache manipulation
5. **Targeted** - userId in event prevents invalidating wrong caches

## Testing

After implementing:
1. Go to profile page
2. Click pencil icon → Edit Profile
3. Change username (e.g., "linda_williams" → "linda_williamss")
4. Click "Save changes"
5. Profile card should immediately show new username
6. Re-opening Edit Profile should show new username

