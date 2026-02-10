

# Updated Migration: Add 3 Hardening Tweaks

The core migration from the approved Phase 2 plan remains identical. This update adds three small fixes recommended by ChatGPT's review.

## What's changing (only these 3 additions)

### 1. Add INSERT policy on `admin_settings`

Allows admins to insert new settings rows in the future without needing a migration.

```text
CREATE POLICY "Admins can insert admin_settings"
ON public.admin_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 2. Add COALESCE to `created_at` parsing in `is_admin_user()`

Prevents a crash if the `break_glass` JSONB value is corrupted or missing `created_at`.

```text
_bg_created_at := COALESCE(
  (_bg_settings->>'created_at')::TIMESTAMPTZ,
  now()
);
```

Using `now()` as fallback means: if corrupted, the fallback window effectively becomes zero (expires immediately), which is the safe default.

### 3. Add explicit DELETE deny on `admin_settings`

Prevents anyone -- even admins -- from accidentally deleting the break-glass config row.

```text
CREATE POLICY "No one can delete admin_settings"
ON public.admin_settings
FOR DELETE
TO authenticated
USING (false);
```

## Everything else stays the same

The full Phase 2 plan (RBAC tables, `has_role()`, updated `is_admin_user()`, last-admin trigger, seed data, edge function, UI components, sidebar/portal updates) is unchanged. These three tweaks are incorporated into the single database migration.

## Technical detail

The complete migration will include all of the following in one transaction:
- `app_role` enum
- `user_roles` table + RLS + policies
- `admin_settings` table + RLS + SELECT/UPDATE/INSERT/DELETE policies (4 policies total)
- `has_role()` function
- Updated `is_admin_user()` with COALESCE safety
- `prevent_last_admin_removal()` trigger
- Seed data for current admin user

