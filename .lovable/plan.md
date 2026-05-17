## Goal

Tighten the gap between the media block and the action row in `PostFeedItem.tsx` now that the top `border-t` is gone. The earlier "cramped" feel from `mt-1 pt-1` was caused by the divider sitting in that small space — without the divider, the tighter spacing should read as clean rather than cramped.

## Change

File: `src/components/feed/PostFeedItem.tsx` (line 534)

From:
```
className="flex items-center justify-between mt-2 pt-2"
```

To:
```
className="flex items-center justify-between mt-1 pt-1"
```

That is the only edit. No `border-t`. Nothing else in the file changes.

## Not touched

- Bottom card divider (`border-b` on the Card)
- `CardContent` padding (`px-3 sm:px-4 pt-2 pb-1 sm:pb-2`)
- Feed list spacing
- `FeedCollage` / `PostMediaDisplay` sizing
- Action icon spacing (button `gap-3 sm:gap-6`, per-button padding)
- Composer, lightbox, other feed variants, `ProfilePostItem`

## Expected result

Action row sits ~12px closer to the media block. No divider reappears. Vertical rhythm everywhere else is identical.
