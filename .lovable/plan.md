

## Refinements: Clean `@` triggers + Unified text rendering

### Summary
Fix the leftover `@` text when selecting entities/users, and create a unified text renderer so `@mentions` in the feed look consistent with comments (orange, clickable).

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/text/PostTextRenderer.tsx` | **New.** Single unified renderer for both `#hashtags` and `@mentions` in one pass. Hashtags: blue link to `/t/{tag}`. Mentions: orange `text-primary font-medium hover:underline` link to `/u/{username}` (matching comment MentionText styling). **Safeguards**: skip `@` preceded by non-whitespace (avoids `email@test.com`); skip matches inside URLs. Only for plain-text content — rich text keeps existing renderer. |
| 2 | `src/components/feed/EnhancedCreatePostForm.tsx` | **A)** `handleEntitiesChange`: when `selectorPrefillQuery` is non-empty (meaning `@` triggered selector), remove the `@query` text from content. Use `textareaRef.current.selectionStart` (not stale `cursorPosition` state) to reliably find the `@` trigger via backward scan. Only valid if `@` is at start or preceded by whitespace. **B)** `onMentionInsert`: same fix — read live `selectionStart` from textarea ref, backward-scan to `@`, replace `@trigger` → `@username `. Restore cursor after replacement. |
| 3 | `src/components/feed/PostFeedItem.tsx` | Replace `HashtagRenderer` → `PostTextRenderer` for post content rendering. |

### What stays untouched
- `HashtagRenderer.tsx` — kept (used elsewhere)
- `MentionText.tsx` — kept (used in comments)
- `UnifiedEntitySelector.tsx` — unchanged
- `ModernCreatePostForm.tsx` — unchanged (edit flow deferred)

### Safeguards adopted

| Source | Safeguard |
|--------|-----------|
| ChatGPT | Only treat `@` as trigger if at start or preceded by whitespace |
| ChatGPT | Skip `@mentions` inside URLs in renderer |
| ChatGPT | `hover:underline` on mentions for clickable affordance |
| Codex | Only use PostTextRenderer for plain-text; rich text keeps existing path |
| Codex | Use live `textareaRef.current.selectionStart` instead of stale cursor state |

