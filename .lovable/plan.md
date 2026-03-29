

# Fix: Top Row Click Isolation

## What's wrong
Line 349 has `onClick={e => e.stopPropagation()}` on the full-width outer `div` (`flex justify-between`). This swallows clicks on all empty space in the top row.

## Fix (single file, ~5 lines changed)

**`src/components/feed/PostFeedItem.tsx`**

1. **Line 349**: Remove `onClick={e => e.stopPropagation()}` from the outer row div
2. **Line 350**: Add `onClick={e => e.stopPropagation()}` to the avatar+username group div (`<div className="flex items-center gap-3">`)
3. **Lines 378-396**: Wrap the `DropdownMenu` block in `<div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>` (Codex's suggestion is valid — Radix dropdowns use pointer events)

## On the feedback

- **ChatGPT's suggestions**: All valid but already covered. Hover effect is already on the Card (line 341). Testing zones is good advice but not a code change.
- **Codex's `onPointerDown` addition**: Yes, adopt this. Radix UI (which powers shadcn DropdownMenu) uses pointer events internally. Adding `onPointerDown={e => e.stopPropagation()}` to the dropdown wrapper prevents edge-case bubbling.
- **Nothing else to add**. The fix is minimal and correct.

