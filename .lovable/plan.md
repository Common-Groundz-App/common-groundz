# Mux Phase 1 — Migration trigger fix (everything else unchanged)

Only the monotonic-status trigger changes. Tables, indexes, RLS, and the rest of the plan stay exactly as previously approved.

## Corrected status transition rules

| From → To       | waiting | asset_created | ready | errored | cancelled |
|-----------------|---------|---------------|-------|---------|-----------|
| **waiting**       | —       | ✅            | ✅    | ✅      | ✅        |
| **asset_created** | ❌      | —             | ✅    | ✅      | ✅        |
| **ready**         | ❌      | ❌            | —     | ❌      | ❌        |
| **errored**       | ❌      | ❌            | ❌    | —       | ❌        |
| **cancelled**     | ❌      | ❌            | ❌    | ❌      | —         |

`ready`, `errored`, `cancelled` are **terminal**. Any attempted transition out of them is silently dropped (the trigger keeps the old status), so out-of-order/duplicate webhooks never clobber a final state.

## Corrected trigger

```sql
create or replace function public.mux_uploads_enforce_monotonic_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if new.status = old.status then
    return new;
  end if;

  -- Terminal states are locked.
  if old.status in ('ready', 'errored', 'cancelled') then
    new.status := old.status;
    return new;
  end if;

  -- Allowed forward transitions from non-terminal states.
  allowed := case
    when old.status = 'waiting'
         and new.status in ('asset_created', 'ready', 'errored', 'cancelled') then true
    when old.status = 'asset_created'
         and new.status in ('ready', 'errored', 'cancelled') then true
    else false
  end;

  if not allowed then
    new.status := old.status;
  end if;

  return new;
end;
$$;
```

## What stays identical
- `mux_upload_status` enum
- `mux_uploads` table + columns + indexes + RLS (owner-only select, service-role writes)
- `mux_webhook_events` table + service-role-only RLS
- `updated_at` trigger
- Edge functions (`mux-create-upload`, `mux-webhook`) and `config.toml` changes from the previously approved plan
- Secrets list

## Webhook implications (no code change needed)
- `video.asset.errored` arriving after `video.asset.ready` → trigger drops it, row stays `ready`. The webhook handler still logs the event to `mux_webhook_events` for audit.
- Duplicate `ready` events → no-op (status equal).
- A future "cancel" path can only flip `waiting` / `asset_created` rows, never a `ready` asset.

Approve and I'll start with the migration.