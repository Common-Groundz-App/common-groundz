# Polish the empty comments section (UI + wording audit)

## What looks unprofessional today

From the screenshot: a large grey circle medallion floating in ~180px of empty space, centered copy, and a hard divider above the composer. The empty state is the loudest thing on screen, while the composer (the thing we want tapped) is the quietest.

## UI changes

1. **Remove the big grey medallion.** It is redundant with the header icon and makes the empty state feel like a placeholder.
2. **Reduce vertical padding.** `py-10` → `py-6` so the empty state sits compactly under the header.
3. **Left-align the empty copy** so it lines up with the header and the composer. Centered text in a left-aligned feed is what makes it feel generic.
4. **Keep the order: header → compact empty hint → composer.** The copy gives context first, then the composer becomes the natural action.
5. **Soften the divider in the empty state.** Draw the separator only when there are existing comments so the composer does not feel disconnected from an empty section.
6. **Header count polish.** Show the count as `Comments · 0` when comments exist; hide the zero count when empty (`Comments`) so the header is not cluttered on a fresh post.

Net effect: the section shrinks from a tall generic empty box to a compact header + one-line hint + composer.

## Wording: keep "Comments" as structural label

User-facing "comment" occurrences today:
- `InlineCommentThread.tsx`: header "Comments", toasts, delete dialog, error text.
- `CommentDialog.tsx`: same structural set.
- `CommentItem.tsx`: "[Comment deleted]", "Edit your comment...".
- `CommentsPreview.tsx`: "No comments yet. Add one!".
- Feed/post cards: comment counts.

Recommendation: **keep "Comments" for system/structural language** (header, toasts, dialog, aria labels). It is the word users scan for, and it matches counts across the app. Use the brand voice ("take") only in *invitations* — the composer placeholder and the empty state — which is already the case.

One consistency fix: change `CommentsPreview.tsx` from "No comments yet. Add one!" to "Share your take..." so every entry point uses the same invitation voice.

## In scope

- `src/components/comments/InlineCommentThread.tsx`:
  - header count display
  - empty state copy and layout
  - divider visibility in empty state
- `src/components/comments/CommentsPreview.tsx`: empty-state string.

## Out of scope

- Composer docking/keyboard behavior
- Bottom navigation
- Reply/edit/delete behavior
- Backend fetching/sorting/RLS
- Auth gating
- Mention autocomplete
- Layout widths
- Other pages

## Verification

- Empty post discussion state is compact and left-aligned.
- The large medallion is removed.
- Copy shows: **No takes yet** / *Tried it, used it, or curious? Share your take.*
- Composer placeholder remains **Share your take...**.
- Existing comments view remains unchanged except for the cleaner header count.
- Mobile and desktop both look clean.
