## Goal

Restore a small amount of vertical breathing room in the For You feed without going back to the old huge 32px gap, and fix the separate issue that the first post sits flush against the For You / Following tabs.

## Why two different values

`space-y-*` only inserts space *between* siblings, never before the first child. That is exactly why the old `space-y-8` (32px) felt huge between posts but still left the first post glued to the tabs. So we need to solve two things independently:

1. Gap *between* posts — currently 0px, feels cramped.
2. Gap *above* the first post (tabs → first post) — currently 0px, also cramped.

## Proposed values

- Between posts: `space-y-2` → **8px**
  - Each `PostFeedItem` already has a `border-b` hairline, so 8px is enough to separate them visually without reintroducing the dead-air feeling of 32px. 10–12px (`space-y-2.5` / `space-y-3`) would also be defensible; I'd lean to 8px because of the existing divider.
- Above the first post: `pt-3` on the list wrapper → **12px**
  - A touch more than the inter-post gap so the tab row reads as a separate zone from the feed, matching how Twitter/Reddit separate their tab bar from the first card.

If after seeing it 8px still feels tight, the easy next step is `space-y-3` (12px). I'd start at 8px and only bump up if needed.

## Change

File: `src/components/feed/EnhancedFeedForYou.tsx`

Both `motion.div` wrappers that list the posts (the offline branch ~line 99 and the main branch ~line 136) currently use `className="space-y-0"`. Update both to:

```
className="space-y-2 pt-3"
```

That's the only change. No edits to `PostFeedItem.tsx`, `FeedCollage`, action row, CardContent padding, media sizing, composer, other feed variants, or the outer page container.

## Expected result

- Tabs → first post: 12px breathing room (was 0px, was also 0px back when margin was 32 because `space-y` doesn't apply to the first child).
- Post → next post: 8px gap on top of the existing hairline divider (was 0px now, was 32px originally).
- No other layout or spacing changes anywhere else.
