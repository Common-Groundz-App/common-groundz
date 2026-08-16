# Polish the comments section (UI + wording audit)

## What looks unprofessional today

From the screenshot: a large grey circle medallion floating in ~180px of empty space, the copy centered far below the header, and a hard divider separating it from the composer. The empty state is the loudest thing on screen, while the composer (the thing we want tapped) is the quietest.

## UI changes

1. **Remove the grey medallion.** It adds no information and reads as a placeholder. The header already has a MessageCircle icon.
2. **Collapse the vertical space.** `py-10` → `py-6`, and let the block sit directly under the header instead of being vertically centered in a tall box.
3. **Left-align the empty copy** so it lines up with the header and the composer avatar column. Centered text in a left-aligned feed layout is what makes it feel generic.
4. **Lift the composer above the empty state** in the zero-comments case: composer first, then the quiet one-line hint below it. On a thread with zero takes the invitation should be the primary element.
5. **Soften the divider** in the empty case (`border-t` on the composer only when comments exist) so we don't draw a line across an empty area.
6. **Header polish:** count as a muted pill/plain number without parentheses (`Comments · 0` or just hide `(0)` when empty), same 5px icon size, no layout change otherwise.

Net effect: the section shrinks from a tall empty box to a compact header + composer + one hint line.

## Wording: is "Comments" right?

Where the word appears in user-facing copy today:
- `InlineCommentThread.tsx`: section header "Comments", toasts "Comment added / updated / deleted", "Delete Comment?", "Couldn't load comments.", "That comment is no longer available."
- `CommentDialog.tsx`: same toast/dialog set.
- `CommentItem.tsx`: "[Comment deleted]", "Edit your comment..."
- `CommentsPreview.tsx`: "No comments yet. Add one!"
- Feed/post cards: comment count labels.

Recommendation: **keep "Comments" as the structural label** (header, toasts, delete confirm, aria labels). It is the word users scan for, and it matches counts in the feed. Use the brand voice ("take") only in *invitations* — the composer placeholder and the empty state — which is already the case. Mixing "Takes" into the header would force renaming counts everywhere and reads as jargon on first visit.

One consistency fix in scope: `CommentsPreview.tsx` still says "No comments yet. Add one!" — change to "Share your take..." so every entry point uses one invitation voice.

## Technical notes

- `src/components/comments/InlineCommentThread.tsx`: the `comments.length === 0` branch (medallion + padding + alignment), the header block, and the ordering of composer vs empty state in the zero-comments case.
- `src/components/comments/CommentsPreview.tsx`: one string.
- Semantic tokens only (`text-foreground`, `text-muted-foreground`, `bg-muted`). No changes to fetching, counts, sorting, docking/keyboard logic, or the reply composer.
