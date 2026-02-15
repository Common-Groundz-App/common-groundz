

# Fix Duplicate Users in "Who to Follow" and Limit to 5

## Problem

The "Who to Follow" section shows the same user multiple times because:
1. No `deleted_at IS NULL` filter -- soft-deleted test accounts still appear
2. `UNION ALL` in `final_candidates` produces duplicates when a user qualifies for multiple pools
3. UI requests only 3 results instead of 5

## Changes

### 1. New database migration: Update `get_who_to_follow`

Add `AND p.deleted_at IS NULL` to all 4 CTEs and replace `final_candidates` with deduplicated logic using `DISTINCT ON` with priority-aware ordering and NULL-safe tie-breakers.

Additions per CTE:
- **friends_of_friends** (after line 38): `AND p.deleted_at IS NULL`
- **active_creators** (after line 65): `AND p.deleted_at IS NULL`
- **fresh_creators** (after line 89): `AND p.deleted_at IS NULL`
- **emergency_fallback** (after line 111): `AND p.deleted_at IS NULL`

Replace `final_candidates` CTE (lines 125-130) with:

```sql
final_candidates AS (
  SELECT DISTINCT ON (combined.id) combined.*
  FROM (
    SELECT * FROM all_candidates
    UNION ALL
    SELECT * FROM emergency_fallback
    WHERE (SELECT COUNT(*) FROM all_candidates) < p_limit
  ) combined
  ORDER BY combined.id,
    CASE combined.source_type
      WHEN 'fof' THEN 1
      WHEN 'active' THEN 2
      WHEN 'fresh' THEN 3
      WHEN 'fallback' THEN 4
    END,
    COALESCE(combined.mutual_count, 0) DESC,
    COALESCE(combined.activity_7d, 0) DESC
)
```

### 2. Update `src/services/userRecommendationService.ts` (line ~64)

Add `.is('deleted_at', null)` to the fallback query after `.not('username', 'is', null)`.

### 3. Update `src/pages/Feed.tsx` (line 158)

- Change `getUserRecommendations(user.id, 3)` to `getUserRecommendations(user.id, 5)`
- Add `.slice(0, 5)` safety cap when rendering recommendations (line 717)

## What Does NOT Change

- No changes to UserRecommendationCard component
- No changes to follow/unfollow logic
- No RLS policy changes
- No edge function changes
- No other pages affected

## Technical Summary

| File | Change |
|------|--------|
| New migration SQL | Add `deleted_at IS NULL` to all 4 CTEs; deduplicate with `DISTINCT ON` + source priority + COALESCE tie-breakers |
| `userRecommendationService.ts` | Add `.is('deleted_at', null)` to fallback query |
| `Feed.tsx` | Request 5 users; `.slice(0, 5)` safety cap |

