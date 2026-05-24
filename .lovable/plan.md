## Goal

Admin-controlled runtime kill switch for Mux: turn the Mux pipeline on/off and switch **test ↔ live** mode without a redeploy. When Mux is OFF, new video uploads transparently fall back to the existing Supabase Storage path. Existing Mux videos keep playing. Images are untouched.

## Admin UI placement

New tab in `AdminPortal.tsx` / `AdminSidebar.tsx` called **"Feature Flags"** (icon: `ToggleRight`), added to the existing `navigationItems` array with the same shape as the other entries. Inherits the existing `VerticalTubelightNavbar` glow/active state, `getDisplayTabName` mapping, and mobile pill-button rendering — no styling changes to the sidebar component itself. Mirrored in the mobile horizontal tab row.

Access: already gated by `AdminRoute` (server-side `is_admin_user` RPC). The panel additionally re-checks `useIsAdmin()` defensively before showing mutation controls (per `mem://style/security-frontend-standards`).

### Panel layout (`AdminFeatureFlagsPanel`)

Single card, three sections:

1. **Effective config** (read-only readout at the top) — what the **backend** currently resolves via a fresh `get_public_flags()` call: *Uploads: Enabled/Disabled* and *Mode: Live/Test*. Refreshes on panel mount and after every successful mutation. Prevents confusion when a toggle failed silently or a stale client cache exists.

2. **Mux video uploads** — `Switch` (Enabled / Disabled). Help: *"When disabled, new video uploads go to Supabase Storage. Existing Mux videos continue playing."*

3. **Mux mode** — `Switch` (Live / Test), **disabled & dimmed when row 2 is off**. Help: *"Test mode is for development only. Switching affects new uploads only — existing posts are unchanged."*

Each toggle: `AlertDialog` confirm with optional free-text *"Reason for change"*; optimistic update with rollback on error; success toast; *"Updated 2h ago by alice@…"* metadata below.

## Backend

### New table `public.app_config` — admin-only

```text
key             text PK            -- 'mux.uploads_enabled' | 'mux.mode'
value           jsonb              -- { "enabled": true } | { "mode": "live" }
description     text
updated_at      timestamptz
updated_by      uuid
updated_reason  text               -- nullable
```

RLS: **no public SELECT.** All direct access requires `has_role(auth.uid(),'admin')`.

### `get_public_flags()` RPC — public-safe read path

`SECURITY DEFINER`, executable by `anon` + `authenticated`. Returns a **hardcoded allowlist** only:

```sql
returns jsonb -- { "mux": { "uploads_enabled": true, "mode": "live" } }
```

New safe keys must be added explicitly inside the function body.

### `set_app_flag(_key text, _value jsonb, _reason text)` RPC — admin writes

`SECURITY DEFINER`. Behavior:
- Asserts `has_role(auth.uid(),'admin')` or raises.
- **Closed key allowlist:** `_key IN ('mux.uploads_enabled','mux.mode')`.
- **Per-key value validation:**
  - `mux.uploads_enabled` → must match `{ "enabled": boolean }`, exactly one key.
  - `mux.mode` → must match `{ "mode": "test"|"live" }`, exactly one key.
  - Invalid shape → raise `invalid_value_for_key`.
- **Idempotent:** if new value equals stored value, return `{ changed: false }` without writing or appending an audit row.
- Otherwise: update row, set `updated_by = auth.uid()`, `updated_at = now()`, `updated_reason = _reason`, return `{ changed: true, previous: <old jsonb> }`.

