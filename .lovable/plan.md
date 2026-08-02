# Mention autocomplete in the comment edit box

## Phase 2.5A status

Verified last turn and unchanged since: migration applied (orphan retraction, dedupe, `uniq_active_comment_like_notifications`), `toggle_comment_like` retraction + targeted `ON CONFLICT`, `parse_comment_mentions` internal-only, `add_comment`/`update_comment` membership-driven notifications with shape-aware preview refresh, `comment_likes` reduced to read-only for clients, 0 stale `/recommendation/` URLs, 143 tests passing, roadmap updated. No leftover or dead code found. Good to move to the next phase after this fix.

## The bug

Typing `@` works in the main comment box and the reply box because both call `detectMention` and render `MentionAutocomplete`. The edit textarea lives in `CommentItem` and has no mention wiring at all, so no popup appears while editing.

## What to change

Reuse the existing mention state in `InlineCommentThread` rather than duplicating logic — one popup, one query, one selection handler.

1. `InlineCommentThread.tsx`
   - Widen `mentionTarget` to `'main' | 'reply' | 'edit'`.
   - In `handleMentionSelect`, add an `edit` branch that applies the same `insertMention` transform to `editCommentContent`.
   - Pass two new props to every `CommentItem` instance (top-level, auto-expanded replies, collapsible replies): a change handler that sets `editCommentContent` and calls `detectMention(value, 'edit')`, plus the mention popup state (`mentionVisible && mentionTarget === 'edit'`, `mentionQuery`, `onSelect`, `onClose`).
   - When edit is cancelled or saved, clear `mentionVisible`/`mentionQuery` so a stale popup can't linger.

2. `CommentItem.tsx`
   - Route the edit `Textarea`'s `onChange` through the new mention-aware handler (falling back to the existing `onEditContentChange` when not provided, so other callers keep working).
   - Wrap the edit textarea in a `relative` container and render `MentionAutocomplete` above it (`bottom-full mb-1`) only when this comment is the one being edited.
   - Add `onKeyDown` that returns early while the popup is open, so arrow keys/Enter go to the autocomplete instead of the textarea.

## Notes

- `CommentDialog.tsx` has its own separate edit textarea and no mention support anywhere in it; leaving it untouched keeps this change scoped to the inline thread the bug was reported on. Say the word if you want it there too.
- No database, service, or notification changes — `update_comment` already re-parses mentions server-side, so a mention added during an edit already creates the notification once the text is saved.
