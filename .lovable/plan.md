# Premium pass — Tag entities modal

Visual-only refinement. No logic, hooks, search, ranking, or selection behavior changes. Only the `modal` variant of `UnifiedEntitySelector` and the `EntitySelectorModal` shell are touched. The `inline` variant (used in Explore) is **not** affected.

## Explicitly NOT changing
- Search input styling (the rounded hero pill stays exactly as it is).
- Section headers ("📚 Books", "📍 Places", etc.) — kept for cross-type disambiguation.
- Type icon on the right of each row — kept (will be quieted visually only).
- "Use my location" button — left as-is (current outline chip stays).
- `UnifiedEntitySelector` props, search hook, ranking pipeline, keyboard nav, recent searches, create-entity flow.

## Changes

### 1. Kill the "container-in-a-container" feel
File: `src/components/feed/composer/EntitySelectorModal.tsx`
- Reduce the wrapper div around `UnifiedEntitySelector` from `px-5 pt-4 pb-5` to `px-4 pt-3 pb-4` so the search input + results sit closer to the modal's edge.

File: `src/components/feed/UnifiedEntitySelector.tsx` (modal variant only — `isModal` branch)
- Remove the bordered card around the results list. Change line 624 from:
  - `'mt-3 w-full min-w-0 bg-background rounded-xl border border-border/60 max-h-[420px] overflow-y-auto overflow-x-hidden'`
  - to: `'mt-2 w-full min-w-0 max-h-[460px] overflow-y-auto overflow-x-hidden'`
  - Result: rows render flush against the modal's inner padding — no nested rounded box.
- Remove the `mx-1` and `rounded-lg` from `renderEntityRow` in modal mode so rows extend edge-to-edge. Hover becomes a flat full-width band (Reddit-style).

### 2. Slightly wider modal for breathing room
File: `src/components/feed/composer/EntitySelectorModal.tsx`
- `DialogContent` className: change `max-w-xl` → `max-w-2xl`. Keeps `w-[calc(100vw-2rem)]` so mobile is unaffected.

### 3. Bigger, more confident rows
File: `src/components/feed/UnifiedEntitySelector.tsx` — `renderEntityRow` modal branch
- Row padding: `px-4 py-3` → `px-4 py-3.5`.
- Avatar: `w-10 h-10 rounded-lg` → `w-11 h-11 rounded-lg`.
- Gap: `gap-3` → `gap-4`.
- Title: `text-[15px] font-medium` → `text-[15px] font-semibold` (stronger, Reddit-like).
- Secondary line: `text-xs text-muted-foreground` → `text-[13px] text-muted-foreground`. Single-line `truncate` stays.
- Type icon on the right: add `text-muted-foreground/60` (currently `text-muted-foreground`) so it reads as a quiet category badge instead of competing with the title.

### 4. Refine the header (centered alignment kept)
File: `src/components/feed/composer/EntitySelectorModal.tsx`
- `DialogHeader` padding: `px-6 pt-6 pb-2` → `px-6 pt-6 pb-3`.
- `DialogTitle`: `text-xl font-semibold tracking-tight` → `text-[22px] font-semibold tracking-tight` (slightly more presence).
- `DialogDescription`: keep copy, tighten with `max-w-md mx-auto leading-relaxed` so the subtitle wraps gracefully on the wider modal.

### 5. Section headers — quieter, more premium
File: `src/components/feed/UnifiedEntitySelector.tsx` — `renderSectionHeader`
- In modal mode, drop the muted background + bottom border (currently `bg-muted/30 border-b`) and use uppercase tracked-out micro-labels: `px-4 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70` with no background.
- Keep the existing emoji prefix in the title string ("📚 Books") — it already provides the type cue.
- Inline (Explore) variant keeps its current style — this branch only fires when `isModal` is true.

### 6. Vertical rhythm
- Add a 1px hairline divider (`border-t border-border/40`) **between sections** in modal mode (after the first section's rows, before the next section header). Implemented by adding a top border to the section header for all sections except the first visible one in `collapsed`.
- Spacing between selected-entity badges row and the search input stays at the existing `space-y-3`.

## Technical notes
- All conditionals route through the existing `isModal` flag — zero impact on inline/Explore usage.
- No prop changes, no new files, no dependency updates.
- Truncation chain (`flex-1 min-w-0` + `truncate`) remains; combined with the wider `max-w-2xl` and edge-to-edge rows, long names like "Isha Yoga Center, Mumbai (...)" will clamp cleanly without re-stretching the modal.

## Files touched
1. `src/components/feed/composer/EntitySelectorModal.tsx` — width, header refinement, wrapper padding.
2. `src/components/feed/UnifiedEntitySelector.tsx` — modal-variant row/header/results-container styling only.
3. `.lovable/plan.md` — replaced with this plan.

## Verification checklist
- Open composer → Select entities → modal opens centered, slightly wider, header centered.
- Empty state: search input + recent searches sit flush, no bordered inner card.
- Type "isha foundation": modal stays at `max-w-2xl`, rows truncate, header stays centered.
- Type "atomic habits": rows feel larger and bolder; type icon on right is muted.
- Section headers read as quiet uppercase labels with hairline dividers between sections.
- Explore page entity search (inline variant) is visually unchanged.
