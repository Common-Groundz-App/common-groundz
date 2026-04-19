

## Final plan (locked, no more iteration)

All prior fixes 1–11 stand. Single change to Guard C:

**Guard C (corrected) — compare user input vs existing clean state, not merged vs existing:**
```ts
const hasStructuredChanged =
  JSON.stringify(safeCleaned) !==
  JSON.stringify(cleanStructuredFields(existingPost?.structured_fields ?? {}) ?? {});

const hasChanged =
  title !== existingPost.title ||
  content !== existingPost.content ||
  selectedType !== existingPost.post_type ||
  hasStructuredChanged;

if (hasChanged) {
  window.dispatchEvent(new CustomEvent('refresh-feed'));
  window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
}
```

Why: comparing `merged` vs `existing` would always show a diff when `ui_post_type` is added/removed even if user changed nothing meaningful. Comparing cleaned input vs cleaned existing reflects actual user intent.

---

## Full execution checklist (unchanged from prior round except Guard C)

1. **`SmartComposerButton.tsx`** — Review opens in-page dialog (not navigate).
2. **`postUtils.ts`** — Add `journal` + `watching` to `POST_TYPE_OPTIONS` and `BADGE_TYPES`.
3. **`structuredFields.ts`** — Add `ui_post_type?: 'journal' | 'watching'` to interface + `ALLOWED_STRUCTURED_KEYS`.
4. **`CreatePost.tsx`** — Whitelist `postType` query param → `defaultPostType`.
5. **`EnhancedCreatePostForm.tsx`** —
   - Widen `defaultPostType` to `UIPostType`; chip strip visible at top, brand-orange highlight.
   - On submit: safe merge (Guard A) + clear stale `ui_post_type` when switching away + map UI type → `'note'`.
   - On edit hydrate: read `structured_fields.ui_post_type` first, fall back to `post_type`.
   - On submit success: 200ms scale/opacity pulse on submit button.
   - Guard C (corrected) for refresh dispatch on edit only.
6. **`feedbackService.ts`** — Module-level audio unlock on first `pointerdown` via `Howler.ctx?.resume()`, `{ once: true }`.
7. **One-shot script** — Write real ~80ms blip WAV to `public/sounds/post.mp3` (check `like.mp3`/`save.mp3`/`refresh.mp3`, replace placeholders).
8. **`PostFeedItem.tsx`** —
   - Wrap edit `<Dialog>` + `<DeleteConfirmationDialog>` in `<div onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>`.
   - Expired Edit: non-disabled `DropdownMenuItem` + `onClick`/`onSelect` `preventDefault` + muted styling + `<Tooltip>` "Edit window closed (1 hour limit)".
9. **`ProfilePostItem.tsx`** — Same expired Edit treatment.
10. **`PostContentViewer.tsx`** — Extract `fetchPost` to stable callback; `useEffect` listens for `refresh-feed` + `refresh-profile-posts` → re-runs `fetchPost()`.
11. **Profile posts parent** — Verify it listens to `refresh-profile-posts`; patch only if missing.

---

## Manual verification checklist

1. SmartComposerButton → Review → in-page dialog opens.
2. `/create?postType=journal` → Journal chip highlighted orange.
3. `/create?postType=watching` → Watching chip highlighted orange.
4. `/create?postType=garbage` → no chip pre-selected.
5. Edit a journal post → Journal chip pre-selected.
6. Edit journal → switch to Tip → save → reopen → Tip selected (stale cleared).
7. Edit a post with `what_worked`/`duration` filled → values still present after save.
8. Open edit dialog, save without changes → no refresh event fires.
9. Submit on desktop Chrome → sound + button flash.
10. Submit on Android Chrome → sound + vibration + button flash.
11. Submit on iOS Safari → sound + button flash, no vibration.
12. Click anywhere inside edit dialog → no navigation to post detail.
13. Edit on post detail page → instant refresh.
14. Edit on profile posts tab → instant refresh.
15. Post >1h old: Edit greyed, hover shows tooltip, click does nothing.
16. Fresh post edit (<1h) regression: hashtags + entities still work.

