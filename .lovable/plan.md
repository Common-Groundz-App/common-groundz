# Fit mobile composer in one screen

## Problem
On mobile, opening the composer hides the bottom toolbar (image / emoji / more / visibility) below the fold. The user must scroll to discover it. Cause: the scrollable surface uses generous vertical padding and a tall body textarea designed for desktop, pushing the sticky bar off-screen on first paint.

## Goal
Bring the bottom toolbar into the initial viewport on mobile by tightening vertical rhythm. No structural or visual redesign — only padding/min-height tweaks scoped to mobile.

## Changes (mobile only — desktop untouched)

**File: `src/components/feed/EnhancedCreatePostForm.tsx`**

1. **Scroll surface padding (line 1009)**
   - Current: `py-5 md:pt-10 pb-16 md:pb-24`
   - New: `pt-3 md:pt-10 pb-2 md:pb-24`
   - Why: mobile uses a sticky bottom bar, so the `pb-16` runway is unnecessary — it just pushes the bar off-screen. Desktop keeps `md:pb-24` (the runway you asked for last turn) and `md:pt-10`.

2. **Body textarea min-height (line 1086)**
   - Current: `min-h-[140px]`
   - New: `min-h-[96px] md:min-h-[140px]`
   - Why: 140px on a ~640px mobile viewport eats most of the screen. 96px is enough for ~4 lines of placeholder; the textarea still auto-grows as the user types. Desktop unchanged.

## Out of scope
- No changes to top bar, entity pill, post-type pill, title field, suggested tags, add-details section, or bottom bar itself.
- No font-size, color, or component restructuring.
- Desktop layout untouched (all `md:` values preserved).

## Expected result
On a typical mobile viewport, first paint shows: entity pill → post-type pill → title → body → suggested tags → add details → sticky bottom toolbar — no scroll required. Scrolling still works normally as content grows.
