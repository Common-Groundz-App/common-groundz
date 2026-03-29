

# Restyle Profile FollowButton — Revised Plan

## Strategy (ChatGPT-informed, with refinement)

Maintain **visual hierarchy** between Follow (primary action) and Following (passive state), rather than flattening everything to outline.

## Changes — `src/components/profile/actions/FollowButton.tsx`

### 1. Follow state (not following yet) — **keep solid orange**
- Keep as-is: `bg-brand-orange text-white hover:bg-brand-orange/90`
- This is a primary CTA, should feel strong

### 2. Following state (idle) — **replace grey with soft neutral**
- **Before:** `bg-gray-600 hover:bg-gray-700` (harsh grey block)
- **After:** `bg-muted text-foreground hover:bg-muted/80`
- Calm, theme-aware, works in both light and dark mode

### 3. Following state (hover → Unfollow) — **outlined red**
- **Before:** `bg-red-600 hover:bg-red-700` (solid red)
- **After:** `border border-red-500 text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10`
- Added `dark:` variant so the red hover background works in dark mode too

### 4. Button variant
- Change from default variant to `variant="outline"` only when in the "Following + hovering" state; otherwise keep default variant behavior
- Actually simpler: keep no variant prop, control everything via className as currently done

## Why this differs from EntityFollowButton
- **EntityFollowButton** = exploration context → outline style is appropriate (secondary action)
- **Profile FollowButton** = social context → solid Follow CTA + muted Following state preserves hierarchy

## File
| File | Change |
|------|--------|
| `src/components/profile/actions/FollowButton.tsx` | Update className for Following and hover-to-Unfollow states |

