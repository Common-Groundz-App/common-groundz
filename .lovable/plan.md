# Fix: "Tag entities" modal stretches when results appear

## What's wrong

When you start typing in the "Tag entities" modal, results like *"Isha Yoga Center, Mumbai"* with the long venue line *"B-6, Theosophical Society, Juhu Tara Rd Near J. W. Marriott Juhu Mumbai Mah…"* appear. That row pushes the modal **wider than its `max-w-xl` cap**, which then:

- Shifts the centered header (`Tag entities` + subtitle) so it visually looks left-aligned (it's actually overflowing off the right edge of the viewport).
- Makes the row content bleed past the rounded modal frame.
- Makes the close `×` and other elements feel "incomplete."

## Root cause

The base `DialogContent` (in `src/components/ui/dialog.tsx`) is a CSS **grid** container (`grid w-full max-w-lg`). A grid item's default `min-width` is `auto`, which means a single long unbreakable line of text inside a grid child can **expand the track past `max-w-*`**. Our `EntitySelectorModal` overrides `max-w-xl` but inherits the same grid behavior — and the inner row's `truncate` never kicks in because its grid ancestor never tells it "you have a finite width."

In short: `truncate` needs a constrained parent, and the grid is letting the parent grow to fit the text.

## Fix (UI-only, no logic changes)

Two small, surgical edits — both pure CSS class adjustments.

### 1. `src/components/feed/composer/EntitySelectorModal.tsx`

On the `<DialogContent>` wrapper, add **width-locking utilities**:
- `w-[calc(100vw-2rem)]` — never exceed viewport minus a small gutter (mobile safety).
- `min-w-0` — kill the grid auto-min-width so children can't push it wider.

Result: modal stays exactly at `max-w-xl` on desktop and snaps to viewport-minus-gutter on mobile, no matter what's inside.

### 2. `src/components/feed/UnifiedEntitySelector.tsx`

Two row-level tweaks so long venue addresses truncate cleanly inside the locked modal:

- The outer wrapper of each `renderEntityRow` row (the flex container) gets `min-w-0` so its flex children can shrink below their content size.
- The "results" container (`mt-3 bg-background rounded-xl …` for the modal variant) gets `w-full min-w-0` so it can't push the modal wider either.

No changes to search logic, ranking, selection, recents, or the inline (Explore) variant.

## Visual outcome

````text
Before (broken):                  After (fixed):
┌───────────── modal ───────────────────────►   ┌─────── modal (xl) ────────┐
│  Tag entities (left-shifted)            │     │       Tag entities         │
│                                         │     │   Search for places…       │
│  🔍  isha                               │     │   🔍  isha                 │
│  Isha Yoga Center, Mumbai (Yoga Cla…    │     │   Isha Yoga Center, Mum…   │
│  B-6, Theosophical Society, Juhu Tara…  │     │   B-6, Theosophical Soc…   │
└─────────────────────────────────────────►     └────────────────────────────┘
        ^ overflows viewport                          ^ stays within max-w-xl
````

## Files touched

- `src/components/feed/composer/EntitySelectorModal.tsx` — add `w-[calc(100vw-2rem)] min-w-0` to `DialogContent` className.
- `src/components/feed/UnifiedEntitySelector.tsx` — add `min-w-0` to the row wrapper and `w-full min-w-0` to the modal-variant results container.

That's it — no behavior, no copy, no other surfaces affected.
