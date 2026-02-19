

# Final Security Remediation Plan (No Changes Needed)

Both external reviews confirmed the plan is correct. Their additional suggestions are either already addressed or out of scope:

- **Unique index on cached_photos** (ChatGPT): Already exists (`unique_entity_original_url` constraint on `entity_id, original_url`). No action needed.
- **Harden cached_photos insert path** (Codex): The unique constraint already prevents spam. The table stores non-sensitive cache data. A justification note in the security dashboard is sufficient.
- **Dependency vulnerability triage record** (Codex): This is a process/documentation task for a pre-launch checklist, not a code change. Noted for later.

---

## Changes to Implement

### 1. Harden `refresh-entity-metadata` Edge Function

**File:** `supabase/functions/refresh-entity-metadata/index.ts`

Add the standard auth pattern before any request processing:
- Extract and validate Authorization header after CORS check
- Verify JWT via `supabase.auth.getUser(token)` (or `getClaims`)
- Check admin role via `has_role` RPC using service_role client
- Move `await req.json()` below auth checks so unauthenticated requests are rejected before body parsing
- Replace `error.message` in the catch block with generic `{ error: 'Internal error', code: 'INTERNAL_ERROR' }`

### 2. Clean Up Security Findings Dashboard

**Delete stale findings** (confirmed resolved in live database):
- Entities table RLS (verified 5 active policies live)
- Client-side admin checks (ReviewCard already uses server-side RPC)

**Ignore with justification:**
- `pg_net` extension in public schema (Supabase limitation, cannot be moved)
- Leaked Password Protection (requires Pro plan, deferred)
- Postgres version (just upgraded to v17)
- `entity_stats_view` materialized view (read-only public aggregate data, no PII)
- Dependency vulnerabilities (transitive; explicit per-package triage deferred to pre-launch audit checklist)
- RLS-enabled tables with no policies (internal tables secured via REVOKE)
- `entity_slug_history` write policies (secured via SECURITY DEFINER triggers only)
- `cached_photos` INSERT policy (correctly allows authenticated users for frontend photo caching; unique constraint prevents abuse; UPDATE/DELETE already admin-only)

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/refresh-entity-metadata/index.ts` | JWT auth + admin check before body parse + error sanitization |
| Security Dashboard | Delete 2 stale findings, ignore ~8 non-actionable findings with justification |

Nothing else changes.

