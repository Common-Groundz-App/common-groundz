

# Add Bottom Padding for Mobile on Settings Page

The Settings page root div is missing the bottom padding that other pages (Feed, MyStuffPage) use to account for the fixed bottom navigation bar.

## Change

**File**: `src/pages/Settings.tsx` (line 187)

Change the root div from:
```tsx
<div className="min-h-screen flex flex-col">
```
to:
```tsx
<div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0">
```

This matches the exact pattern used by Feed.tsx and MyStuffPage.tsx — adds bottom padding on mobile/tablet to prevent content from being hidden behind the fixed bottom navigation, and removes it on desktop (`xl:pb-0`) where the sidebar is used instead.

