# Add details polish — final plan

ChatGPT's suggestions overlap with the previous plan but add two genuine improvements worth adopting:

1. Use `text-foreground/80` for labels (slightly softer than pure `text-foreground`) — keeps labels important without making them shout.
2. Explicitly tune placeholder opacity to `/50` so placeholders are clearly quieter than labels.
3. Treat the empty Select value as a placeholder (muted), and only switch to normal foreground once a value is selected.

Final merged plan below. Scope is unchanged: copy + typography only, no layout/logic changes.

---

## 1. `src/components/feed/EnhancedCreatePostForm.tsx`

- Around line 1095: rename the hashtag section header from `Suggested` → `Suggested tags`.
- No other changes in this file.

## 2. `src/components/feed/composer/DynamicStructuredFields.tsx`

Apply a consistent typography hierarchy across all 5 field input types (rating, enum, yesno, textarea, text).

### Labels (all field types)
Replace current label className:

```
text-xs font-medium text-muted-foreground
```

with:

```
text-sm font-medium text-foreground/80
```

Keep existing `mb-1` / `mb-1.5 block` spacing as-is.

### Textarea + text inputs
- Add `placeholder:text-muted-foreground/50` to both the `<Textarea>` and the native `<input>` so placeholders are visibly lighter than labels.
- Keep input text color as the component default (`text-foreground` via shadcn) — user-entered text stays the strongest.

### Select (duration)
Change the `<SelectTrigger>` className from:

```
"h-8 text-sm"
```

to:

```
cn("h-8 text-sm", !value && "text-muted-foreground")
```

So "Select duration" reads as a placeholder; the selected option renders in normal foreground.

### Character counter
Update the two counter `<p>` tags from:

```
text-[10px] text-muted-foreground/50
```

to:

```
text-xs text-muted-foreground/60
```

Slightly more legible, still clearly tertiary.

### Yes/No pill buttons
No changes — current styling is already correct.

---

## Out of scope

- No card, border, background, or accent color around Add details.
- No changes to the collapsed "Add details · hint" trigger.
- No changes to field configs, labels copy, placeholders copy, or schema.
- No changes to post type pill, entity tag, body, or footer.
- No layout/spacing changes beyond what's listed above.

## Files touched

- `src/components/feed/EnhancedCreatePostForm.tsx` (1 line)
- `src/components/feed/composer/DynamicStructuredFields.tsx` (label className ×5, placeholder className ×2, SelectTrigger className, counter className ×2)
