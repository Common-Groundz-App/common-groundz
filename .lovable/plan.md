## Where we are

Dry-run is healthy:
- `status_code = 200`, `tookMs ≈ 5.7s`, weekly cron with 30s `pg_net` timeout
- 274 scanned · 231 would-delete · 40 referenced · 3 too-young

Now we move to Phase 2 — destructive cleanup — **safely and in stages**. No auto-delete cron yet.

---

## Step A — Verify sample orphans against the DB (no code, ~15 min)

Before building anything destructive, prove the scanner is correct.

I'll generate a single SQL query that takes ~8 paths from the `sampleOrphans` list and searches every table where media URLs are stored:

- `posts.media` (jsonb array)
- `reviews.media` (jsonb array) and `reviews.image_url`
- `review_updates.media` (jsonb array)
- `recommendations.image_url`
- `entity_photos.url`
- `entities.image_url`

Output: zero rows = scanner is correct, proceed to Step B. Any hit = scanner has a bug, fix the dry-run before going further.

Sanity checks alongside the query:
- Confirm `abfcbf43-...` is a real user folder, not a system path.
- Confirm `wouldDelete = 231` feels plausible for the platform's age/usage.

---

## Step B — Build `cleanup-orphan-media-execute` (manual-only, no cron)

A new edge function that mirrors the dry-run scanner exactly, but actually deletes — with strong guardrails. **No schedule.**

**Guardrails**
- Same `x-cron-secret` auth gate.
- **Reuse the dry-run's reference-collection and listing logic verbatim** — execute and dry-run must never drift.
- **Hard deletion cap per run** via `MAX_DELETIONS` env/constant. **First run = 50.** Not 500.
- **Batch deletes** in chunks of 100 via `supabase.storage.from(BUCKET).remove([...])`.
- **Audit log** — every run inserts a row into a new `media_cleanup_runs` table.
- Returns: `scanned`, `wouldDelete`, `deleted`, `skipped`, `errors`, `sampleDeleted`, `tookMs`.
- Mode flag: function still accepts `mode: 'dry-run' | 'execute'` so we can re-verify with the same code path.

**Audit table (migration)**
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
  max_deletions int,
  sample_deleted text[] not null default '{}',
  errors jsonb not null default '[]'::jsonb,
  took_ms int
);
alter table public.media_cleanup_runs enable row level security;
-- service-role only; no client policies (matches internal-table memory)
```

---

## Step C — Run execute manually, ONCE, capped at 50

After Step B is deployed:
1. Invoke once via SQL Editor (`net.http_post` with the cron secret).
2. Verify in order:
   - `media_cleanup_runs` row: `deleted ≤ 50`, `errors = []`.
   - Bucket object count dropped by ~`deleted`.
   - Spot-check the app — open a few recent posts, reviews, entity pages — confirm no images broke.
   - Cross-check 3–5 of `sample_deleted` against the same 6 tables (Step A query, reused).

If clean → second manual run with cap raised to 200, then 500.
If anything broke → halt, restore from storage backup if needed, fix the scanner.

---

## Step D — Keep dry-run cron active. DO NOT schedule execute yet.

- Weekly dry-run stays on as a continuous monitor — if `wouldDelete` ever spikes unexpectedly, we'll see it before any destructive run.
- Execute remains **manual-only** until you've completed at least 1–2 clean manual runs and explicitly approve scheduling.

---

## Step E (deferred — only after you approve) — Schedule execute weekly

When you're confident, we schedule with two extra safeguards:
- Run **after** the dry-run on the same day (e.g. dry-run Sun 03:00, execute Sun 04:00).
- **Pre-flight check inside execute**: read the latest `media_cleanup_runs` dry-run row from the past 24h. If `would_delete` exceeds a sanity threshold (e.g. 1000), abort and log instead of deleting. Prevents a runaway scanner bug from nuking the bucket.
- `timeout_milliseconds := 60000` on the cron call (deletes are slower than scans).

---

## Summary of differences vs. my original plan

| Topic | Original | Revised (better) |
|---|---|---|
| Verify orphans against DB first | Optional ("Step A") | **Mandatory gate** before any destructive code |
| First-run delete cap | 500 | **50** |
| Execute cron timing | Schedule right after first clean manual run | **Deferred** until 1–2 clean manual runs + explicit approval |
| Pre-flight safety on scheduled run | None | **Threshold check** against latest dry-run |
| Mode flag in execute function | Separate function | **Single function, `mode` param** — guarantees scanner parity |

---

## What I'll do when you approve this plan

1. Print the Step A verification SQL — you run it in the SQL Editor and paste me the result.
2. If clean: I create the `media_cleanup_runs` migration + `cleanup-orphan-media-execute` edge function with `MAX_DELETIONS = 50`.
3. I give you the manual-invoke SQL for Step C. We pause there for your verification before going further.
