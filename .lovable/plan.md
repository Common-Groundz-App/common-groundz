## Goal

Remove the redundant top divider above the action row in `PostFeedItem.tsx`, while keeping all spacing and the bottom post divider untouched. This collapses media → actions into a single visual block, leaving the bottom card divider as the only separator between posts.

## Change

File: `src/components/feed/PostFeedItem.tsx`

In the action row wrapper, change:

```
mt-4 pt-4 border-t
```

to:

```
mt-4 pt-4
```

That is the only change. `border-t` is removed; `mt-4 pt-4` stays exactly as it is.

## Not touched

- Bottom post divider (`border-b` on the card)
- `CardContent` padding
- Feed list spacing (`space-y-*`, `pt-*` on the list wrapper)
- `FeedCollage` / media sizing
- Action icon spacing and internals
- Composer, lightbox, other feed variants, `ProfilePostItem`

## Expected result

Structure per post becomes: media → action row (no top line) → bottom card divider → next post. Vertical rhythm and all paddings remain identical to the current live state; only the hairline above the icons disappears.

## Follow-up (not in this step)

If after this change the gap between media and the action icons feels too loose, the next pass can reduce `mt-4 pt-4` to `mt-3 pt-3` or `mt-2 pt-2` as a separate isolated change.
