

# Security Remediation - Final Implementation

## Pre-flight Validation Complete

Audited all 24 frontend files and 8 edge functions that query `profiles`. Every frontend query uses explicit column lists. The only `select('*')` is `src/services/profileService.ts`. Edge functions using `profile_embedding` run with `service_role` (bypasses column grants). No frontend code reads `onboarding_completed`, `email`, or any unlisted column.

## Changes to Implement

### 1. Code Fix: Replace `select('*')` in profileService.ts

**File:** `src/services/profileService.ts` (line 12)

Replace `.select('*')` with explicit columns:
```ts
.select('id, username, avatar_url, first_name, last_name, bio, location, cover_url, is_verified, created_at, updated_at, deleted_at, username_changed_at, preferences')
```

### 2. Database Migration: Entity Enrichment Queue SELECT Policy

```sql
DROP POLICY IF EXISTS "Allow system select" ON public.entity_enrichment_queue;

CREATE POLICY "Users can view own enrichment requests"
  ON public.entity_enrichment_queue FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY "Admins can view all enrichment requests"
  ON public.entity_enrichment_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### 3. Database Migration: Profiles Column-Level Grants

```sql
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id, username, avatar_url, bio, first_name, last_name,
  location, is_verified, created_at, updated_at,
  cover_url, deleted_at, username_changed_at
) ON public.profiles TO anon;

GRANT SELECT (
  id, username, avatar_url, bio, first_name, last_name,
  location, is_verified, created_at, updated_at,
  cover_url, deleted_at, username_changed_at, preferences
) ON public.profiles TO authenticated;
```

`embedding` and `embedding_updated_at` are NOT granted -- they remain accessible only via `service_role` (edge functions).

### 4. Security Dashboard: Ignore Dependency Warnings

Ignore high/medium dependency vulnerability findings with justification noting they are transitive and deferred to pre-launch audit with per-package triage.

## Execution Order

1. Fix `select('*')` in `profileService.ts`
2. Run enrichment queue policy migration
3. Run profiles column grant migration
4. Update security dashboard findings
5. Verify grants with `information_schema.column_privileges` query

## Validated Column Coverage

| Column | anon | authenticated | service_role |
|--------|------|---------------|--------------|
| id, username, avatar_url, bio | Yes | Yes | Yes |
| first_name, last_name, location | Yes | Yes | Yes |
| is_verified, created_at, updated_at | Yes | Yes | Yes |
| cover_url, deleted_at, username_changed_at | Yes | Yes | Yes |
| preferences | No | Yes | Yes |
| embedding, embedding_updated_at | No | No | Yes |

## Files Changed

| File | Change |
|------|--------|
| `src/services/profileService.ts` | Replace `select('*')` with explicit columns |
| Database migration 1 | Enrichment queue SELECT policy replacement |
| Database migration 2 | Profiles column-level REVOKE + GRANT |
| Security Dashboard | Ignore dependency findings with justification |

