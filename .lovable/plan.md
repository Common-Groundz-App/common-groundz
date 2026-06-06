# Fix: `permission denied for table profiles` from AdminDebugPanel

## Root cause
`src/components/admin/AdminDebugPanel.tsx` line 122 runs:
```ts
await supabase.from('profiles').select('count').limit(1);
```
PostgREST treats `'count'` as a literal column name, producing `SELECT "profiles"."count" FROM "profiles" LIMIT 1`. The `profiles` table has column-level grants (no literal `count` column visible to `authenticated`), which surfaces as `permission denied for table profiles` in Postgres logs every time an admin opens the Admin Portal.

## Fix
One-line change in `src/components/admin/AdminDebugPanel.tsx` — replace the malformed query with a proper head-count using an existing safe column (`id`), respecting the project rule "No `SELECT *` on `profiles`":

```ts
const { error, count } = await supabase
  .from('profiles')
  .select('id', { count: 'exact', head: true });
```

Then update the surrounding block to use `count` instead of `data` (set `info.supabaseHealth.canQuery = !error`).

## Scope
- File: `src/components/admin/AdminDebugPanel.tsx` only.
- No DB, RLS, GRANT, or edge-function changes.
- V2 / Phase 5 untouched.

## Verification
- Open Admin Portal → confirm Supabase Health shows Connection: Connected, Query Access: Working.
- Check Postgres logs → no new `permission denied for table profiles` entries.

After this lands, we proceed to Phase 6.
