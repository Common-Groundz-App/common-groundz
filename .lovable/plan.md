

# Fix: Hide Bottom Navigation for Guests in EntityV4

The previous changes missed one file. `src/components/entity-v4/EntityV4.tsx` (line 644) still renders `<BottomNavigation />` unconditionally — no `user &&` guard.

This is the entity page component the user is seeing the bottom nav on as a guest.

## Change

**File**: `src/components/entity-v4/EntityV4.tsx`

1. Import `useAuth` from `@/contexts/AuthContext` (if not already imported)
2. Destructure `user` from `useAuth()` inside the component
3. Line 644: change `<BottomNavigation />` to `{user && <BottomNavigation />}`

