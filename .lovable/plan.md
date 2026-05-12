# Step B — Build `cleanup-orphan-media-execute` (manual-only)

Step A is complete. Verification confirmed:
- 0 of 8 sample orphans are referenced anywhere → scanner is accurate.
- The 12 `entity_photos.url` rows storing full `post_media/...` URLs are already protected by the scanner's `bucketPathFromPublicUrl()` logic (they're part of `referencedPathCount: 43`).

Now we build the destructive function — but it stays manual-only with a tiny first-run cap.

---

## 1. Migration — `media_cleanup_runs` audit table

```sql
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

-- Service-role only (matches internal-table policy memory). No client policies.
create policy "service_role_all_media_cleanup_runs"
on public.media_cleanup_runs
for all
to service_role
using (true)
with check (true);

create index idx_media_cleanup_runs_started_at
  on public.media_cleanup_runs (started_at desc);
```

---

## 2. Edge function — `supabase/functions/cleanup-orphan-media-execute/index.ts`

**Design: single function, `mode` param** so execute and dry-run share the exact same scanner code.

**Guardrails:**
- Same `x-cron-secret` auth gate as the dry-run function.
- Reuses the dry-run's `listAllObjects`, `collectReferencedUrls`, and `bucketPathFromPublicUrl` logic verbatim.
- `MAX_DELETIONS = 50` constant for first run (will raise to 200, then 500 in later runs after we verify).
- Body params:
  - `mode: 'dry-run' | 'execute'` (default `'dry-run'` for safety)
  - `maxDeletions?: number` — optional override, capped at the constant
- Batch deletes in chunks of 100 via `supabase.storage.from('post_media').remove([...])`.
- Every error during delete is captured into the `errors` array (path + message), never thrown.
- Inserts one row into `media_cleanup_runs` at the end with full counts.
- Returns JSON: `{ mode, scanned, wouldDelete, deleted, skipped, referencedPathCount, sampleDeleted, errors, runId, tookMs }`.

**No cron schedule.** This function is invoked manually only.

---

## 3. Manual invocation SQL (Step C — after deploy)

I'll give you a `net.http_post` snippet to invoke once with `mode: 'execute'`, `maxDeletions: 50`. You'll then verify:
1. `select * from media_cleanup_runs order by started_at desc limit 1;` → `deleted ≤ 50`, `errors = []`.
2. Bucket object count dropped by ~`deleted` (Storage UI).
3. Spot-check the app — open recent posts, reviews, entity pages — confirm no broken images.
4. Re-run the Step A query against 3–5 paths from `sample_deleted` → expect 0 rows (sanity check that we didn't delete anything referenced).

If clean → next manual run at 200, then 500. If anything looks wrong → halt, we investigate before any further deletes.

---

## 4. What stays unchanged

- Existing `cleanup-orphan-media` dry-run function and its weekly cron — keep as continuous monitor.
- No execute cron is scheduled. Step E (scheduling weekly execute with pre-flight threshold check) remains deferred until 1–2 clean manual runs and your explicit approval.

---

## What I'll do when you approve

1. Submit the `media_cleanup_runs` migration (you approve in the UI).
2. Create the `cleanup-orphan-media-execute` edge function.
3. Print the manual-invoke SQL for the first 50-cap execute run and pause for your verification.
