## Goal
Stop the `permission denied for table profiles` errors without changing DB grants, RLS, Phase 6, V2/Phase 5, or the media_views fix.

## What I already verified
- `src/components/admin/AdminDebugPanel.tsx` is fixed in source and uses:
  - `supabase.from('entities').select('id', { count: 'exact', head: true })`
- Current repo has no `.from('profiles').select('count')` anywhere.
- The error log shows `application_name: postgrest`, so this is a client/Data API call, not edge-function lag.

## Plan

### 0. Verify the newest log row's actual SQL (added per reviewers)
Open the most recent `permission denied for table profiles` row in Supabase logs and read `parsed.query`.

- If it is still `SELECT "public"."profiles"."count" FROM "public"."profiles" ...` → continue with steps 1–4.
- If it is a different `profiles` query (e.g. selecting `id, username, avatar_url, bio` etc.) → STOP. This is a different caller/permission issue, not the AdminDebugPanel one. Re-diagnose separately before any fix.

### 1. Re-scan repo for hidden callers
Search for every variant that could produce the old SQL:
- `.from('profiles')` / `.from("profiles")`
- `.select('count')` / `.select("count")`
- any admin/debug/health/diagnostics helper still imported anywhere
- any generated/bundled file not in src

### 2. Confirm live bundle is current
Open the preview's Admin Portal with DevTools Network open, filter for `profiles`, and check whether any request still includes `select=count`. Identify the exact route/component that triggers it, if any.

### 3. Apply a narrow fix only if a real caller is found
Replace the offending caller with the safe probe:
```ts
supabase.from('entities').select('id', { count: 'exact', head: true })
```

If no source caller exists, the cause is a stale served bundle — trigger only the minimal refresh/restart needed so the preview picks up current source.

### 4. Validate against the exact symptom
- Note the current time, open Admin Portal once, then filter Supabase logs to "Last 5 minutes".
- Confirm no new `profiles"."count"` query appears after that timestamp.
- Confirm no code remains with `.from('profiles').select('count')`.
- Confirm only the actual caller/debug file changed.
- Confirm V2/Phase 5/Phase 6 files and the `media_views` fix remain untouched.

## Out of scope
- DB grants, RLS policies, or any migration.
- Phase 6 work.
- V2/Phase 5 pipeline code.
- The `media_views` track-view fix (kept separate, already applied).

## Technical notes
- Reviewer guardrail: do not assume the latest error is the same SQL as the earlier log — confirm `parsed.query` first.
- `application_name: postgrest` strongly implies client-side caller, not an edge function.
- If source is already clean and the live bundle still emits the bad query, the root cause is a stale build, not a code bug.
