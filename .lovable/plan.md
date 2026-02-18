

# Security Remediation -- Final Implementation Plan

This is the complete, approved plan with all feedback incorporated. No scope changes from the previously agreed work -- only two quality improvements added.

---

## Changes From Previous Plan

| Addition | Source | What Changed |
|----------|--------|-------------|
| Idempotent migration SQL | Codex | All DROP/CREATE POLICY statements now use `IF EXISTS` guards |
| Auth before JSON parse | Codex | Auth/admin checks moved above `await req.json()` in all edge functions |

---

## Execution Order

### Step 1: Edge Functions (Auth + Admin Check + Error Sanitization)

**Auth pattern for all three functions (applied BEFORE request body parsing):**

```text
1. Handle CORS OPTIONS
2. Extract Authorization header
3. If missing/invalid format -> return 401 (before parsing body)
4. Validate JWT via getClaims(token)
5. If invalid -> return 401
6. Use service_role client to check has_role(user.id, 'admin')
7. If not admin -> return 403
8. THEN parse request body and proceed with business logic
9. Catch: console.error(error), return generic { error: 'Internal error', code: 'INTERNAL_ERROR' }
```

**a) `supabase/functions/create-brand-entity/index.ts`**
- Auth + admin check BEFORE `await req.json()`
- Derive `created_by` from authenticated user (ignore client `userId`)
- Sanitize error responses (generic message to client, full details in console.error)

**b) `supabase/functions/analyze-entity-url/index.ts`**
- Auth + admin check BEFORE `await req.json()`
- Remove `error.message` and `error.stack` from client responses
- Keep validation errors ("URL is required") specific since they are not internal details

**c) `supabase/functions/ensure-bucket-policies/index.ts`**
- Auth + admin check BEFORE `await req.json()`
- Add bucket name allowlist: only `entity-images` and `post_media` allowed
- Reject any other bucket name with 400 status
- Sanitize error responses

### Step 2: Database Migration (Idempotent RLS Tightening)

All statements use `IF EXISTS` / `IF NOT EXISTS` guards for safe re-runs.

**a) Drop redundant entities UPDATE policy:**
```sql
DROP POLICY IF EXISTS "Admins can manage entity lifecycle" ON public.entities;
```

**b) Lock down `cached_photos` writes:**
```sql
DROP POLICY IF EXISTS "Admins can update cached photos" ON public.cached_photos;
CREATE POLICY "Admins can update cached photos"
  ON public.cached_photos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete cached photos" ON public.cached_photos;
CREATE POLICY "Admins can delete cached photos"
  ON public.cached_photos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

**c) Lock down `photo_cache_sessions` writes:**
```sql
DROP POLICY IF EXISTS "Admins can insert photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can insert photo cache sessions"
  ON public.photo_cache_sessions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can update photo cache sessions"
  ON public.photo_cache_sessions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete photo cache sessions" ON public.photo_cache_sessions;
CREATE POLICY "Admins can delete photo cache sessions"
  ON public.photo_cache_sessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Step 3: Frontend Fixes

**a) `src/components/entity-v4/PhotosSection.tsx` (line 561)**
Replace `innerHTML` with safe DOM manipulation using `textContent`.

**b) `src/components/profile/reviews/ReviewCard.tsx` (line 68)**
Replace `user?.email?.includes('@lovable.dev')` with server-side `supabase.rpc('is_admin_user', { user_email })` -- matching the existing AdminRoute pattern.

### Step 4: Manual Dashboard Actions (You Do These)

| Issue | Where | Action |
|-------|-------|--------|
| Extension in Public | Dashboard > Database > Extensions | Move `pg_net` and `vector` to `extensions` schema |
| Leaked Password Protection | Dashboard > Authentication > Settings | Verify enabled |
| Postgres Version | Dashboard > Settings > Infrastructure | Upgrade to latest |

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/create-brand-entity/index.ts` | JWT auth + UID admin check (before body parse) + server-side user ID + error sanitization |
| `supabase/functions/analyze-entity-url/index.ts` | JWT auth + UID admin check (before body parse) + error sanitization |
| `supabase/functions/ensure-bucket-policies/index.ts` | JWT auth + UID admin check (before body parse) + bucket allowlist + error sanitization |
| `src/components/entity-v4/PhotosSection.tsx` | Replace innerHTML with textContent |
| `src/components/profile/reviews/ReviewCard.tsx` | Replace client-side admin check with server-side RPC |
| DB Migration | Idempotent: drop redundant entity UPDATE policy, add write restrictions on cached_photos + photo_cache_sessions |

Nothing else changes.

## Future Work (Not This Task)

- Migrate all `is_admin_user(email)` calls to `has_role(uid, 'admin')` across the codebase for consistency.

