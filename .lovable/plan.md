# Step 2: Anchor composer actions to content (desktop), keep sticky bars (mobile)

Make the composer feel like a centered card on desktop and an action-anchored sheet on mobile. No identity changes in this step (next step).

## Principle

> Anchor actions to content, not viewport.

- Desktop (≥ md): X and Post live **inside** the centered `max-w-2xl` column. Toolbar (media, emoji, more, visibility, Post) sits at the bottom of that column. No full-width sticky bars.
- Mobile (< md): Keep current sticky `ComposerTopBar` and `ComposerBottomBar` for thumb-reachable actions and keyboard-friendly behavior.

Identity row ("Hana Li") is **not** touched here — that's Step 3.

## What changes

### 1. `src/components/feed/composer/ComposerTopBar.tsx`
Wrap the returned root element with `md:hidden` so the sticky top bar only renders on mobile. No prop changes.

### 2. `src/components/feed/composer/ComposerBottomBar.tsx`
Wrap the returned root element with `md:hidden` so the sticky bottom toolbar only renders on mobile. No prop changes.

### 3. `src/components/feed/EnhancedCreatePostForm.tsx`
Add a desktop-only inline header and inline footer **inside** the existing centered content column (the same `max-w-2xl` wrapper that already centers the form body). Reuse all existing handlers and state — no new logic.

**Desktop inline header** (rendered `hidden md:flex`, at the top of the content column, above the title field):
- Left: `X` ghost icon button → calls `handleCloseRequest`
- Right: empty (Post button moves to footer)
- Light `border-b border-border` separator, `py-2`

**Desktop inline footer** (rendered `hidden md:flex`, at the bottom of the content column, below everything else including the structured-fields collapsible):
- `border-t border-border pt-3 mt-4 flex items-center justify-between gap-2`
- Left cluster (reuse the exact same controls already wired into `ComposerBottomBar`):
  - `MediaUploader` trigger button (Image icon + count)
  - Emoji ghost button (toggles `emojiPickerVisible`, renders `emojiPickerNode` in a relative wrapper — same pattern already used)
  - `MoreToolsPopover` (location, etc.)
- Right cluster:
  - Visibility `Select` pill (same Public / Only Me / Circle Only options, same icons/labels)
  - Primary **Post / Update** button → calls `handleSubmit`, same disabled rule (`(!content.trim() && media.length === 0) || isSubmitting`), same `submitPulse` styling, same brand-orange treatment

Both inline clusters use the same JSX/icons that already exist in `ComposerBottomBar` and `ComposerTopBar` — copied inline so we don't have to refactor the bar components into shared primitives this round. (We can extract shared sub-components later if it becomes painful; for one duplication it's not worth the abstraction tax.)

The mobile sticky bars continue to render the Post button in the top bar and the toolbar at the bottom — mobile UX unchanged.

## Visual outcome

Desktop:

```text
┌──────────────────────────────┐  ← max-w-2xl centered column
│ X                            │  ← inline header (border-b)
│                              │
│ Title (large)                │
│ Body…                        │
│ [Select entities ⌄]          │
│ [Post type & tags]           │
│ Add details ⌄                │
│ ──────────────────────────── │  ← border-t
│ 🖼  😊  ⋯       [Public ⌄] [Post] │  ← inline footer
└──────────────────────────────┘
```

Mobile: unchanged — sticky `X … Post` top bar + sticky bottom toolbar.

## What is explicitly NOT changing

- Identity ("Hana Li") line — Step 3
- Title field styling — later step
- Post type & tags pill — later step
- Entity pill (already done in Step 1) — untouched
- All handler logic, state, draft/autosave, hashtag processing, submit flow — untouched
- Mobile layout — untouched

## Files touched

- `src/components/feed/composer/ComposerTopBar.tsx` — add `md:hidden` wrapper class
- `src/components/feed/composer/ComposerBottomBar.tsx` — add `md:hidden` wrapper class
- `src/components/feed/EnhancedCreatePostForm.tsx` — add desktop-only inline header (X) above the form and inline footer (toolbar + visibility + Post) below the form, both inside the existing centered column

## After approval

You review on desktop (current viewport 1202px) and mobile preview. If layout reads right, we move to Step 3 (identity row cleanup — desktop removes "Hana Li", mobile gets a compact avatar+name row).
