

# Unified Follow Button Polish

## 3 changes across 2 files

### 1. Profile FollowButton (`src/components/profile/actions/FollowButton.tsx`)

**Following idle** (line 26):
- Before: `bg-muted text-foreground hover:bg-muted/80`
- After: `bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15`

**Follow hover** (line 27):
- Before: `bg-brand-orange text-white hover:bg-brand-orange/90`
- After: `bg-brand-orange text-white hover:bg-brand-orange/90 hover:shadow-md`

### 2. EntityFollowButton (`src/components/entity/EntityFollowButton.tsx`)

**Following idle** (line 63):
- Before: `border-brand-orange text-brand-orange hover:bg-brand-orange/5`
- After: `border-brand-orange text-brand-orange bg-brand-orange/10 hover:bg-brand-orange/15`

**Unfollow hover** (line 63):
- Before: `border-red-500 text-red-500 hover:bg-red-50`
- After: `border-red-500 text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10`

### Result — unified system

| State | Profile Button | Entity Button |
|-------|---------------|---------------|
| Follow | Solid orange + shadow on hover | Orange outline → fills on hover |
| Following | Soft orange bg (`brand-orange/10`) | Orange outline + soft orange bg |
| Unfollow hover | Red outline (identical) | Red outline (identical) |

