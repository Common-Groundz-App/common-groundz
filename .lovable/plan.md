

# Refine Author Card — Identity-First Polish

## Changes (1 file only)

**File:** `src/components/content/PostDetailSidebar.tsx` — AuthorCard section (lines 311-378)

### 1. Name prominence (highest ROI)
Pass a className to `UsernameLink` to override the default `text-sm font-semibold` with `text-lg font-bold` — making the display name the most visually dominant element in the card.

```tsx
<UsernameLink
  userId={userId}
  username={profile.username}
  displayName={profile.displayName}
  showHandle={true}
  className="[&>a:first-child]:text-lg [&>a:first-child]:font-bold"
/>
```

### 2. Avatar presence
Add ring and shadow to ProfileAvatar for a lifted, identity-anchor feel:

```tsx
<ProfileAvatar userId={userId} size="md" className="ring-2 ring-background shadow-sm" />
```

### 3. Follow button — full-width + spacing
Change `mt-3` to `mt-4` and force the child button full-width using a wrapper class. This creates clear Info → Action separation:

```tsx
<div className="mt-4 [&>button]:w-full">
  <FollowButton ... />
</div>
```

### 4. View Profile button spacing
Match the same `mt-4` spacing on the "View Profile" button (currently `mt-3`).

## What stays untouched
- Entity card — no changes
- FollowButton component — no changes
- UsernameLink component defaults — no changes
- All other pages/components — no changes

