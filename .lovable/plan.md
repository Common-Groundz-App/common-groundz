

# Mutual Connections — Final Implementation Plan

## 1. New RPC: `get_profile_mutual_connections`

**Migration file.** Uses CTE for correct total count.

```sql
CREATE OR REPLACE FUNCTION public.get_profile_mutual_connections(
  viewer_id uuid,
  profile_user_id uuid,
  result_limit int DEFAULT 3
)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  avatar_url text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  WITH matching_mutuals AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      p.username,
      p.first_name,
      p.avatar_url,
      f1.created_at AS follow_date
    FROM follows f1
    JOIN follows f2 ON f1.following_id = f2.follower_id
    JOIN profiles p ON p.id = f1.following_id
    WHERE f1.follower_id = viewer_id
      AND f2.following_id = profile_user_id
      AND f1.following_id != viewer_id
      AND f1.following_id != profile_user_id
  )
  SELECT
    m.id,
    m.username,
    m.first_name,
    m.avatar_url,
    (SELECT count(*) FROM matching_mutuals) AS total_count
  FROM matching_mutuals m
  ORDER BY m.follow_date DESC
  LIMIT result_limit;
$$;
```

Key details: CTE guarantees accurate `total_count` independent of LIMIT. `DISTINCT ON` prevents duplicate rows. Excludes viewer and profile owner. Lists safe profile columns only (per memory constraint).

## 2. Profile Header: `MutualConnectionsProof.tsx`

New component placed in `ProfileInfo.tsx` below follower/following counts.

**Render conditions:** authenticated AND not own profile AND count > 0. On error/loading failure → render nothing silently.

**Copy rules:**
- 1 mutual: "Followed by Hana"
- 2 mutuals: "Followed by Hana and Ali"
- 3+: "Followed by Hana, Ali and 7 others you follow"

Shows up to 3 stacked avatars. Text is clickable → opens `UserListModal`. Analytics: `mutual_proof_shown` fires once per mount via `useRef` guard.

## 3. Entity Copy Upgrade: `EntitySocialFollowers.tsx`

Update `formatFollowerMessage` to append "you follow" when displayed followers are from viewer's network. Copy change only — "Followed by Hana and 2 others" → "Followed by Hana and 2 others you follow".

## 4. Explore Batch Enrichment: `UserDirectoryList.tsx`

Single batch query for all visible user IDs (not per-card):

```sql
SELECT f2.following_id AS user_id, count(*) AS mutual_count
FROM follows f1
JOIN follows f2 ON f1.following_id = f2.follower_id
WHERE f1.follower_id = viewer_id
  AND f2.following_id = ANY(visible_user_ids)
  AND f1.following_id != viewer_id
GROUP BY f2.following_id;
```

**Copy:** 0 = hidden, 1 = "Followed by 1 person you follow", 2+ = "Followed by 3 people you follow". Only when authenticated.

## 5. Analytics

`mutual_proof_shown` and `mutual_proof_clicked` using existing `analytics.track()`. `useRef` guard to fire once per mount.

## Files

| File | Action |
|------|--------|
| `supabase/migrations/[new].sql` | New RPC |
| `src/components/profile/MutualConnectionsProof.tsx` | New component |
| `src/components/profile/ProfileInfo.tsx` | Add MutualConnectionsProof |
| `src/components/entity/EntitySocialFollowers.tsx` | Copy change in formatFollowerMessage |
| `src/components/explore/UserDirectoryList.tsx` | Batch mutual enrichment + display |
| `src/integrations/supabase/types.ts` | Auto-updated by Supabase |

## Not doing

Mutual count badges, feed card labels, anti-flicker delays, semantic naming cleanup, circle-weighted mutuals, feed ranking changes, mutual tab in circles modal.

