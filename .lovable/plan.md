## Why the hint is hidden on mobile

In `EnhancedCreatePostForm.tsx`, the inline hint next to "Add details" uses `hidden sm:inline`, which means it is hidden on any viewport under 640px wide and only shown from `sm` (≥640px) and up.

That was a defensive choice to avoid awkward wrapping on narrow phones, but in practice:
- The hint strings are short (2–6 words, e.g. "Rating, pros, cons").
- The parent button already has `min-w-0 max-w-full` and the hint span has `truncate`, so overflow is safely handled with an ellipsis — it can't break the layout.
- Hiding it on mobile is exactly where users need the cue most (mobile composer = less context, smaller fonts).

So: yes, we should show it on mobile.

## Plan

Single, surgical change in `src/components/feed/EnhancedCreatePostForm.tsx` (around line 1126):

- Replace `className="hidden sm:inline text-muted-foreground/60 truncate min-w-0"` with `className="inline text-muted-foreground/60 truncate min-w-0"`.
- Keep everything else identical: same `· {hint}` text, same `aria-hidden`, same `{!structuredOpen && ...}` gate, same truncation behavior, same dark-mode token (`text-muted-foreground/60`).

That makes the hint visible on every viewport while truncation continues to protect the layout on very narrow screens or with long hints (e.g. comparison's "Winner, reasoning, best for each").

## Out of scope

- No changes to hint copy, post type pill, entity tag, body, Suggested hashtags, structured fields, or footer.
- No new tokens, no layout changes, no schema changes.
