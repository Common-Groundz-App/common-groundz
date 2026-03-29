

# Enrich Post Detail Sidebar

## The Problem

The current sidebar is bare — just entity name/type and author name/bio with "View" buttons. Compared to Reddit's rich community card (stats, description, creation date, rules), ours feels like a placeholder.

## What to Add (Platform-Appropriate)

### Entity Card — Make it a "Decision Card"

The entity card should answer: *"Is this place/product worth my attention?"*

**New data points (all already available in Entity type or via `getEntityStats`):**

1. **Larger entity image** — hero-style banner at top of card (not tiny 48px thumbnail)
2. **Entity description** — 3-line clamp (already passed but underused)
3. **Stats row** — recommendations count, reviews count, average rating (star icon + number). Fetch via `getEntityStats(entity.id)` 
4. **Circle signal** — "X from your circle recommend this" (circleRecommendationCount from stats, only when logged in and > 0)
5. **Location/venue** — if entity has `venue` field, show with MapPin icon
6. **Entity type badge** — styled pill instead of plain text

### Author Card — Make it a "Trust Card"

The author card should answer: *"Should I trust this person?"*

**New data points (available via `useProfile` + `fetchFollowerCount`):**

1. **Follower count** — fetch via existing `fetchFollowerCount` RPC
2. **Post/recommendation count** — simple count query
3. **Member since** — from `profile.created_at`, formatted as "Joined Mar 2025"
4. **Follow button** — for non-own profiles (reuse existing `FollowButton` component if available)

## Technical Approach

### PostDetailSidebar.tsx changes

**Entity Card:**
- Accept full entity object (not just TaggedEntity subset) OR fetch stats inside the card using `getEntityStats`
- Add a `useQuery` inside `EntityCard` for stats: `queryKey: ['entity-stats', entity.id]`
- Render hero image, description, stats row, circle signal, venue

**Author Card:**
- Add `useQuery` for follower count: `queryKey: ['followerCount', userId]`
- Format `created_at` as "Joined Mon YYYY"
- Render stats row (followers, joined date)
- Add follow button (search for existing FollowButton component)

### PostView.tsx / PostContentViewer.tsx

- Pass the full entity object to sidebar (not just `{id, name, type, slug}`) so we have description, venue, image_url etc.

### Data flow

```text
PostContentViewer → onPostLoaded(meta) → PostView → PostDetailSidebar
                                                      ├─ EntityCard
                                                      │   └─ useQuery(['entity-stats', id])
                                                      └─ AuthorCard
                                                          └─ useQuery(['followerCount', userId])
```

## Files

| File | Change |
|------|--------|
| `src/components/content/PostDetailSidebar.tsx` | Major — enrich both cards with stats, layout, styling |
| `src/components/content/PostContentViewer.tsx` | Minor — pass fuller entity data in onPostLoaded |
| `src/pages/PostView.tsx` | Minor — update TaggedEntity interface if needed |

## What NOT to add

- No sorting/filtering in sidebar
- No community rules (not applicable)
- No assistant integration yet
- No mutual connections in sidebar (separate feature)

