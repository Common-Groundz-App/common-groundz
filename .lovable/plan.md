# Phase 3.4 audit + non-admin V2 routing fix

## Root cause

`src/hooks/useAnalyzeUrlEngine.ts` hard-codes `engine = 'v1'` for every non-admin, regardless of any flag. Consequences:

- The non-admin analyze in `admin.png` vs `non_admin.png` diverges because the admin hits `analyze-entity-url-v2` (Firecrawl + Gemini), while the non-admin hits legacy `analyze-entity-url` (v1), which for an unsupported host like `maccaron.in` only returns basic OG metadata — exactly what the "AI details unavailable" modal shows.
- Phase 3.4's contract is: non-admin entity creation happens exclusively through the **V2 Draft Review** flow. Routing non-admins to v1 contradicts that; v1 has no draft-review contract and no non-admin gating.

Edge-function side is already correct: `analyze-entity-url-v2` calls `isNonAdminEntityCreationEnabled()` at line 868 and permits non-admin callers when the flag is ON. So the only blocker is the client-side engine selector.

Everything else from 3.4A–E checks out:
- DB: `is_non_admin_entity_creation_enabled()` RPC + `set_app_flag` allowlist entry + `{"enabled": boolean}` shape validation.
- Edge: `analyze-entity-url-v2`, `check-entity-duplicates`, `create-brand-entity` all gate via the shared helper.
- Client: `PostCreateContinuation`, admin `AdminFeatureFlagsPanel` switch, `useAppFlagsAdmin` allowlist all present.
- No leftover dead code found from the grep sweep.

## Fix

Rewrite `useAnalyzeUrlEngine` so it picks v2 for non-admins whenever non-admin entity creation is enabled, without leaking the admin-only `entity_extraction.version` row to non-admins.

```text
role         non-admin flag OFF     non-admin flag ON
admin        reads app_config       reads app_config (unchanged)
non-admin    'v1' (unchanged)       'v2'  ← new
```

### Technical details

1. `src/hooks/useAnalyzeUrlEngine.ts`
   - Keep the current admin branch (reads `entity_extraction.version` from `app_config`).
   - For non-admins, call the existing public RPC `supabase.rpc('is_non_admin_entity_creation_enabled')` (already `SECURITY DEFINER`, callable by `anon`/`authenticated`) inside a `useQuery` gated on `!isAdmin`.
     - Returns `'v2'` when the RPC resolves `true`, else `'v1'`.
   - Loading state combines admin loading + whichever branch's query is loading.
   - No new DB migration and no RLS changes — the RPC is already exposed and reads the same `app_config` key the admin panel writes.

2. No other files change. `CreateEntityDialog` already switches on `engine === 'v2'` and passes the correct props; the edge-function-side non-admin gate is already in place; the Draft Review UI and `PostCreateContinuation` already trigger correctly when v2 returns.

## Validation

1. Admin, flag ON → still uses v2, admin flow unchanged (admin panel row still drives version).
2. Non-admin, flag ON → hits `analyze-entity-url-v2`, Draft Review renders, submission lands as `pending` (as in your last validation).
3. Non-admin, flag OFF → falls back to v1 (current behavior), edge functions still reject direct RPC attempts.
4. Non-admin RPC read of `entity_extraction.version` is never attempted (no RLS noise in logs).
