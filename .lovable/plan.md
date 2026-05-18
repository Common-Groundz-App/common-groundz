## Goal

Restore mobile horizontal padding on the Home feed header ("Home" / "Your personalized feed" / Create button) without touching the edge-to-edge post cards below.

## Root cause

In `src/pages/Feed.tsx`, the middle column wrapper (line 630) is `px-0 sm:px-4`, which correctly lets the post cards go edge-to-edge on mobile. But the header block at line 632 lives inside that same wrapper, so it also loses its mobile side padding and the text + Create button touch the screen edge.

## Change (single file, one line)

`src/pages/Feed.tsx`, line 632 — add mobile-only horizontal padding to the header block only:

```diff
- <div className="py-6 md:py-4 mb-2">
+ <div className="px-4 sm:px-0 py-6 md:py-4 mb-2">
```

That's it.

## What stays untouched

- Middle column wrapper `px-0 sm:px-4` — unchanged, so post cards stay edge-to-edge on mobile.
- Feed Tabs row (For You / Following) — unchanged.
- `EnhancedFeedForYou`, `FeedFollowing`, `FeedItem`, post card layout, media/collage edges — unchanged.
- Desktop / tablet (`sm:` and above) — `sm:px-0` cancels the mobile padding, so layout is identical to today.
- Right column, mobile top header bar, bottom nav — unchanged.

## Verification

- Mobile (<640px): "Home", "Your personalized feed", and Create button have ~16px side padding; post cards still touch screen edges.
- sm and above: no visual change.
