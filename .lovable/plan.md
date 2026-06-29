## Phase 3.3B v7 — Moderation & Rollout Safety Rails (final, ready to build)

v7 keeps the entire v6 design and folds in three corrections from the reviewers. No architectural change.

Product model (unchanged, confirmed correct):
- `approved` → public
- `pending` → public (creator's first post/review is visible to everyone immediately)
- `rejected` → hidden from public; creator + admins still see it with reason
- Moderation is **post-hoc takedown**, never pre-publication gating

---

### Changes from v6 (the only diffs)

**Fix 1 — Trigger `created_by` spoofing (blocker, Codex)**

v6 used `NEW.created_by := COALESCE(NEW.created_by, auth.uid())`. For an authenticated non-admin client that supplies `created_by = '<admin-uuid>'`, COALESCE preserves the spoofed value and the next branch (`has_role(NEW.created_by,'admin')`) auto-approves the row.

Restore the safe form: whenever there is an authenticated client session, overwrite unconditionally; only fall back to a client-supplied value when there is no session (service-role path), and require it to be present.

```sql
-- BEFORE INSERT ON public.entities
IF auth.uid() IS NOT NULL THEN
  NEW.created_by := auth.uid();   -- client cannot spoof
END IF;

IF NEW.created_by IS NULL THEN
  RAISE EXCEPTION 'created_by required' USING ERRCODE = '23502';
END IF;

IF public.has_role(NEW.created_by, 'admin') THEN
  NEW.approval_status := 'approved';
  NEW.approved_by     := NEW.created_by;
  NEW.approved_at     := now();
  NEW.rejection_reason := NULL;
  NEW.rejected_by      := NULL;
  NEW.rejected_at      := NULL;
ELSE
  NEW.approval_status := 'pending';
  NEW.approved_by     := NULL;
  NEW.approved_at     := NULL;
  NEW.rejection_reason := NULL;
  NEW.rejected_by      := NULL;
  NEW.rejected_at      := NULL;
END IF;

RETURN NEW;
```

Note: service-role edge functions (`create-brand-entity`, `extract-product-relationships`) run with no `auth.uid()`, so the `IF auth.uid() IS NOT NULL` branch is skipped and the explicit `NEW.created_by` they pass is honoured — that is the legitimate "system actor" path validated by the service-role insert audit (step 1 below).

**Fix 2 — Backfill only NULLs, abort on unexpected values (Codex)**

v6 had two conflicting statements: a preflight that aborts on unexpected `approval_status` values, and a backfill that silently rewrote them to `approved`. Drop the silent rewrite; only normalise NULL legacy rows.

```sql
-- Preflight: abort if any unexpected non-null value exists
DO $$
DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM public.entities
  WHERE approval_status IS NOT NULL
    AND approval_status NOT IN ('approved','pending','rejected');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Aborting: % entities have unexpected approval_status values', bad_count;
  END IF;
END $$;

-- Only NULL legacy rows are trusted-converted (current snapshot: 0 nulls)
UPDATE public.entities
SET approval_status = 'approved'
WHERE approval_status IS NULL;
```

**Fix 3 — Helper grants: drop `anon` (both reviewers)**

`public.is_non_admin_entity_creation_enabled()` reveals a private `entity_creation.*` flag. Anonymous users cannot INSERT anyway, so `anon` does not need it.

```sql
REVOKE ALL ON FUNCTION public.is_non_admin_entity_creation_enabled() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_non_admin_entity_creation_enabled() TO authenticated, service_role;
```

**Acceptance check #4 expanded (Codex)**
Acceptance check #4 now explicitly covers the spoofing attempt: as a non-admin authenticated session, attempt `INSERT … (created_by = '<known-admin-uuid>', approval_status = 'approved')`. Result must be: row inserted with `created_by = auth.uid()` (the caller, not the spoofed admin) and `approval_status = 'pending'`. Verify the spoofed admin uuid does **not** appear anywhere on the row.

---

### Everything else carried forward from v6 (unchanged)

**Trust chain** for moderation — unchanged from v6:
```text
client JWT
  → moderate-entity edge function: supabase.auth.getClaims(token)
  → edge function verifies has_role(claims.sub, 'admin') via service role
  → edge function (service-role client) calls admin_moderate_entity_wrapped(_entity_id, _action, _reason, _actor := claims.sub)
  → wrapper re-checks has_role(_actor, 'admin')
  → wrapper sets app.moderation_actor_id + app.bypass_approval GUCs (is_local := true)
  → wrapper calls admin_moderate_entity(_entity_id, _action, _reason)
  → inner RPC reads GUC, re-verifies admin, UPDATE … RETURNING … INTO, audit row only on real change
```
Client-supplied actor is never trusted; the wrapper is callable only by `service_role`.

**RLS on `public.entities`** — unchanged from v6:
- Preflight `SELECT polname FROM pg_policy WHERE polrelid='public.entities'::regclass AND polcmd='r'`; abort on any unexpected permissive SELECT policy.
- Drop `Anyone can view non-deleted entities`.
- `Public sees non-rejected entities`: `is_deleted=false AND approval_status <> 'rejected'`.
- `Creators see own entities`: `is_deleted=false AND created_by = auth.uid()`.
- Existing admin ALL policy unchanged.
- INSERT policy:
```sql
CREATE POLICY "Users can create entities" ON public.entities
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR (
      auth.uid() IS NOT NULL
      AND created_by = auth.uid()
      AND public.is_non_admin_entity_creation_enabled()
    )
  );
```

**Column hardening** — unchanged from v6:
- `approval_status NOT NULL DEFAULT 'pending'`, CHECK in `('approved','pending','rejected')`.
- Add `approved_by`, `approved_at`, `rejection_reason`, `rejected_by`, `rejected_at`.
- Partial index `entities_pending_idx (created_at DESC) WHERE approval_status='pending' AND is_deleted=false`.

**`BEFORE UPDATE` trigger guard** — unchanged from v6 (null-safe cast preserved):
Protect `approval_status, approved_by, approved_at, rejection_reason, rejected_by, rejected_at, created_by` unless:
```sql
public.has_role(auth.uid(),'admin')
OR (
  current_setting('app.bypass_approval', true) = 'admin_verified'
  AND public.has_role(NULLIF(current_setting('app.moderation_actor_id', true), '')::uuid, 'admin')
)
```

**Moderation RPCs** — unchanged from v6:
- `admin_moderate_entity(_entity_id, _action, _reason)` — SECURITY DEFINER, locked `search_path=public`. Reads actor via `NULLIF(current_setting('app.moderation_actor_id', true), '')::uuid`; re-checks admin (raises `42501` if false); validates action; reject requires reason (`22023` if missing); `UPDATE … WHERE approval_status='pending' RETURNING id INTO _changed`; raises `40001` `already_moderated` if NULL; writes `admin_actions` only on success. `REVOKE ALL FROM public, anon, authenticated; GRANT EXECUTE TO service_role`.
- `admin_moderate_entity_wrapped(_entity_id, _action, _reason, _actor)` — SECURITY DEFINER, locked search_path. Re-checks `has_role(_actor,'admin')`; `set_config('app.moderation_actor_id', _actor::text, true)`; `set_config('app.bypass_approval', 'admin_verified', true)`; calls inner. `REVOKE ALL FROM public, anon, authenticated; GRANT EXECUTE TO service_role`.

**Helper functions** — unchanged from v6 except Fix 3 above:
- `public.is_non_admin_entity_creation_enabled()` — SECURITY DEFINER, STABLE, locked search_path. **Grants: `authenticated, service_role` only (no `anon`).**
- `public.admin_pending_entity_count()` — SECURITY DEFINER, returns 0 for non-admins, real count for admins. `GRANT EXECUTE TO authenticated, service_role`.
- `public.check_entity_creation_quota(_user_id uuid)` — internal guard `auth.uid() = _user_id OR has_role(auth.uid(),'admin')` else raise `forbidden`. `REVOKE ALL FROM public, anon; GRANT EXECUTE TO authenticated, service_role`. Not wired to UI in 3.3B.

**app_config seeds** (ON CONFLICT DO NOTHING) — unchanged:
- `entity_creation.non_admin_enabled` → `{"enabled": false}`
- `entity_creation.daily_quota_non_admin` → `{"cap": 5}`
- Verify `get_public_flags()` does not expose either key.

**Edge function `supabase/functions/moderate-entity/index.ts`** — unchanged from v6:
- 401 if no Bearer; `getClaims(token)` → 401 on failure
- Service-role admin gate via `has_role(claims.sub,'admin')` → 403 on false
- Body schema (zod): `{ entity_id: uuid, action: 'approve'|'reject', reason?: string }`; reject requires non-empty reason
- Calls `admin_moderate_entity_wrapped(entity_id, action, reason, claims.sub)` via service-role client
- Error mapping: `forbidden`→403, `already_moderated`→409, `reason_required`/`bad_action`→400
- Deno tests: 401, 403, 200 first approve, 409 second approve same row, `admin_actions` delta = +1 only

**Admin Moderation UI** — unchanged from v6:
- New "Moderation" tab inside `AdminPortal.tsx` (no new top-level route)
- `src/components/admin/moderation/PendingEntitiesQueue.tsx` — single-row approve/reject (no bulk)
- `src/components/admin/moderation/RejectEntityDialog.tsx` — non-empty reason required
- `src/components/entity/EntityModerationBanner.tsx`:
  - Public on pending: render nothing
  - Creator on pending: "Awaiting review — visible to everyone"
  - Creator on rejected: banner with `rejection_reason`
  - Admin on pending: inline Approve / Reject
- Admin entity list/cards render `Pending` / `Rejected` chips
- Nav badge fed by `admin_pending_entity_count()`
- Hooks: `src/hooks/admin/usePendingEntities.ts`, `usePendingEntityCount.ts`

**Out of scope (3.4+)** — unchanged:
`create-entity-as-user`, bulk moderation, re-approve / un-reject, creator notifications, duplicate-merge UX, public Submit-an-Entity UI.

---

### Implementation order (strict)

1. **Service-role insert audit (BLOCKING).** Read every `entities` insert in `supabase/functions/extract-product-relationships/index.ts` (lines 182, 502, 577). For each:
   - If a real user actor is in scope → set `created_by = userId`, expected status `approved` (admin) or `pending` (non-admin)
   - If not → choose explicit strategy: (a) skip insert, (b) stamp a system-admin uuid from `app_config.system_actor.entity_auto_create`, or (c) refactor caller to pass actor
   - Re-confirm `create-brand-entity` already passes `created_by` (admin actor) and will land as `approved`.
   - Confirm no other edge function writes to `entities`.
   - Record the decision per insert site in `.lovable/plan.md` **before** the migration runs.
2. **Migration** (single file): preflight (NULL-only backfill + abort on unexpected non-null + unexpected SELECT policy check), column hardening, triggers (with Fix 1 form), RLS swap, partial index, 5 functions (`is_non_admin_entity_creation_enabled` with Fix 3 grants, `admin_pending_entity_count`, `check_entity_creation_quota`, `admin_moderate_entity`, `admin_moderate_entity_wrapped`), app_config seeds.
3. **`moderate-entity` edge function** + Deno tests.
4. **AdminPortal Moderation tab** + reject dialog + nav badge.
5. **`EntityModerationBanner`** + admin chips.
6. Run **all 14 acceptance checks**; share results before any 3.4 work.

### Acceptance checks (14 total, snapshot-based)

Capture `publicCountBefore = count(*) FROM entities WHERE is_deleted=false` as anon before starting.

1. Migration day: anon `publicCountAfter == publicCountBefore`.
2. Admin rejects 1 pending row → anon count drops by exactly 1; creator still sees row + reason; admin sees row.
3. Admin creates via `CreateEntityDialog` → row is `approved` immediately.
4. **Spoofing check (Fix 1):** Flag `false`: simulated non-admin direct insert → RLS 403. Flag `true`: insert succeeds as `pending`; non-admin attempt with `created_by = '<known-admin-uuid>'` and `approval_status = 'approved'` → row persisted with `created_by = auth.uid()` (caller, not the spoofed admin) and `approval_status = 'pending'`; the spoofed admin uuid appears nowhere on the row.
5. Non-admin `UPDATE approval_status` → trigger blocks, row unchanged.
6. `moderate-entity` approve → 200, `admin_actions` +1. Second approve same row → 409, `admin_actions` unchanged.
7. Reject without reason → 400. With reason → row hidden from public, creator banner shows reason.
8. Direct authenticated `supabase.rpc('admin_moderate_entity', …)` → permission denied. Same for `admin_moderate_entity_wrapped`.
9. `admin_pending_entity_count()` as non-admin → 0; as admin → real count.
10. `select get_public_flags()` does **not** expose any `entity_creation.*` key.
11. Preflight: temporarily add a dummy permissive SELECT policy on an `entities` clone → migration aborts with clear error.
12. `create-brand-entity` end-to-end (admin) → created brand is `approved`.
13. `extract-product-relationships` end-to-end against a test product URL → every inserted row has non-null `created_by` and the documented `approval_status` per the audit decision.
14. Direct authenticated `supabase.rpc('check_entity_creation_quota', { _user_id: '<other-user-uuid>' })` → permission denied; with own uuid → returns count. **Also:** direct anon `supabase.rpc('is_non_admin_entity_creation_enabled')` → permission denied (Fix 3 verification).

### Files

**Add**
- One migration (preflight, columns, triggers, RLS swap, partial index, 5 functions with locked grants, app_config seeds).
- `supabase/functions/moderate-entity/index.ts` + `index_test.ts`.
- `src/components/admin/moderation/PendingEntitiesQueue.tsx`
- `src/components/admin/moderation/RejectEntityDialog.tsx`
- `src/components/entity/EntityModerationBanner.tsx`
- `src/hooks/admin/usePendingEntities.ts`, `usePendingEntityCount.ts`

**Edit**
- `src/pages/AdminPortal.tsx` — add Moderation tab + badge slot.
- Admin entity list/card components — Pending/Rejected chips.
- Entity detail page — mount `EntityModerationBanner`.
- `supabase/functions/extract-product-relationships/index.ts` — apply audit decisions from step 1.

**Not touched**
- `CreateEntityDialog.tsx` (admin-only writer; trigger handles status).
- `useAppConfig.ts` / `get_public_flags` (creation/quota flags stay private).
- Any non-admin creation surface (none exists in 3.3B).
