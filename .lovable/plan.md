

# Security Hardening — Migrations 7 and 8

## Migration 7: Admin Table Hardening + Cleanup

Drop overly permissive `ALL true` policies on 5 tables. Replace image admin table policies with admin-only access. Add `FORCE ROW LEVEL SECURITY` as safety belt.

**Tables and actions:**

| Table | Action |
|-------|--------|
| `image_health_results` | Drop `ALL true`, create admin-only policy |
| `image_health_sessions` | Drop `ALL true`, create admin-only policy |
| `image_migration_results` | Drop `ALL true`, create admin-only policy |
| `image_migration_sessions` | Drop `ALL true`, create admin-only policy |
| `photo_cache_sessions` | Drop `ALL true` only (no frontend usage, service_role only) |

Admin policies use: `public.has_role(auth.uid(), 'admin')` -- the existing SECURITY DEFINER function already used for `user_roles` and `admin_settings` tables.

## Migration 8: Scope Cached Tables to Authenticated

Replace public access policies with authenticated-only SELECT on `cached_queries` and `cached_products`. Writes are handled by edge functions via `service_role`.

| Table | Drop | Create |
|-------|------|--------|
| `cached_queries` | Public read + public ALL policies | Authenticated SELECT only |
| `cached_products` | Public read + public ALL policies | Authenticated SELECT only |

## Post-Migration: Dismiss Scanner Findings

Update the security scanner to mark these as resolved/acceptable:
- "All User Profile Data Publicly Accessible" -- intentional for public `/u/:username` profiles
- "Private User Conversations Could Be Accessed" -- already secured with `auth.uid() = user_id`
- "RLS Enabled No Policy" on internal tables -- intentional lockdown
- "Materialized View in API" -- aggregate stats only
- "Function search path" -- fixed in Migration 6

## Manual Actions (Dashboard)

1. Enable Leaked Password Protection (Authentication > Settings)
2. Check Postgres version for available upgrades (Settings > Infrastructure)
3. Run `npm audit` and selectively update packages

## Post-Implementation Testing

1. Log in as normal user -- admin image tools should return empty/denied
2. Log in as admin -- admin image tools should work
3. Test search autocomplete -- suggestions should still appear
4. Open `/u/[username]` logged out -- public profile should load
5. Load feed/explore -- should work normally

## Technical Details

Two new SQL migration files. No frontend code changes.

