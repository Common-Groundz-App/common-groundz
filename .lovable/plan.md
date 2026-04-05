

# Refined "From Your Circle" Badge — Post Detail Comments (Final)

## Summary

Upgrade the subtle "From your circle" text to a proper outline badge with orange tones, but keep it restrained for comment readability. Incorporates all feedback: badge on top-level only, no orange border on replies, improved spacing, subtle hover, softer tones.

## Changes — `src/components/comments/CommentItem.tsx`

### 1. Add Badge import

Add `Badge` from `@/components/ui/badge` to existing imports.

### 2. Container className (lines 84-89)

Update to add left border for top-level circle comments only, keep replies neutral, and add subtle hover:

```tsx
className={cn(
  "relative group flex gap-3 p-3 rounded-lg transition-colors",
  isBeingEdited && "bg-muted/50",
  !isReply && comment.is_from_circle && "border-l-2 border-orange-300 hover:bg-orange-50/30 dark:hover:bg-orange-950/20",
  isReply && "pl-10 border-l-2 border-muted",
  isHighlighted && "bg-accent/50"
)}
```

Key decisions:
- Top-level circle comments get orange left border + subtle hover
- **All replies get neutral `border-muted`** — no orange, no visual competition
- Hover is `orange-50/30` (very subtle, not noisy)

### 3. Badge upgrade (lines 128-133)

Replace muted text with outline Badge, **only on top-level comments**:

```tsx
{comment.is_from_circle && !isReply && (
  <Badge variant="outline" className="ml-1 text-[11px] px-1.5 py-0 border-orange-300 text-orange-600 dark:text-orange-400 dark:border-orange-500 gap-0.5">
    <Users size={10} />
    From your circle
  </Badge>
)}
```

Key decisions:
- `!isReply` — badge only on top-level, replies stay clean
- `ml-1` for breathing room from timestamp
- `border-orange-300` (softer than 400) for premium feel
- Outline variant, not filled — readable without shouting

### Files Modified

| File | Change |
|---|---|
| `src/components/comments/CommentItem.tsx` | Import Badge, upgrade circle indicator to outline badge (top-level only), add subtle orange left border + hover for top-level circle comments, keep replies neutral |

