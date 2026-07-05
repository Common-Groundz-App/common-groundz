# Fix: Non-admin still gets "V2 engine failed" (403)

## Diagnosis

- The flag `entity_creation.non_admin_enabled` **is ON** in the database (flipped at 06:52 UTC), and the `is_non_admin_entity_creation_enabled()` function exists with correct permissions for the backend.
- The edge logs show your two failed attempts at ~07:15 UTC (12:45 PM IST) — both returned **HTTP 403** from `analyze-entity-url-v2`, served by **deployment version 78**.
- The code in the repo is correct: it allows non-admins when the flag is ON. But the **deployed version of the function is stale** — it was last deployed before the Phase 3.4B flag-gate change, so the live function still rejects all non-admins unconditionally with 403. Your earlier frontend fix (routing non-admins to v2) is working — it's the backend that's running old code.

## Plan

1. **Redeploy the three edge functions** that share the flag helper, so the live code matches the repo:
   - `analyze-entity-url-v2`
   - `check-entity-duplicates`
   - `create-brand-entity`
2. **Add diagnostic logging** (small, no PII):
   - In `supabase/functions/_shared/feature_flags.ts`: log a warning if the flag RPC errors (currently it fails silently and defaults to "disabled").
   - In `analyze-entity-url-v2`: one log line when a non-admin is allowed/blocked by the gate, so future issues are visible in logs.
3. **Validate**:
   - Call the deployed function to confirm non-admins are no longer 403-blocked.
   - You retry the same Maccaron URL as the non-admin user — full V2 analysis (Firecrawl + Gemini) should now run instead of the basic-metadata fallback.

## Technical details

- No database changes, no frontend changes, no flag changes.
- Only the two files above get minor logging additions; the main fix is the redeploy itself.
