

# Phase 2: Admin Account Management + Roles System (Final)

## Summary

Build admin tools for account recovery and permanent deletion. Replace the hardcoded `@lovable.dev` email check with a proper `user_roles` table (RBAC). Add time-bound break-glass fallback (configurable), last-admin protection, audit logging, and paginated listing.

---

## 1. Database Migration

### RBAC System

- Create enum `public.app_role` with values: `admin`, `moderator`, `user`
- Create `public.user_roles` table (id, user_id FK to auth.users with cascade delete, role, unique constraint on user_id+role)
- Enable RLS on `user_roles`
- Create `SECURITY DEFINER` function `public.has_role(uuid, app_role)` for RLS-safe role checks
- RLS policy: only users with admin role can read `user_roles` (using `has_role()`)

### Update `is_admin_user(user_email text)`

Rewrite to:
1. Look up user_id from auth.users by email
2. Check `user_roles` for admin role
3. **Break-glass fallback**: If zero admin rows exist in `user_roles` AND the migration timestamp (stored in `admin_settings`) is less than the configured expiry window ago, allow `@lovable.dev` emails through. Once an admin row exists or the window expires, the fallback is permanently inactive.

### Configurable Break-Glass via `admin_settings`

- Create `public.admin_settings` table (key TEXT PRIMARY KEY, value JSONB)
- Seed a row: `key = 'break_glass'`, `value = { "enabled": true, "created_at": "<migration timestamp>", "expiry_days": 90 }`
- The `is_admin_user()` function reads this row to determine if the fallback is active
- To disable the fallback early, just run: `UPDATE admin_settings SET value = jsonb_set(value, '{enabled}', 'false') WHERE key = 'break_glass'`
- To extend or shorten the window: update `expiry_days` -- no function rewrite needed
- RLS on `admin_settings`: only admins can read/write (using `has_role()`)

### Last-Admin Guard

- Create a trigger on `user_roles` for DELETE and UPDATE operations
- The trigger function checks: if the operation would remove the last row with `role = 'admin'`, raise an exception ("Cannot remove the last admin")
- Prevents accidental lockout from bad queries or UI bugs

### Seed Data

- Look up the current `@lovable.dev` user from auth.users and insert them into `user_roles` with `admin` role
- Once seeded, the break-glass fallback becomes dormant (admins exist in the table)

---

## 2. New Edge Function: `supabase/functions/admin-manage-account/index.ts`

Three actions via JSON body `{ action, ... }`:

- **`list-deleted`**: Returns all profiles where `deleted_at IS NOT NULL`. For each, fetches email via `adminClient.auth.admin.getUserById()`. Supports optional `search` param (username ilike). **Paginated**: accepts `page` (default 1) and `page_size` (default 20), returns `{ data, total, page, page_size }`.
- **`recover`**: Accepts `user_id`. Verifies `deleted_at IS NOT NULL`. Sets `deleted_at = null`. Logs to `admin_actions` with `action_type: 'recover_account'` and details JSONB (target username, email, previous deleted_at).
- **`hard-delete`**: Accepts `user_id`. Verifies `deleted_at IS NOT NULL` (guard: cannot hard-delete active accounts). Permanently deletes via `adminClient.auth.admin.deleteUser()`. Logs to `admin_actions` with `action_type: 'hard_delete_account'` and details JSONB.

Security:
- JWT validated programmatically via `getClaims()` (established project pattern)
- Admin check via `is_admin_user()` RPC (queries `user_roles`)
- `verify_jwt = false` in config.toml (matches all other edge functions)

---

## 3. New Component: `src/components/admin/AdminUserManagementPanel.tsx`

Follows the Card-based layout pattern from `AdminClaimsPanel`:

- Default view: paginated table of all soft-deleted accounts (fetched from edge function)
- Search input to filter by username
- Table columns: Username, Email (read-only), Status badge, Deleted Date, Days Remaining, Actions
- "Recover" button per row -- calls edge function with `action: "recover"`
- "Permanently Delete" button per row -- opens confirmation dialog requiring admin to type `DELETE`
- Status badges: amber "Soft Deleted", red "Expiring Soon" (under 7 days remaining)
- Pagination controls at bottom of table
- Loading states, error handling, toast notifications

---

## 4. Update `src/components/AdminRoute.tsx`

Replace `user?.email?.endsWith('@lovable.dev')` with a Supabase RPC call:

```text
const { data: isAdmin } = await supabase.rpc('is_admin_user', { user_email: user.email })
```

Frontend and backend now share the same admin logic, driven by `user_roles`.

---

## 5. Update `src/components/admin/AdminSidebar.tsx`

Add nav item to the `navigationItems` array:

```text
{
  name: 'User Management',
  url: '#user-management',
  icon: Users,
  onClick: () => { setCurrentActiveTab('User Management'); onTabChange('user-management'); }
}
```

Add `'user-management': 'User Management'` to the `getDisplayTabName` switch.

---

## 6. Update `src/pages/AdminPortal.tsx`

- Import `AdminUserManagementPanel`
- Add `renderUserManagementContent()` function
- Add `case 'user-management'` to `renderActiveContent` switch
- Add "Users" button to mobile tab navigation bar (matching existing button pattern)

---

## 7. Update `supabase/config.toml`

Add:

```text
[functions.admin-manage-account]
verify_jwt = false
```

---

## Files Summary

| File | Action |
|---|---|
| Database migration | Create enum, tables (`user_roles`, `admin_settings`), functions (`has_role`, updated `is_admin_user`), trigger (last-admin guard), seed data, RLS policies |
| `src/components/AdminRoute.tsx` | Replace email check with `is_admin_user()` RPC call |
| `supabase/functions/admin-manage-account/index.ts` | Create (3 actions + audit logging + pagination) |
| `src/components/admin/AdminUserManagementPanel.tsx` | Create |
| `src/components/admin/AdminSidebar.tsx` | Add nav item |
| `src/pages/AdminPortal.tsx` | Add tab + mobile nav button |
| `supabase/config.toml` | Add function config |

---

## Future-Proofing

**Adding a new admin** (e.g., Google Workspace email): sign in, then run `INSERT INTO user_roles (user_id, role) VALUES ('your-id', 'admin')`. No code changes needed.

**Disabling break-glass early**: `UPDATE admin_settings SET value = jsonb_set(value, '{enabled}', 'false') WHERE key = 'break_glass'`

**Adjusting expiry window**: `UPDATE admin_settings SET value = jsonb_set(value, '{expiry_days}', '180') WHERE key = 'break_glass'`

**Last-admin trigger** ensures you can never accidentally remove all admins from the system.

