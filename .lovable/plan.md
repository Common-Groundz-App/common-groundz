# Make the empty comments state feel intentional

The current empty state is a generic grey circle icon, a bold line, and two lines of explanatory copy — plus a large block of dead vertical space between the post and the "Comments (0)" header. On a phone it reads like a placeholder rather than part of the product.

## What changes

1. **Drop the grey icon medallion.** The circular muted bubble is the most generic element on screen and duplicates the icon already shown next to the "Comments" header.

2. **Replace it with a single quiet invitation line, aligned with the composer.** Instead of a centered hero block, show a left-aligned, one-line prompt directly above the composer:
   - Posts: "No takes yet — be the first."
   - Recommendations: "No takes yet — share your experience."
   
   Small, muted, in brand voice, and consistent with the "Share your take..." placeholder we just shipped. This keeps the eye moving toward the input instead of at an empty medallion.

3. **Collapse the empty vertical space.** Reduce the empty-state block from `py-10` to a tight padding, and remove the extra gap/divider stack above the "Comments (0)" header so the composer sits close to the post when there is nothing to read.

4. **Keep the composer as the visual anchor.** With no comments, the composer is the only actionable thing in the section, so it should be the largest and closest element to the prompt.

Loading, error, and populated states are untouched.

## Technical notes

- Single file: `src/components/comments/InlineCommentThread.tsx`, the `comments.length === 0` branch (currently lines ~752-765) plus the surrounding spacing wrappers.
- Remove the `MessageCircle` medallion markup from the empty branch only (the import stays if still used by the header).
- Copy stays conditional on `itemType` as it is today.
- Semantic tokens only (`text-muted-foreground`, `text-foreground`); no new colors.
- No changes to comment fetching, counts, or the composer logic.
