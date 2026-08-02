# Mention autocomplete in every comment surface

## Verdict on the feedback

Both refinements from Codex are right and are now in the plan. ChatGPT's approval notes are already covered.

- **Caret-aware detection:** agreed, and this is the right moment to fix it. Today's regex only matches a mention at the very end of the value, so editing mid-text (`Thanks, @han| this was useful.`) never opens the popup and an insert could rewrite the wrong token. Since the logic is being centralized anyway, it becomes caret-aware once.
- **CommentDialog composer:** verified — `CommentDialog` has a main `Textarea` ("Add a comment...") with no mention wiring at all. Wiring only its edit box would create the reverse inconsistency, so both dialog surfaces are in scope.
- **Popup positioning:** agreed. Instead of hand-computing above/below inside an overflow container, anchor the popup with the project's existing Radix `Popover` primitive, which portals out and handles collisions.

## Additions of my own

- **Caret restoration after insert.** After replacing the `@query` token, set the textarea selection to just after the inserted `@username ` rather than letting the caret jump to the end. Without this, mid-text edits move the cursor and the next keystroke lands in the wrong place.
- **Keep the hook's detection separate from server parsing.** The hook detects a *partial* token being typed; `parse_comment_mentions` parses *final* text. They stay intentionally different, and no server change is made.
- **Regression cases pinned in the manual checks** so the centralized regex doesn't change today's behaviour: `@hana`, `@hana.li`, `@linda_williamss`, and email-like text (`a@b.com`) not triggering.

## Changes

1. **New `src/components/comments/useMentionAutocomplete.ts`** — one shared, caret-aware controller.
   - State: `{ visible, query, target }` where `target` is `{ kind: 'main' | 'reply' | 'edit', commentId?: string }`.
   - `detect(value, caretIndex, target)` — matches `/(?:^|[^a-z0-9._@])@([a-z0-9._]*)$/i` against `value.slice(0, caretIndex)` and records the token's start/end offsets. Opens the popup when matched, closes otherwise. Skips when there's a non-collapsed selection.
   - `insert(value, username)` — replaces only the recorded token range with `@username `, returns `{ value, caret }` so callers can restore the caret.
   - `close()` / `reset()`.

2. **`InlineCommentThread.tsx`** — replace the local mention state/handlers with the hook. Main and reply call sites keep identical behaviour (now caret-aware). `handleMentionSelect` gains an `edit` branch applying `insert` to `editCommentContent`. Every `CommentItem` instance (top-level, auto-expanded replies, collapsible replies) receives the mention-aware edit change handler plus popup props gated on `target.kind === 'edit' && target.commentId === comment.id`. Save (success or failure), cancel, and switching edited comment all call `reset()`.

3. **`CommentDialog.tsx`** — wire the hook into both its main composer (`Add a comment...`) and its edit textarea, with the same id-scoped gating and reset rules.

4. **`CommentItem.tsx`** — route the edit `Textarea`'s `onChange` through the new handler, falling back to `onEditContentChange` when the mention props are absent so other callers keep working. `onKeyDown` starts with `if (mentionVisible) return;` then existing behaviour — typing is unaffected, and Enter while the popup is open selects a mention instead of reaching Save.

5. **`MentionAutocomplete.tsx`** — render inside a Radix `Popover` anchored to the active textarea (`PopoverAnchor` + portalled content, `side="top"`, `collisionPadding`) so it can't be clipped by the thread or dialog scroll container. Keyboard handling stays exactly as today (capture-phase Arrow/Enter/Tab/Escape).

## Out of scope

No database, service, notification, or realtime changes. `update_comment` already re-parses mentions and reconciles notifications on save (Phase 2.5A).

## Manual checks

Per surface — inline main, inline reply, inline edit, dialog main, dialog edit:

- `@` opens the popup, including mid-text with the caret inside the token.
- Selecting inserts at the correct token and leaves the caret right after it.
- Arrows/Enter select and never submit or save; Escape closes.
- Cancel clears the popup; a failed save keeps the text and closes the popup; editing a different comment shows no stale popup.
- Popup is not clipped with the edited row scrolled to the top and bottom edges.
- Token behaviour unchanged: `@hana`, `@hana.li`, `@linda_williamss` match; `a@b.com` does not trigger.
