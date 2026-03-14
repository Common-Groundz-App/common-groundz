# Add Settings Gear Icon to Profile Card (Mobile/Tablet)

## Change

**File**: `src/components/profile/ProfileCard.tsx`

Add a Settings gear icon button positioned at the top-right corner of the profile card. It will:

- Only render when `isOwnProfile` is true
- Only be visible on mobile/tablet (`xl:hidden`) — the screens where bottom navigation is used
- Navigate to `/settings` on click
- Use Lucide's `Settings` icon with ghost styling, matching the existing edit button's visual treatment

**Placement**: Inside the `<Card>` element, as an absolutely positioned button at `top-right`, before the card content. This keeps it out of the flow and avoids cluttering the centered layout.

```tsx
{isOwnProfile && (
  <Link to="/settings" className="absolute top-4 right-4 xl:hidden z-10">
    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 hover:opacity-100">
      <Settings size={18} />
    </Button>
  </Link>
)}
```

Imports to add: `Settings` from `lucide-react`, `Link` from `react-router-dom`.