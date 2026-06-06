## Goals
1. Stop `duplicate key value violates unique constraint "media_views_unique_user" / "media_views_unique_anon"` ERROR rows in Postgres logs.
2. Stop any remaining `permission denied for table profiles` rows coming from `AdminDebugPanel` by removing `profiles` from its connectivity probe.

Two independent fixes. No DB grants/RLS changes. No frontend behavioral changes. No V2/Phase 6 changes.

---

## Fix 1 — `track-media-view` duplicate-key log noise

### Why the original "upsert + ignoreDuplicates" plan won't work
Verified live in the DB:

```
media_views_unique_user  UNIQUE (user_id, source, source_id, media_path)
                         WHERE (user_id IS NOT NULL)
media_views_unique_anon  UNIQUE (anon_session_id, source, source_id, media_path)
                         WHERE (user_id IS NULL AND anon_session_id IS NOT NULL)
```

Both are **partial** unique indexes. PostgREST's `.upsert(..., { onConflict: 'col,col' })` emits `ON CONFLICT (cols)` with no `WHERE` predicate. Postgres won't match a partial index in that case and will raise `42P10`. So the proposed upsert path would break the function for every call.

### Approach instead: pre-check with SELECT, insert only if absent
In `supabase/functions/track-media-view/index.ts`, replace the current `admin.from('media_views').insert(...)` block with:

1. Build a dedupe filter that matches the active partial index:
   - If `userId` is set: `user_id = userId AND source = ... AND source_id = ... AND media_path = ...`
   - Else: `user_id IS NULL AND anon_session_id = ... AND source = ... AND source_id = ... AND media_path = ...`
2. `SELECT id ... LIMIT 1` with that filter using the existing service-role `admin` client.
3. If a row already exists → return `{ ok: true, deduped: true }` (no INSERT attempted → no Postgres ERROR log).
4. Otherwise → run the existing `.insert(...)`.
5. Keep the existing `23505` branch as a defensive fallback for the rare race where two concurrent requests both pass the SELECT check. In that race the ERROR log will still appear once, but it goes from "every replay view" to "true concurrent first-view only", which is negligible.

No new indexes, no migration, no schema change. The two partial unique indexes stay as the source of truth.

### Verification
- Replay an already-tracked video as the same logged-in user → network call returns 200, Postgres logs show no new `media_views_unique_user` violation.
- Same for anon path (incognito).
- First-time view still inserts a row (check `select count(*) from media_views where source_id = ...`).

---

## Fix 2 — `AdminDebugPanel` connectivity probe

The earlier patch removed the malformed `.select('count')`, so the *literal* offending query (`SELECT "profiles"."count"`) is gone. The remaining "permission denied" log lines visible in the screenshot are historical (verified by inspecting the actual query text in the logs).

But to make the panel future-proof against `profiles` column-level grants (per existing project rule: no `SELECT *` on `profiles`), switch the connectivity probe away from `profiles` entirely.

In `src/components/admin/AdminDebugPanel.tsx`, change the "Test Supabase connectivity" block (lines ~120-137) to probe `entities` instead, which the panel already reads in the RLS test right below:

```ts
const { error, count } = await supabase
  .from('entities')
  .select('id', { count: 'exact', head: true });
```

Everything else (`info.supabaseHealth.canConnect`, `canQuery`, `error.message`) stays the same. No other file touched.

### Verification
- Open Admin Portal → Debug Panel still shows Connection: Connected, Query Access: Working.
- No new `permission denied for table profiles` entries originating from `AdminDebugPanel` after refresh.

---

## Out of scope
- Phase 6.
- Any DB migration, grant change, RLS change.
- Any change to `analyze-entity-url-v2` or related Phase 5 code.
- Any frontend change beyond the one connectivity-probe line in `AdminDebugPanel`.

## Order of operations
1. Apply Fix 1 (edge function) — auto-deploys.
2. Apply Fix 2 (one-file frontend edit).
3. Wait ~1 min, re-check Postgres logs for both error patterns. If clean → Phase 6 is unblocked.