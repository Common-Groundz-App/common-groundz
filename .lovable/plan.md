## Problem

When searching terms like "isha foundation" in the "Tag entities" modal, results contain very long unbroken strings (e.g. "Isha Yoga Center, Mumbai (Yoga Classes designed by Sadhguru)"). The modal stretches horizontally past `max-w-xl`, which left-aligns the header and pushes the close button off-screen. Shorter results (like "atomic habits") don't trigger the bug, which is why the previous fix appeared to work.

## Root cause

The base `DialogContent` (in `src/components/ui/dialog.tsx`) uses `grid` for layout. CSS grid items default to `min-width: auto`, which sizes grid tracks to the **min-content** of their children. The previous fix added `min-w-0` to `DialogContent` itself (the grid container), but this does **not** propagate to the implicit grid tracks. The direct grid children (`DialogHeader` and the `<div>` wrapping `UnifiedEntitySelector`) still report their min-content width, so a long unbreakable result row inflates the entire dialog beyond `max-w-xl`.

The truncation chain (`renderEntityRow` → `flex-1 min-w-0` → `truncate`) is correct in isolation, but it only kicks in **after** the grid track has already been sized by min-content of the longest text node.

## Fix

Add `min-w-0` to the direct children of `DialogContent` inside `EntitySelectorModal.tsx` so each grid track collapses to the available width and the inner truncate logic actually clamps long names.

### File: `src/components/feed/composer/EntitySelectorModal.tsx`

1. Add `min-w-0` to `DialogHeader` (it is a direct grid child).
2. Add `min-w-0` to the `<div className="px-5 pt-4 pb-5">` wrapper (also a direct grid child).

No changes to `UnifiedEntitySelector.tsx` — its truncation classes are already correct and will start working once the grid tracks no longer blow out.

No logic changes. Pure CSS fix.

## Verification

After the change, searching "isha foundation" should keep the modal width pinned to `max-w-xl`, header centered, close button visible, and the long venue name should truncate with an ellipsis inside the result row.
