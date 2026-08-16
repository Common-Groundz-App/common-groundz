# Update the empty comments copy (wording only)

This is a copy-only change. The UI/medallion/vertical-space refinements will be handled in a follow-up pass after this wording is confirmed.

The current empty state reads:  
**"Start the conversation"**  
**"Be the first to share your thoughts or ask the author a question."**  

That wording is generic and feels like placeholder text. We want it to sound like Common Groundz — personal, specific to a "take", and aligned with the new "Share your take..." placeholder.

## What changes

1. **Replace the existing copy with the new wording in the empty comments branch.**

   ```
   No takes yet
   Tried it, used it, or curious? Share your take.
   ```

   - The first line is rendered as bold title.
   - The second line is rendered in muted text.
   - The same copy is used for both posts and recommendations (matching the user's request).

2. **Keep the existing icon medallion and spacing for now.** No structural or visual layout changes yet. Only the text inside the empty-state block is updated.

## Technical notes

- Single file: `src/components/comments/InlineCommentThread.tsx`, the `comments.length === 0` branch (currently lines ~752-765) plus the surrounding spacing wrappers.
- Remove the `MessageCircle` medallion markup from the empty branch only (the import stays if still used by the header).
- Copy stays conditional on `itemType` as it is today.
- Semantic tokens only (`text-muted-foreground`, `text-foreground`); no new colors.
- No changes to comment fetching, counts, or the composer logic.