**No `console.log` here** (ChatGPT's correction): `set_app_flag` is a Postgres function, not an edge function. The audit table (`updated_by`/`updated_reason`/`updated_at` + per-change row) is the sole flag-change audit trail. No `RAISE LOG` unless we later need it.

### Audit log

New table `public.app_config_audit` (id, key, old_value, new_value, changed_by, changed_at, reason). Populated by `AFTER UPDATE` trigger on `app_config` **only when value actually changes** (matches RPC idempotency). Admin-only RLS.

### Migration idempotency (Codex's point)

The migration is safe to re-run:
- `CREATE TABLE IF NOT EXISTS` for `app_config`, `app_config_audit`.
- `CREATE OR REPLACE FUNCTION` for `get_public_flags`, `set_app_flag`, audit trigger function.
- `DROP TRIGGER IF EXISTS … ; CREATE TRIGGER …` pattern for the audit trigger.
- `DROP POLICY IF EXISTS … ; CREATE POLICY …` for all RLS policies.
- Seed rows use `INSERT … ON CONFLICT (key) DO NOTHING` so re-running never overwrites a live admin-set value:
  - `mux.uploads_enabled` → `{ "enabled": true }`
  - `mux.mode`           → `{ "mode": "live" }`

## Client wiring — no realtime subscription

Public clients do **not** subscribe to `app_config` realtime (the table has no public SELECT). Admin changes only need to apply reliably to new uploads, not propagate instantly to every viewer.

### `useAppConfig` hook (light)

`src/hooks/useAppConfig.ts`. React Query wrapper around `get_public_flags()`, `staleTime: 30s`, `refetchOnWindowFocus: true`. Used by the admin panel's "effective config" readout. No realtime.

### `resolveMuxConfig()` — on-demand, the upload-time source of truth

`src/services/mediaService.ts` module-local resolver, independent of React lifecycle:

```ts
let _cache: { value: MuxFlags; at: number } | null = null;
const TTL_MS = 30_000;

export async function resolveMuxConfig(): Promise<MuxFlags> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.value;
  try {
    const { data, error } = await supabase.rpc('get_public_flags');
    if (error) throw error;
    const value = {
      uploadsEnabled: data?.mux?.uploads_enabled ?? FALLBACK_FROM_ENV,
      mode: (data?.mux?.mode ?? 'live') as 'live' | 'test',
    };
    _cache = { value, at: Date.now() };
    return value;
  } catch {
    return { uploadsEnabled: FALLBACK_FROM_ENV, mode: 'live' };
  }
}

export function __resetMuxConfigCache() { _cache = null; }
```

The admin panel calls `__resetMuxConfigCache()` after a successful mutation **and** schedules a `setTimeout(() => __resetMuxConfigCache(), 1500)` follow-up — covers the edge case where a request was already in-flight at toggle time and re-populated the cache milliseconds later. Other clients pick up changes within ≤30s.

### `uploadMedia` decision flow + fallback

```text
if (isVideo) {
  const cfg = await resolveMuxConfig();
  if (cfg.uploadsEnabled) {
    try {
      return await uploadVideoViaMux(...);
    } catch (err) {
      // Codex's point: accept BOTH shapes from the edge function
      const code = err?.code ?? err?.error ?? err?.body?.error ?? err?.body?.code;
      if (code === 'MUX_DISABLED') {
        __resetMuxConfigCache();
        analytics.track('mux_fallback_to_supabase', { reason: 'server_disabled' });
        // fall through to Supabase path — no error toast
      } else {
        throw err;
      }
    }
  }
}
// Existing Supabase Storage video upload path — UNCHANGED
```

**Explicit acceptance criterion:** When Mux is disabled — by client cache OR by server `MUX_DISABLED` response (in either `error` or `code` field) — the user's video upload **must succeed via Supabase**, silently, with no scary toast.

## Edge function: `mux-create-upload`

Insert near top of handler (after auth, before Mux fetch):

```ts
let uploadsEnabled = true;
let muxMode: 'test' | 'live' = 'live';
try {
  const { data, error } = await admin.rpc('get_public_flags');
  if (error) throw error;
  uploadsEnabled = data?.mux?.uploads_enabled ?? true;
  muxMode = data?.mux?.mode ?? 'live';
} catch (e) {
  // Explicit fail-safe: refuse new uploads rather than honor a stale env value.
  // Client treats MUX_DISABLED as Supabase fallback, so user upload still succeeds.
  console.log(JSON.stringify({ event: 'get_public_flags_failed', err: String(e) }));
  return json({ error: 'MUX_DISABLED', code: 'MUX_DISABLED', reason: 'config_unavailable' }, 503, cors);
}

if (!uploadsEnabled) {
  console.log(JSON.stringify({ event: 'mux_disabled_block', user_id: userId }));
  return json({ error: 'MUX_DISABLED', code: 'MUX_DISABLED' }, 503, cors);
}

const isTest = muxMode === 'test';
```

The response body includes **both** `error` and `code: 'MUX_DISABLED'` so any client error-parsing shape resolves correctly (Codex's point). This replaces the existing `MUX_TEST_MODE` env read; the env var stays only as a client-side boot fallback inside `resolveMuxConfig`. Other Mux edge functions (`mux-webhook`, `mux-sync-post-mappings`, `mux-reconcile-upload`, `mux-register-mappings`) are **not** gated — they operate on existing assets.

## Behaviour matrix

| `mux.uploads_enabled` | `mux.mode` | New video upload goes to |
|---|---|---|
| true  | live | Mux (live)   |
| true  | test | Mux (test)   |
| false | any  | Supabase Storage (legacy path) |

- Image uploads: unaffected.
- In-flight Mux uploads at toggle time: complete via webhook unaffected.
- Existing Mux videos: keep playing (playback independent of upload flags).
- Toggling `mux.mode`: does **not** modify any existing row — only new Direct Uploads use the new mode.

## Verification checklist (run after build)

1. Mux enabled + live → new video uploads to Mux live.
2. Mux enabled + test → new video uploads to Mux test mode.
3. Mux disabled → new video uploads to Supabase Storage and post succeeds (no error toast).
4. Image upload remains unchanged.
5. Existing Mux videos still play after disabling Mux uploads.
6. Non-admin cannot call `set_app_flag` (RPC raises).
7. Admin change appears in `app_config_audit`.
8. `mux-create-upload` returns `{ error: 'MUX_DISABLED', code: 'MUX_DISABLED' }` (503) when disabled; client falls back silently.
9. Re-running the migration is a no-op (idempotency).

## Out of scope

- Public realtime propagation of config changes.
- Migrating existing Mux assets when disabled.
- Per-user / percentage rollout.
- Generic admin UI for arbitrary keys.
- Mux billing/usage dashboard.

## Files touched

- **Migration:** `app_config`, `app_config_audit`, `get_public_flags()`, `set_app_flag()` (validation + idempotency), audit trigger, seed rows, RLS — all with `IF NOT EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`.
- **New:** `src/hooks/useAppConfig.ts`, `src/hooks/admin/useAppFlagsAdmin.ts`, `src/components/admin/AdminFeatureFlagsPanel.tsx`.
- **Edited:** `src/services/mediaService.ts` (on-demand `resolveMuxConfig` + dual-shape `MUX_DISABLED` fallback + `__resetMuxConfigCache`), `src/components/admin/AdminSidebar.tsx` (new nav item), `src/pages/AdminPortal.tsx` (new tab + mobile button), `supabase/functions/mux-create-upload/index.ts` (DB-driven flag check + explicit fail-safe + dual-shape error body).
- **Untouched:** all other Mux edge functions, image upload path, legacy Supabase video path, Phase 3C edit/recovery flow, playback components.