

# Final Security Hardening Plan — Ready to Implement

No further changes needed. This plan has been validated through multiple rounds of external review.

---

## Pre-requisite (Manual)
Create a point-in-time backup: **Supabase Dashboard > Settings > Database > Backups**

---

## Migration 1: Lock Down 5 Internal Tables

**Tables:** `embedding_trigger_log`, `recommendation_explanations`, `recommendation_quality_scores`, `user_behavior_patterns`, `user_similarities`

No RLS, fully exposed, not used by frontend. For each:
- Enable RLS + FORCE RLS
- REVOKE ALL from anon and authenticated
- No policies (denied by default; edge functions use service_role)

---

## Migration 2: Harden `social_influence_scores`

No RLS but used by frontend for reads + upserts.

- Enable RLS + FORCE RLS
- REVOKE ALL from anon
- SELECT for authenticated: `USING (true)` (non-sensitive public metrics)
- INSERT for authenticated: `WITH CHECK (auth.uid() = user_id)`
- UPDATE for authenticated: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- No DELETE policy

---

## Migration 3: Fix `entity_views` Data Exposure

- Drop "Users can view all entity views" policy
- Create new: `USING (auth.uid() = user_id)`

---

## Migration 4: Harden `entity_enrichment_queue`

Safe 3-step approach for existing rows:

1. Add nullable `requested_by uuid` column
2. Backfill existing rows with nil UUID `'00000000-0000-0000-0000-000000000000'` (RFC 4122 nil value for pre-RLS system rows)
3. Set `NOT NULL` constraint + `DEFAULT auth.uid()`

Policy changes:
- Drop all 4 existing permissive policies
- New INSERT for authenticated: `WITH CHECK (requested_by = auth.uid() AND auth.uid() IS NOT NULL)`
- No SELECT/UPDATE/DELETE policies (edge functions use service_role)

No frontend code changes needed -- the only INSERT path is from the frontend via PostgREST (in `enhancedEntityService.ts`), where `auth.uid()` is always available. The edge function only does SELECT/UPDATE using service_role.

---

## Migration 5: Tighten `cached_photos`

- Drop "System can update cached photos" policy
- Drop "System can delete cached photos" policy

---

## Migration 6: Function Search Path Hardening

Apply `SET search_path = public, pg_temp` to exactly 18 SECURITY DEFINER functions:

| Function | Arguments |
|---|---|
| calculate_enhanced_trending_score | p_entity_id uuid |
| calculate_social_influence_score | p_user_id uuid, p_category text |
| calculate_trending_hashtags | p_limit integer |
| calculate_trending_score | p_entity_id uuid |
| calculate_user_similarity | user_a_id uuid, user_b_id uuid |
| detect_potential_duplicates | (no args) |
| get_categories_by_parent | parent_uuid uuid |
| get_category_hierarchy | (no args) |
| get_child_entities | parent_uuid uuid |
| get_child_entities_with_ratings | parent_uuid uuid |
| get_comments_with_profiles | p_table_name text, p_id_field text, p_item_id uuid |
| get_network_recommendations_discovery | p_user_id uuid, p_current_entity_id uuid, p_limit integer |
| get_personalized_entities | p_user_id uuid, p_limit integer |
| run_duplicate_detection | (no args) |
| search_categories | search_query text |
| trigger_ai_summary_generation | (no args) |
| trigger_review_embedding | (no args) |
| update_all_trending_scores | (no args) |

---

## Manual Dashboard Action

Enable **Leaked Password Protection**: Supabase Dashboard > Authentication > Settings

---

## Post-Migration Verification

Run this query to confirm grants are correct:

```text
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'embedding_trigger_log', 'recommendation_explanations',
    'recommendation_quality_scores', 'user_behavior_patterns',
    'user_similarities', 'social_influence_scores',
    'entity_enrichment_queue', 'cached_photos', 'entity_views'
  )
ORDER BY table_name, grantee;
```

Then:
1. Test edge functions still work (service_role bypasses RLS)
2. Test social influence feature (reads + writes)
3. Test entity views only show current user's data
4. Test enrichment queue accepts jobs from frontend
5. Re-run security scan

---

## What We Are NOT Changing

| Item | Reason |
|---|---|
| Profiles public SELECT | Intentionally public |
| Global schema REVOKE | Would break PostgREST |
| FK on requested_by | Supabase prohibits FK to auth schema |
| 103 functions with search_path=public | Already protected |
| Frontend code | DEFAULT auth.uid() handles it via PostgREST |

---

## Files Modified

6 new SQL migration files. No frontend code changes.

