# Reduce inter-post gap at the list level

## Root cause confirmed

DevTools shows 32px **margin** above the selected post card — not padding inside `PostFeedItem`. That 32px = Tailwind `space-y-8` (2rem) injected by the list wrapper.

Source: `src/components/feed/EnhancedFeedForYou.tsx` — the `motion.div` wrapping `items.map(...)` uses `className="space-y-8"` in **two** places (offline branch + main branch). This is the component actively rendering the For You feed (the other two variants, `FeedForYou.tsx` and `InfiniteFeedForYou.tsx`, already use `space-y-0`).

## Change

In `src/components/feed/EnhancedFeedForYou.tsx`, change both occurrences:

- `<motion.div className="space-y-8">` (offline branch, ~line 100)
- `<motion.div className="space-y-8" ...>` (main branch, ~line 137)

→ `space-y-0`

That's it. Posts will sit flush, separated only by each card's existing `border-b` hairline — Twitter/Reddit density.

## Not touched

- `PostFeedItem.tsx` (CardContent padding, action row `mt-2 pt-2 border-t`, media spacing — all stay as-is)
- `FeedCollage`, media sizing, object-fit, lightbox, composer, upload pipeline
- Action row internals
- `FeedForYou.tsx` / `InfiniteFeedForYou.tsx` (already correct)
- Outer page container `space-y-6` (that's between the tab bar and the feed, not between posts)

## Expected result

Inter-post gap drops from ~32px of empty margin to 0px — just the 1px `border-b` divider between posts. If after seeing it you decide a touch of breathing room helps, we can bump to `space-y-1` or `space-y-2` in a follow-up.
