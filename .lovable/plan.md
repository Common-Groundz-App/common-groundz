# Step 4 — Desktop composer cleanup (Cancel next to Post)

Polish the desktop create-post layout to match the Reddit reference: remove the floating top `X` and its divider line, and put a labeled `Cancel` button immediately to the left of `Post` in the bottom action row. **Mobile composer stays exactly as it is today** (sticky top bar with X + Post is preserved).

No logic changes — only UI. The new `Cancel` button reuses the existing close handler, so the unsaved-changes "Discard draft?" dialog continues to fire correctly.

---

## Visual change (desktop only, ≥ md)

Before:
```text
┌──────────────────────────────────┐
│  X                               │  ← icon button
│ ──────────────────────────────── │  ← divider
│  Share an experience             │
│  [Select entities ▾]             │
│  Title…                          │
│  …                               │
│  [🖼 😊 ⋯]            [Public] [Post] │
└──────────────────────────────────┘
```

After:
```text
┌──────────────────────────────────┐
│  Share an experience             │  ← clean, no X, no divider
│  [Select entities ▾]             │
│  Title…                          │
│  …                               │
│  [🖼 😊 ⋯]   [Public] [Cancel] [Post] │
└──────────────────────────────────┘
```

Mobile (< md): unchanged. The sticky `ComposerTopBar` continues to render `X` (left) and `Post` (right).

---

## Scope (one file)

`src/components/feed/EnhancedCreatePostForm.tsx`

1. **Remove the desktop top-bar block** (lines 995–1007): the `<div className="hidden md:flex … border-b …">` that wraps the desktop `X` button. Delete the whole wrapper. The `h1` "Share an experience" heading directly below it stays and becomes the new top of the desktop column.

2. **Add a `Cancel` button to the desktop bottom action row** (around lines 1371–1390), inserted **between** the visibility `Select` and the `Post` button.
   - `variant="ghost"`, `size` matching Post (`h-9 px-4 rounded-full`), text `Cancel`.
   - `onClick={handleCloseRequest}` — same handler the removed X used, so the unsaved-changes guard (`DiscardDraftDialog`) still fires.
   - `disabled={isSubmitting}` so it can't be clicked mid-post.
   - In edit mode the label stays `Cancel` (Reddit pattern; matches the existing `Update` button on the right).

3. **No changes** to:
   - `ComposerTopBar.tsx` (mobile-only, already `md:hidden`)
   - `ComposerBottomBar.tsx` (mobile-only, already `md:hidden`)
   - Submit logic, dirty-check logic, draft autosave, keyboard shortcuts, or any handler implementations.

---

## Acceptance check

- Desktop (≥ md, viewport like 1202 px): no `X` icon, no divider line under it; heading "Share an experience" is the first visible element in the centered column. Bottom-right reads `[Public ▾] [Cancel] [Post]`. Clicking `Cancel` with unsaved content opens the discard-confirmation dialog; clicking it on an empty form closes immediately.
- Mobile (< md): identical to today — sticky top bar with `X` (left) and `Post` (right), bottom toolbar with media/emoji/more + visibility pill.
- Edit mode: same change; right-side button still reads `Update`, left of it now says `Cancel`.
