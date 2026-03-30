

# Author Card Refinements — Match Entity Card Pattern

## Current State (from screenshot)

The author card currently stacks vertically: avatar + name/handle on one row, then bio, stats, joined date, and a full-width "Following" button at the bottom. Meanwhile, the entity card places its name and follow button **side by side** in a compact header row.

## Proposed Changes

### 1. Move Follow Button inline with name (match entity card pattern)

Restructure the author card header from:

```text
CURRENT:
[Avatar] [Name + @handle]
[bio]
[stats]
[joined]
[────── Following ──────]  ← full-width, bottom

PROPOSED:
[Avatar] [Name + @handle]  [Following]  ← inline, right-aligned
[bio]
[stats]
[joined]
```

This mirrors the entity card's `flex items-center justify-between` layout and removes the detached bottom button.

### 2. Use consistent `size="sm"` on FollowButton

The entity card passes `size="sm"` to its follow button. The author card currently uses the FollowButton's default size (which varies by mobile breakpoint). We'll force `size="sm"` in the sidebar context to match.

### 3. Additional polish suggestions

- **Remove full-width "View Profile" button for own profile** — replace with a subtle text link or remove entirely (the name already links to the profile)
- **Tighten vertical spacing** — the current `mt-3` on the follow button area becomes unnecessary when it moves inline

## Technical Details

**File:** `src/components/content/PostDetailSidebar.tsx` (AuthorCard, lines 311-378)

**Changes:**
1. Wrap the avatar + name row in `flex items-center justify-between` and place the FollowButton (or "View Profile" link) in the same row, right-aligned with `flex-shrink-0`
2. Pass a new `size` prop to FollowButton — add `size?: "sm" | "default"` to FollowButton's interface
3. Remove the separate `<div className="mt-3">` block that currently holds the follow button at the bottom

**File:** `src/components/profile/actions/FollowButton.tsx`

**Changes:**
1. Add optional `size` prop to interface (default: auto-detect via `useIsMobile`)
2. When `size` is explicitly passed, use it instead of the mobile breakpoint logic

## Summary

| Change | File |
|--------|------|
| Move follow button inline with avatar+name row | `PostDetailSidebar.tsx` |
| Add explicit `size` prop support | `FollowButton.tsx` |
| Remove bottom follow button block | `PostDetailSidebar.tsx` |

