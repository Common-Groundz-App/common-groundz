

# Unify Entity Unfollow Hover to Match Profile

## The Problem

The entity follow button uses `variant="outline"` on the `<Button>`, which applies base styles (`border border-input bg-background`) from the button component. These base styles partially override the red hover classes, making it look washed out compared to the profile button's clean red.

## The Fix

**File:** `src/components/entity/EntityFollowButton.tsx`

One change: when hovering in the "following" state (i.e., showing "Unfollow"), override the outline variant's base border color more explicitly and ensure the red is as strong as the profile button.

Current entity unfollow hover:
```
border-red-500 text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10
```

Updated entity unfollow hover — add `!border-red-500` (force override the outline variant's `border-input`) and add `hover:text-red-600` for stronger text on hover:
```
!border-red-500 text-red-500 bg-transparent hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10
```

This ensures the border turns fully red (not the muted `border-input` gray from the outline variant) and the text intensifies on hover, matching the profile button's crisp red unfollow appearance.

## What stays the same
- Profile FollowButton — no changes
- All other states (Follow, Following idle) — untouched
- The intentional style differences between entity (outline) and profile (solid) remain

