

# Security Fix Plan (Final Version + Hardening)

## Summary

This migration fixes function search path vulnerabilities and overly permissive RLS write policies. No frontend or edge function changes needed.

---

## Changes to Implement

### 1. Fix Function Search Paths (7 functions)

Recreate each function with `SET search_path = public, pg_temp`, preserving all original attributes (security mode, volatility, args, return type):

| Function | Security Mode |
|----------|--------------|
| `queue_entity_enrichment` | SECURITY DEFINER |
| `cleanup_spaced_hashtags` | INVOKER |
| `get_who_to_follow` | INVOKER |
| `notify_entity_update` | INVOKER |
| `prevent_parent_entity_deletion` | INVOKER |
| `update_cached_photos_updated_at` | INVOKER |
| `update_conversation_updated_at` | INVOKER |

### 2. Make `update_entity_slug()` SECURITY DEFINER + Revoke Direct Access

- Convert to `SECURITY DEFINER` with `SET search_path = public, pg_temp`
- **REVOKE EXECUTE** from `anon` and `authenticated` to prevent direct invocation
- Only the trigger on `entities` should invoke this function -- no user should call it directly
- This enables fully locking down `entity_slug_history` writes without breaking the trigger path

### 3. Fix `entity_slug_history` RLS Policies

- KEEP the SELECT policy (`USING (true)`) -- needed for logged-out slug redirects
- DROP the "System can manage slug history" FOR ALL policy (overly permissive)
- No INSERT/UPDATE/DELETE policy needed -- the trigger function is now SECURITY DEFINER and bypasses RLS

### 4. Fix `entity_enrichment_queue` RLS Policies

- DROP the 3 existing "Always True" INSERT/UPDATE/DELETE policies
- New INSERT policy: `WITH CHECK (requested_by = auth.uid())` -- ties rows to the caller
- No UPDATE/DELETE policy for authenticated/anon (service_role only)
- REVOKE INSERT, UPDATE, DELETE from `anon`

### 5. Mark Intentional Items as Acknowledged

These are intentional design decisions, not vulnerabilities:

- **Profiles public SELECT**: Required for `/u/:username`, search, suggestions (logged-out access)
- **Notifications**: Already scoped with `auth.uid() = user_id` -- false positive
- **Internal tables** (embedding_trigger_log, user_behavior_patterns, etc.): Intentionally RLS-locked, accessed only via service_role
- **`cached_photos` public SELECT**: Needed for logged-out entity pages
- **`entity_stats_view`**: Needed for explore/discovery metrics

### 6. Dashboard Actions (Manual)

- **Enable Leaked Password Protection**: Supabase Dashboard > Authentication > Settings
- **Upgrade Postgres**: Supabase Dashboard > Settings > Infrastructure (if available)

---

## Post-Migration Verification

1. **Logged out**: Visit `/u/:username` -- profile loads
2. **Logged out**: Visit an old entity slug URL -- redirects correctly
3. **Logged in**: Edit an entity name -- confirm `entity_slug_history` row created (tests SECURITY DEFINER trigger)
4. **Logged in**: Trigger entity enrichment -- confirm queue row has correct `requested_by`
5. **Supabase logs**: No new 403/406 permission errors

---

## What Does NOT Change

- No frontend code changes
- No edge function changes
- No changes to `profiles`, `cached_photos`, or `entity_stats_view` policies
- No extension schema migrations

## Technical Summary

| Change | Type |
|--------|------|
| Fix 7 function search paths | Migration SQL |
| Make `update_entity_slug()` SECURITY DEFINER + REVOKE EXECUTE | Migration SQL |
| Lock down `entity_slug_history` writes (keep SELECT public) | Migration SQL |
| Scope `entity_enrichment_queue` INSERT to `requested_by = auth.uid()` | Migration SQL |
| Acknowledge intentional public exposure items | Security finding updates |
| Enable Leaked Password Protection + Postgres upgrade | Dashboard manual |

