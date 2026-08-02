# Mention autocomplete in every comment edit surface

## Verdict on the feedback

Both points are right and are now folded in:

- **Keyboard handling (ChatGPT):** correct. The existing main/reply textareas already do `if (mentionVisible) return;` *before* their own Enter/Escape shortcuts — that only skips the composer's own shortcuts, it never blocks typing (`MentionAutocomplete` owns Arrow/Enter/Tab/Escape via a capture-phase document listener). The edit textarea will reuse exactly that pattern, not a new one.
- **Scope (Codex):** correct, and verified — `CommentDialog` is user-facing. It is rendered by `RecommendationFeedItem`, `ProfilePostItem`, and `RecommendationContentViewer`, and it has its own edit `Textarea` with no mention wiring. Leaving it out would ship two different behaviours for the same action, so it is in scope.

## What I'm adding beyond their notes

- **One shared hook instead of three copies.** `detectMention` and `insertMention` currently live inline in `InlineCommentThread`. Extract them into `useMentionAutocomplete` so inline-thread (main/reply/edit) and dialog (main/edit) all use one regex and one insert transform. No third implementation.
- **Target the popup by comment id, not by a generic `'edit'` string**, so a stale popup can never render next to a different comment.
- **Popup opens downward when there isn't room above.** Both edit textareas sit inside scroll containers; `bottom-full` alone can clip. The popup gets a simple side choice based on available space above the textarea.

## Changes

1. **New `src/components/comments/useMentionAutocomplete.ts`**
   - Owns `{ visible, query, target }` where `target` is `{ kind: 'main' | 'reply' | 'edit', commentId?: string }`.
   - Exports `detect(text, target)`, `insert(text, username)`, `close()`, `reset()`.
   - Same regexes as today, moved verbatim: detect `/(?:^|\s)@([a-z0-9._]*)$/i`, insert replaces that trailing token with `@username `.

2. **`InlineCommentThread.tsx`**
   - Replace local mention state/handlers with the hook; main and reply call sites behave identically.
   - `handleMentionSelect` gains an `edit` branch applying `insert` to `editCommentContent`.
   - Pass to every `CommentItem` (top-level, auto-expanded replies, collapsible replies): a mention-aware edit change handler, plus popup props gated on `target.kind === 'edit' && target.commentId === comment.id`.
   - Edit save (success or failure) and cancel call `reset()`.

3. **`CommentDialog.tsx`**
   - Same hook wiring for its main comment box (if it has none today, only the edit box is required) and its edit textarea, with the same id-scoped gating and reset-on-save/cancel.

4. **`CommentItem.tsx`**
   - Route the edit `Textarea` `onChange` through the new handler, falling back to `onEditContentChange` when the mention props aren't supplied, so existing callers keep working.
   - Wrap the textarea in a `relative` container and render `MentionAutocomplete` positioned above (falling back to below when clipped).
   - `onKeyDown`: `if (mentionVisible) return;` first, then existing behaviour — typing is unaffected; Enter while the popup is open selects a mention and cannot reach Save.

## Out of scope

No database, service, or notification changes. `update_comment` already re-parses mentions and reconciles notifications on save (Phase 2.5A), so an added or removed mention during an edit is handled server-side.

## Manual checks

Inline thread and dialog, each: `@` popup appears while editing; arrows/Enter pick a result and don't submit the form; Escape closes; cancel then edit another comment shows no stale popup; failed save keeps text and closes the popup; main and reply autocomplete still work; popup isn't clipped inside the scroll area.
