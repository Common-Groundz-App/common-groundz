

# Refinements to PostFeedItem

Two changes to `src/components/feed/PostFeedItem.tsx`:

## 1. Make entire card clickable (Reddit-style)

Currently only the content area div (lines 395-444) is the click target. Change to make the whole `Card` the click target:

- Move `onClick={handleContentAreaClick}` and `cursor-pointer` to the outer `<Card>` element (line 340)
- Add keyboard accessibility (`role="link"`, `tabIndex={0}`, `onKeyDown`) to the Card
- Remove the inner clickable div wrapper (lines 395-401, 444) — just render the content directly
- Keep `e.stopPropagation()` on: author row (line 343), dropdown menu, action buttons row (line 447), media (line 434), entity tag clicks, location tag clicks
- **Comment button** keeps its own navigate to `?focus=comment` (already isolated)
- **Media** already has `e.stopPropagation()` (line 434) so lightbox opens instead of navigation
- **Like, Save, Share buttons** already isolated — they perform their action, no navigation

## 2. Move entity tags back below content (original position)

Currently entity tags render above content (lines 402-407). Move them back to after the content and media, restoring the original look from `entity_tags.png`:

- Move the entity tags block (lines 402-407) and location tags block (lines 409-414) to after the media section (after line 443)
- This restores: content first, then media, then entity/location tags at the bottom (before the action bar)

### Technical detail

The Card gets: `className="overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"` with `onClick={handleContentAreaClick}` and keyboard handlers. The inner content div loses its click wrapper and just renders content naturally.

