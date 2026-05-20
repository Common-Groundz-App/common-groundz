-- Mux Phase 1: backend foundation

create type public.mux_upload_status as enum (
  'waiting',
  'asset_created',
  'ready',
  'errored',
  'cancelled'
);

create table public.mux_uploads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  upload_id       text not null unique,
  asset_id        text unique,
  playback_id     text,
  status          public.mux_upload_status not null default 'waiting',
  duration        numeric,
  aspect_ratio    text,
  max_resolution  text,
  error           text,
  is_test         boolean not null default false,
  expires_at      timestamptz not null,
  last_event_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_mux_uploads_user_created
  on public.mux_uploads (user_id, created_at desc);

create index idx_mux_uploads_user_status_created
  on public.mux_uploads (user_id, status, created_at desc);

alter table public.mux_uploads enable row level security;

-- Owner can read their own rows. Writes are service-role only (no policy = denied).
create policy "Users can view their own mux uploads"
  on public.mux_uploads
  for select
  to authenticated
  using (auth.uid() = user_id);

create trigger update_mux_uploads_updated_at
  before update on public.mux_uploads
  for each row
  execute function public.update_updated_at_column();

-- Monotonic status trigger. Terminal states (ready/errored/cancelled) are locked.
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

  if old.status in ('ready', 'errored', 'cancelled') then
    new.status := old.status;
    return new;
  end if;

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

create trigger mux_uploads_monotonic_status
  before update of status on public.mux_uploads
  for each row
  execute function public.mux_uploads_enforce_monotonic_status();

-- Durable webhook idempotency log
create table public.mux_webhook_events (
  event_id     text primary key,
  event_type   text not null,
  upload_id    text,
  asset_id     text,
  received_at  timestamptz not null default now()
);

alter table public.mux_webhook_events enable row level security;
-- No policies = service-role only.
