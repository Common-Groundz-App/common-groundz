

# Add Bottom Navigation Spacing to Entity V4 Page

## Problem
The Entity V4 page (`src/components/entity-v4/EntityV4.tsx`) is missing the standardized bottom padding used by Feed, My Stuff, and Settings pages, causing content to be obscured by the fixed bottom navigation bar on mobile/tablet.

## Change — `src/components/entity-v4/EntityV4.tsx`

**Line 487**: Add `pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0` to the root div.

```
// Before
<div className="min-h-screen flex flex-col bg-background">

// After
<div className="min-h-screen flex flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0">
```

One-line change, consistent with all other pages.

