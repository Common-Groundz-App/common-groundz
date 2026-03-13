

# Final Plan — ArrowUp Icon + Conditional Styling

ChatGPT's suggestion is correct. The conditional `cn()` pattern is cleaner than relying on `disabled:` pseudo-classes — it gives immediate visual feedback as the user types, matching Instagram/ChatGPT behavior. This is also what the original plan already had; ChatGPT is just confirming it.

Nothing to add. Ready to implement.

## Change — `src/components/comments/CommentDialog.tsx`

1. **Import**: Replace `Send` with `ArrowUp` in the lucide-react import
2. **Button**: Update icon and use conditional styling

```tsx
<Button
  size="icon"
  className={cn(
    "rounded-full h-8 w-8 flex-shrink-0 transition-colors",
    newComment.trim()
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "bg-muted text-muted-foreground"
  )}
  onClick={handleAddComment}
  disabled={!newComment.trim() || isSending}
>
  <ArrowUp size={16} className={isSending ? "animate-pulse" : ""} />
  <span className="sr-only">Post comment</span>
</Button>
```

One file, two edits.

