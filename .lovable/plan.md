## Plan

Single edit in `src/components/feed/PostFeedItem.tsx` at line 534.

**Change:** Action row wrapper classes
- From: `mt-2 pt-2 border-t`
- To: `mt-1 pt-1 border-t`

**Untouched:**
- `CardContent` padding stays `px-3 sm:px-4 pt-2 pb-1 sm:pb-2`
- `border-t` divider preserved
- FeedCollage, media sizing, object-fit, composer, lightbox, card layout — no changes

**Expected:** Action row moves ~8px closer to media; inter-post gap shrinks correspondingly.