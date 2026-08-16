# Update the empty comments copy (wording only)

This is a copy-only change. The UI/medallion/vertical-space refinements will be handled in a follow-up pass after this wording is confirmed.

The current empty state reads:  
**"Start the conversation"**  
**"Be the first to share your thoughts or ask the author a question."**  

That wording is generic and feels like placeholder text. We want it to sound like Common Groundz — personal, specific to a "take", and aligned with the new "Share your take..." placeholder.

## What changes

1. **Drop the grey icon medallion.** The circular muted bubble is the most generic element on screen and duplicates the icon already shown next to the "Comments" header.

2. **Replace the copy with a warmer, two-line invitation.** Keep it centered but remove the icon and the bold heading. Use the exact wording the user requested for both posts and recommendations:

   ```
   No takes yet
   Tried it, used it, or curious? Share your take.
   ```

   The first line is bold, the second line is muted, both in a single compact block. No separate icon, no medallion.

3. **Collapse the empty vertical space.** Reduce the empty-state block from `py-10` to a tight padding, and remove the extra gap/divider stack above the "Comments (0)" header so the composer sits close to the post when there is nothing to read.

4. **Keep the composer as the visual anchor.** With no comments, the composer is the only actionable thing in the section, so it should be the largest and closest element to the prompt.

Loading, error, and populated states are untouched.

## Technical notes

- Single file: `src/components/comments/InlineCommentThread.tsx`, the `comments.length === 0` branch (currently lines ~752-765) plus the surrounding spacing wrappers.
- Remove the `MessageCircle` medallion markup from the empty branch only (the import stays if still used by the header).
- Copy stays conditional on `itemType` as it is today.
- Semantic tokens only (`text-muted-foreground`, `text-foreground`); no new colors.
- No changes to comment fetching, counts, or the composer logic.
