

# Fix: `get_aggregated_network_recommendations_discovery` RPC Errors

## Root Cause

The `has_network_activity` migration was applied correctly (step 1), but **step 2 was never implemented** — the `get_aggregated_network_recommendations_discovery` RPC function was not updated. There are **three mismatches** between the database function and the frontend:

### Problem 1: Missing `p_entity_id` parameter → **400 error**
- **Frontend sends**: `{ p_user_id, p_entity_id, p_limit }`
- **Database function accepts**: `(p_user_id uuid, p_limit integer)` — no `p_entity_id`
- This causes the 400 error visible in the screenshot

### Problem 2: Wrong source table
- `has_network_activity` now correctly queries `reviews` table
- But `get_aggregated_network_recommendations_discovery` still queries the **`recommendations`** table with a **90-day filter** and `visibility = 'public'`
- These tables have different data — the same mismatch that caused the original bug

### Problem 3: Column name mismatch
- Database returns: `recommender_ids`, `recommender_names`
- Frontend expects: `recommender_user_ids`, `recommender_usernames`
- Even if the function ran, data wouldn't map correctly

## Fix: Rewrite the RPC function

Create a migration that replaces `get_aggregated_network_recommendations_discovery` to:

1. **Accept `p_entity_id`** parameter (to exclude the current entity from results)
2. **Query `reviews` table** with `is_recommended = true AND status = 'published'` (aligned with `has_network_activity`)
3. **Remove the 90-day time filter** (aligned with `has_network_activity` — freshness handled in frontend ranking)
4. **Rename return columns** to match frontend expectations: `recommender_user_ids`, `recommender_usernames`

### Updated function logic:
```sql
CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id uuid,
  p_entity_id uuid,        -- ADD: exclude current entity
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_slug text,
  parent_id uuid,
  parent_slug text,
  average_rating numeric,
  recommendation_count integer,
  recommender_user_ids uuid[],      -- RENAMED
  recommender_usernames text[],     -- RENAMED
  recommender_avatars text[],
  latest_recommendation_date timestamptz,
  network_score double precision
)
```

Key query changes:
- `FROM reviews r` instead of `FROM recommendations r`
- `r.is_recommended = true AND r.status = 'published'` instead of `r.visibility = 'public'`
- `WHERE e.id != p_entity_id` to exclude current entity
- Remove `AND r.created_at > now() - interval '90 days'`
- Use `r.rating` from reviews table for scoring

### Also update `types.ts`
Update the return type definition for this RPC to use `recommender_user_ids` and `recommender_usernames` column names matching the new function.

No frontend service code changes needed — the service already expects `recommender_user_ids` and `recommender_usernames` (lines 225, 260-262).

