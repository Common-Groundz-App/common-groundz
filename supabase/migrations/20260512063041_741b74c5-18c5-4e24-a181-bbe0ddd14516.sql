create table public.media_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text not null check (mode in ('dry-run','execute')),
  scanned int not null default 0,
  would_delete int not null default 0,
  deleted int not null default 0,
  skipped_young int not null default 0,
  skipped_referenced int not null default 0,
  referenced_path_count int not null default 0,
  max_deletions int,
  sample_deleted text[] not null default '{}',
  errors jsonb not null default '[]'::jsonb,
  took_ms int
);

alter table public.media_cleanup_runs enable row level security;

create policy "service_role_all_media_cleanup_runs"
on public.media_cleanup_runs
for all
to service_role
using (true)
with check (true);

create index idx_media_cleanup_runs_started_at
  on public.media_cleanup_runs (started_at desc);