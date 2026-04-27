# Step 1: Refine the Entity Selector

Polish only the entity selector pill on `/create`. Nothing else on the page changes. First step in a planned series (entity → title → post type & tags → spacing).

## The problem with the current pill

The empty-state pill in `EntityHeroPill.tsx`:
- Spans full width like an input field
- Uses a **dashed border** which reads as "placeholder / not yet filled in"
- Says "Tag entities (optional but recommended)" — long, hedge-y, and the parenthetical makes it feel skippable
- Uses muted grey text on a faint background, so it visually disappears

The selected-state chips look like a different component — tiny grey outlined badges with no relation to the empty pill. The two states feel disconnected.

## Principle

Borrow Reddit's **shape and restraint** (compact left-aligned pill, solid border, single clear action), but keep slightly more visual weight than Reddit because for us entity tagging is **optional but central to the product**. Reddit can be ultra-minimal because community selection is mandatory; we cannot.

We are *not* copying Reddit pixel-for-pixel. We are adopting the pattern.

## Microcopy decision

Label: **"Select entities ⌄"**

- "Select" (not "Add" or "Tag") signals seriousness — the user is picking from a real set of products/places/books, not casually tagging
- No "(optional but recommended)" hedge text
- No helper subtitle below the pill — the whole point of the redesign is removing visual noise; a label-plus-helper-text pattern would re-introduce the form-field feel we are killing
- "entities" is internal jargon but stays for now: matches the modal title, matches how the rest of the app refers to them, and is what you prefer. Can be revisited later based on real usage.

## What the pill will look like

**Empty state** — compact pill, left-aligned, sized to its content (not full width):

```text
[ 🏷  Select entities  ⌄ ]
```

- Solid 1px border using `border-border` (no dashed)
- Background: `bg-background` with `hover:bg-accent/40`
- Text: `text-foreground` (darker than current `text-muted-foreground`), `font-medium`
- Padding: `px-3.5 py-1.5`, `rounded-full`
- Tag icon on left, chevron on right, both at small size
- Sits inline at natural width — does **not** stretch to fill the row

**Selected state** — same pill family, just filled with chips:

- Each entity chip uses the same height, radius, and border treatment as the empty pill so they read as one component family
- Chip background gets a **very subtle primary tint** (`bg-primary/5` with `border-primary/20`) so selected entities feel like a small win, not a grey afterthought
- Entity icon + name + small `×` remove button (same logic as today)
- "+ Add more" becomes a matching ghost pill (same height/radius, dashed-free) instead of a tiny text link, so it visually belongs to the row

Both states share: same height (~32px), same `rounded-full`, same border weight. Switching between them feels like the pill *filling up*, not swapping for a different component.

## What is explicitly NOT changing in this step

- The modal that opens (`EntitySelectorModal` + `UnifiedEntitySelector`) — untouched
- All entity selection logic, `@` mention handling, max-3 limit, autofocus behavior — untouched
- The title field, body field, suggested hashtags, "Post type & tags" button, "Add details" link, top bar, bottom bar — untouched
- Any other page on the app — untouched
- No helper text added below the pill

This is purely a visual refinement of `EntityHeroPill.tsx`.

## Files touched

- `src/components/feed/composer/EntityHeroPill.tsx` — rewrite the empty-state and selected-state markup with new classes and label. No prop changes, no logic changes, no parent component edits needed.

## After approval

You review in preview. If it looks right, we move to Step 2 (Title prominence). If it needs another nudge (tint too strong, label tweak, etc.), we iterate on just this pill before moving on.
