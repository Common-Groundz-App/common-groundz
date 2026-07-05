# Phase 3.4E — Admin UI switch for `entity_creation.non_admin_enabled`

Wire the existing (default OFF) DB flag into the admin Feature Flags panel using the same `app_config` / `set_app_flag` mechanism as the other flags. No automatic flip — admin toggles manually.

## 1. Migration: extend `set_app_flag` allowlist

New migration that replaces `public.set_app_flag` with the same body but adds `'entity_creation.non_admin_enabled'` to:

- the allowed `_key` IN-list
- a validation branch requiring shape `{ "enabled": boolean }` (exact key set = `['enabled']`, `jsonb_typeof = 'boolean'`)

Everything else in `set_app_flag` (admin gate, insert/update logic, return shape) is unchanged. No new grants needed (function grants already cover `authenticated`). The `app_config` row itself already exists from migration `20260629080245` with default `{"enabled": false}` — we do NOT re-seed or change it.

## 2. Admin allowlist hook

`src/hooks/admin/useAppFlagsAdmin.ts`:
- Add `'entity_creation.non_admin_enabled'` to `ALLOWED_KEYS` so the admin rows query fetches it alongside the others.

## 3. Admin panel UI

`src/components/admin/AdminFeatureFlagsPanel.tsx`:

- Extend `PendingChange` union with `{ key: 'entity_creation.non_admin_enabled'; nextEnabled: boolean }`.
- Read the row: `nonAdminEntityRow = rows.data?.find(r => r.key === 'entity_creation.non_admin_enabled')`; `nonAdminEntityEnabled = nonAdminEntityRow?.value?.enabled === true` (default false).
- Add a new `Card` after the existing "Entity creation pipeline" card:
  - Title: **Non-admin entity creation**
  - Description: "Lets signed-in users create entities through the V2 Draft Review flow. Non-admin-created entities are pending and limited to 10 new entities per day."
  - Body: single row with `Label` **Allow non-admin entity creation** + subtext, updated-at line, and a `Switch` that opens the confirmation dialog with `{ key: 'entity_creation.non_admin_enabled', nextEnabled: checked }`.
- Extend `confirmTitle` / `confirmDesc` branches:
  - Title: "Enable non-admin entity creation?" / "Disable non-admin entity creation?"
  - Desc ON: "Signed-in non-admins can create entities via the V2 Draft Review flow. New entities are `pending` (limited to 10 per user per 24h) until an admin approves them."
  - Desc OFF: "Only admins can create entities. Any non-admin call to the atomic RPC or gated edge functions will be rejected."
- Extend `applyPending` with the matching `setFlag.mutateAsync({ key: 'entity_creation.non_admin_enabled', value: { enabled: pending.nextEnabled }, reason })` branch.

No changes to edge functions, RLS, atomic RPC, or client entity-creation flow — they already read the same key via `is_non_admin_entity_creation_enabled()` and the shared `feature_flags.ts` helper.

## Technical notes

- Flag stays default OFF (existing row untouched).
- Value shape enforced server-side: `{ "enabled": boolean }`.
- No changes to `useAppConfig` / `get_public_flags` — this flag is admin/edge-only and not needed on the public read path.
- Migration is additive; safe to re-run (uses `CREATE OR REPLACE FUNCTION`).

## Validation checklist

1. Feature Flags tab shows the new "Allow non-admin entity creation" switch, defaulting to OFF.
2. Toggling ON → confirm dialog → `app_config.entity_creation.non_admin_enabled = {"enabled": true}`; toggling OFF reverses it.
3. With flag OFF: non-admin call to `create_brand_and_entity_atomic` fails with `non_admin_entity_creation_disabled` (already implemented); admin flow unchanged.
4. With flag ON: non-admin V2 Draft Review submission succeeds and lands as `pending`.
