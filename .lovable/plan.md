

# Security Fix Plan — COMPLETED ✅

## Applied Changes (Migration ran successfully)

### 1. Fixed Function Search Paths (7 functions)
All 7 functions now have `SET search_path = public, pg_temp`:
- `queue_entity_enrichment` (SECURITY DEFINER)
- `cleanup_spaced_hashtags`, `get_who_to_follow`, `notify_entity_update`, `prevent_parent_entity_deletion`, `update_cached_photos_updated_at`, `update_conversation_updated_at` (INVOKER)

### 2. Made `update_entity_slug()` SECURITY DEFINER + REVOKE EXECUTE
- Converted to SECURITY DEFINER with `SET search_path = public, pg_temp`
- REVOKE EXECUTE from `anon` and `authenticated` — only the trigger can invoke it

### 3. Locked down `entity_slug_history` writes
- Kept SELECT public (for logged-out slug redirects)
- Dropped "System can manage slug history" FOR ALL policy
- No write policies needed — trigger is now SECURITY DEFINER

### 4. Scoped `entity_enrichment_queue` INSERT
- Dropped 3 overly permissive "Always True" policies (INSERT/UPDATE/DELETE)
- Kept scoped INSERT: `WITH CHECK (requested_by = auth.uid())`
- Revoked write access from `anon`

### 5. Acknowledged intentional items
- Profiles public SELECT — intentional for social features
- Notifications — already scoped by auth.uid()
- cached_photos public SELECT — intentional for entity pages

## Remaining Manual Dashboard Actions
- **Enable Leaked Password Protection**: Supabase Dashboard > Authentication > Settings
- **Upgrade Postgres**: Supabase Dashboard > Settings > Infrastructure
