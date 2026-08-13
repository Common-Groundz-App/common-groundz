# Fix iOS zoom when typing in the comment box

## What is happening

This is iOS WebKit focus zoom, not a layout bug. Chrome on iPhone uses WebKit too, so the Safari rule applies: focusing a text field whose computed font size is below 16px zooms the page, and that scale persists across navigation until the user pinches out — exactly what the screenshots show.

Verified in code:

- `index.html:6` viewport is `width=device-width, initial-scale=1.0, viewport-fit=cover` (no zoom restrictions — good, leave it).
- `src/components/ui/textarea.tsx:14` — shared primitive defaults to `text-sm` (14px).
- `src/components/ui/input.tsx:12` — already guards with `text-base ... md:text-sm`, so this is the established project convention.
- Explicit 14px comment fields: `InlineCommentThread.tsx:878` (main composer), `:788` (reply composer), `CommentItem.tsx:169` (edit), `CommentDialog.tsx:614` (dialog composer), `CommentDialog.tsx:496` (dialog edit).

## Changes

Use the existing `text-base md:text-sm` convention everywhere (matches `Input`, and keeps 16px through iPhone landscape widths, which `sm:` at 640px would not).

1. `src/components/ui/textarea.tsx` — primitive default `text-sm` → `text-base md:text-sm`.
2. `src/components/comments/InlineCommentThread.tsx` — main composer and reply composer textareas: `text-sm` → `text-base md:text-sm`.
3. `src/components/comments/CommentItem.tsx` — edit textarea: same change.
4. `src/components/comments/CommentDialog.tsx` — dialog composer and dialog edit textareas: same change.

No viewport meta change. No `maximum-scale=1` / `user-scalable=no`. No padding, width, comment behavior, or mention-autocomplete changes.

## Also worth flagging (audit only, no edits unless you say so)

A codebase scan found other editable fields still at 14px or smaller that can trigger the same zoom on mobile:

- `src/components/preferences/TagInput.tsx` — two bare `<input>` fields at `text-sm`.
- `src/components/feed/composer/DynamicStructuredFields.tsx:144` — raw input at `text-sm`.
- `src/components/admin/TagInput.tsx` / `SimpleTagInput.tsx` — `text-xs` controls (admin-only, low priority).

These are outside the reported bug. I'll list them after the fix so you can decide whether to include them in a follow-up pass.

## Verification (iPhone Chrome and Safari)

1. Post detail: tap the main comment box — no zoom.
2. Type and submit — scale stays normal.
3. Tap Reply composer — no zoom. Tap Edit on your own comment — no zoom.
4. Open the comment dialog surface (composer and edit) — no zoom.
5. Navigate back to the feed after typing — feed renders at normal scale.
6. Repeat step 1 in iPhone landscape — still no zoom.
7. Desktop/tablet: comment text still renders at today's 14px.
