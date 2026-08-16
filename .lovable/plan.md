# Empty comments state: center-aligned polish

## Current state

The empty comments state is left-aligned (`py-6 text-left`) with two lines:

- **No takes yet**
- Tried it, used it, or curious? Share your take.

This is a compact, minimal look. The user wants it to feel more like the empty states on Instagram/Twitter, which are typically centered.

## Proposed changes

### 1. Re-align the empty state copy to center

Change the empty state container from `text-left` to `text-center`.

- Keep the same compact vertical padding (`py-6`) so it does not dominate the screen.
- Keep the two-line copy exactly as-is.

Current:

```tsx
<div className="py-6 text-left">
  <p className="text-sm font-medium text-foreground mb-1">No takes yet</p>
  <p className="text-xs text-muted-foreground">
    Tried it, used it, or curious? Share your take.
  </p>
</div>
```

Target:

```tsx
<div className="py-6 text-center">
  <p className="text-sm font-medium text-foreground mb-1">No takes yet</p>
  <p className="text-xs text-muted-foreground">
    Tried it, used it, or curious? Share your take.
  </p>
</div>
```

### 2. Add a subtle icon for visual balance (optional but recommended)

A very small, low-contrast icon above the text makes the empty state feel intentional rather than like a stray text block. Suggest a small `MessageCircle` at `h-4 w-4` in `text-muted-foreground/60` — not a large medallion.

```tsx
<div className="py-6 text-center">
  <MessageCircle className="h-4 w-4 text-muted-foreground/60 mx-auto mb-2" />
  <p className="text-sm font-medium text-foreground mb-1">No takes yet</p>
  <p className="text-xs text-muted-foreground">
    Tried it, used it, or curious? Share your take.
  </p>
</div>
```

### 3. Keep the composer immediately below

The empty state should stay small so the user's eye falls naturally to the composer input below. No extra cards, boxes, or buttons.

## In scope

- `src/components/comments/InlineCommentThread.tsx`: empty state layout and optional icon.

## Out of scope

- Composer behavior, keyboard docking, or placeholder text.
- Comments with existing replies.
- Other pages or surfaces.

## Verification

- Empty state is centered and compact.
- Copy still reads: **No takes yet** / *Tried it, used it, or curious? Share your take.*
- No visual regression on existing comments.
- Build passes.
