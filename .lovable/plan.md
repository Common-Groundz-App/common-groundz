# Mention autocomplete in every comment surface

## Verdict on the feedback

Both of Codex's implementation details are real and are now folded in, plus its call for unit coverage. ChatGPT's cautions are already covered by the manual checks.

- **`PopoverAnchor` does not exist:** verified — `src/components/ui/popover.tsx` exports only `Popover`, `PopoverTrigger`, `PopoverContent`. The plan now adds the `PopoverAnchor` re-export, prevents `onOpenAutoFocus`/`onCloseAutoFocus` focus transfer, and puts the popover root + anchor at the call site around each textarea (the component can't anchor itself from elsewhere in the tree).
- **Bare `@` behavior:** correct catch — `MentionAutocomplete` bails when `query` is empty, so "bare `@` opens" would silently fail. Decision: **require at least one character**, matching today's main/reply behavior exactly, and the acceptance criteria are written that way. A default "recent users" list is a nicer UX but needs a new data source and would change existing surfaces' behavior; it stays out of this bug fix and can be a small follow-up if you want it.
- **Unit tests:** agreed. The detect/insert range math is the most regression-prone part and is pure, so it gets a test file in the existing Vitest setup.
- **Caret-aware detection:** the right moment to fix it, since editing usually happens mid-text (`Thanks, @han| this was useful.`) where today's end-anchored regex never fires.
- **CommentDialog composer:** verified it has a main "Add a comment..." `Textarea` with no mention wiring, so both dialog surfaces are in scope.

## Additions of my own

- **Caret restoration after insert.** After replacing the `@query` token, set the textarea selection to just after the inserted `@username ` instead of letting the caret jump to the end.
- **Hook detection stays separate from server parsing.** The hook detects a *partial* token being typed; `parse_comment_mentions` parses *final* text. No server change.
- **Regression cases pinned** so centralizing the regex doesn't change today's behaviour: `@hana`, `@hana.li`, `@linda_williamss`, `hi @hana`, `(@hana`, `,@hana` all match; `a@b.com` does not.


## Changes

1. **New `src/components/comments/useMentionAutocomplete.ts`** — one shared, caret-aware controller.
   - State: `{ visible, query, target }` where `target` is `{ kind: 'main' | 'reply' | 'edit', commentId?: string }`.
   - `detect(value, caretIndex, target)` — matches `/(?:^|[^a-z0-9._@])@([a-z0-9._]*)$/i` against `value.slice(0, caretIndex)` and records the token's start/end offsets. Opens only when the typed query has at least one character (matching today's behaviour), closes otherwise. Skips when the selection is non-collapsed.
   - `insert(value, username)` — replaces only the recorded token range with `@username `, returns `{ value, caret }` so callers can restore the caret.
   - `close()` / `reset()`.

2. **New `src/components/comments/useMentionAutocomplete.test.ts`** — unit tests for the pure detect/insert logic, added to the `include` list in `vitest.config.ts`: end-of-text and mid-text detection, punctuation prefixes, email non-trigger, dotted/underscored usernames, token-range replacement, and returned caret offset.

3. **`src/components/ui/popover.tsx`** — re-export `PopoverAnchor` from Radix (the file currently exports only root/trigger/content).

4. **`InlineCommentThread.tsx`** — replace the local mention state/handlers with the hook. Main and reply call sites keep identical behaviour (now caret-aware). `handleMentionSelect` gains an `edit` branch applying `insert` to `editCommentContent`. Every `CommentItem` instance (top-level, auto-expanded replies, collapsible replies) receives the mention-aware edit change handler plus popup props gated on `target.kind === 'edit' && target.commentId === comment.id`. Save (success or failure), cancel, and switching edited comment all call `reset()`.

5. **`CommentDialog.tsx`** — wire the hook into both its main composer (`Add a comment...`) and its edit textarea, with the same id-scoped gating and reset rules.

6. **`CommentItem.tsx`** — route the edit `Textarea`'s `onChange` through the new handler, falling back to `onEditContentChange` when the mention props are absent so other callers keep working. `onKeyDown` starts with `if (mentionVisible) return;` then existing behaviour — typing is unaffected, and Enter while the popup is open selects a mention instead of reaching Save.

7. **`MentionAutocomplete.tsx`** — render as portalled `PopoverContent` (`side="top"`, `align="start"`, `collisionPadding`) so it can't be clipped by the thread or dialog scroll container. Focus must stay in the textarea: `onOpenAutoFocus` and `onCloseAutoFocus` are prevented, and the content is non-modal with pointer-down-outside left to the caller. Each call site wraps its own textarea in `Popover` + `PopoverAnchor` so the popup is anchored correctly. Keyboard handling stays exactly as today (capture-phase Arrow/Enter/Tab/Escape on `document`), which keeps working because focus never leaves the textarea.

## Out of scope

No database, service, notification, realtime, or RPC changes. `update_comment` already re-parses mentions and reconciles notifications on save (Phase 2.5A). Bare-`@` default suggestion lists are deferred.

## Manual checks

Per surface — inline main, inline reply, inline edit, dialog main, dialog edit:

- Typing `@` plus at least one character opens the popup, including mid-text with the caret inside the token.
- Selecting inserts at the correct token and leaves the caret right after `@username `, not at the end.
- Arrows/Enter select and never submit or save; Escape closes; normal typing is never blocked.
- Focus stays in the textarea while the popup is open (no caret jump when it opens).
- Cancel clears the popup; a failed save keeps the text and closes the popup; editing a different comment shows no stale popup.
- Popup is not clipped with the edited row scrolled to the top and bottom edges of the inline thread and the dialog.
- Token behaviour unchanged: `@hana`, `@hana.li`, `@linda_williamss`, `hi @hana`, `(@hana`, `,@hana` match; `a@b.com` does not trigger.

