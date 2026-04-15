

## Plan: Preserve newlines + Defer composer colorization

### What we'll do now (quick fix)

**Preserve user whitespace in `PostTextRenderer.tsx`**

Add `whitespace-pre-wrap` to the renderer's wrapper div so newlines typed by the user are preserved in the feed and post detail views. This matches Twitter/X, Instagram, and Reddit behavior.

| File | Change |
|------|--------|
| `src/components/text/PostTextRenderer.tsx` | Add `whitespace-pre-wrap` to the root `<div>` className |

One line change. This fixes the collapsed newline issue immediately.

### What we defer (composer syntax highlighting)

Live colorization of `@mentions` and `#hashtags` inside the compose textarea is a separate, complex feature requiring either:
- A transparent textarea + styled mirror div overlay, or
- A `contentEditable` rich text approach

This is worth doing but should be scoped as its own task to avoid introducing input bugs. The current plain textarea remains functional — users can still see their mentions/hashtags rendered correctly after posting.

