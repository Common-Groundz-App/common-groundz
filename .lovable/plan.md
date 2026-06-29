
# Phase 3.3B v7.2 — Moderation rails (hardened bypass)

Same scope as v7.1, with three security/correctness fixes from review:

1. **Dual-GUC bypass in the BEFORE UPDATE trigger.** The trigger no longer trusts `app.bypass_approval` alone. It also requires `app.moderation_actor_id` to be set to a uuid that `has_role(..., 'admin')` confirms. Closes the failure mode where a future SECURITY DEFINER function accidentally (or maliciously) sets only `app.bypass_approval`.
2. **`admin_moderate_entity` sets both GUCs.** Before the UPDATE: `set_config('app.bypass_approval','admin_verified', true)` **and** `set_config('app.moderation_actor_id', _actor_id::text, true)`. Both are cleared after the UPDATE.
3. **CHECK constraint is dropped and recreated**, not "added if missing", so the definition is guaranteed to be exactly `approval_status IN ('approved','pending','rejected')`.

Everything else is unchanged from v7.1 (see [.lovable/plan.md](mem://) for the full text):

- Service-role insert audit: confirmed only `create-brand-entity` inserts into `entities`; no code change needed.
- Preflight: abort on unexpected `approval_status` values; abort on any unexpected permissive SELECT/ALL policy on `public.entities`.
- New moderation columns (`approved_by/at`, `rejected_by/at`, `rejection_reason`).
- Backfill only NULL `approval_status` rows.
- `DEFAULT 'pending'`, `NOT NULL`, pending-queue partial index, secondary status index.
- `app_config` flag `entity_creation.non_admin_enabled` + `is_non_admin_entity_creation_enabled()` helper granted only to `authenticated` and `service_role`.
- BEFORE INSERT trigger forces `created_by := auth.uid()` for client sessions, requires service-role to supply `created_by`, and routes admin vs non-admin to `approved` vs `pending`.
- `admin_moderate_entity(entity_id, action, actor_id, reason, expected_status)` — service-role only, approve/reject only (no reset), optimistic concurrency, post-hoc takedown allowed, audit row written only on a real status transition.
- `admin_pending_entity_count()` — admin-only, for the nav badge.
- `check_entity_creation_quota(...)` — prepared, unused, locked to self-or-admin.
- RLS swap: public sees approved + pending, never rejected (creator + admins still see their own rejected rows); non-admin INSERT stays blocked behind the flag.
- Edge function `moderate-entity` with Deno tests (approve, reject-with-reason, missing reason → 400, non-admin → 403, conflict → 409, idempotent no-op writes no audit row).
- Admin UI: Moderation tab in `AdminPortal`, `PendingEntitiesQueue`, `RejectEntityDialog`, `EntityModerationBanner` (creator/admin only), `EntityApprovalChip` (admin contexts only).
- Acceptance checks 1–11 unchanged.

## Technical detail for the three changes

**BEFORE UPDATE trigger** (only the bypass block changes):

```sql
DECLARE
  bypass_ok    boolean := false;
  bypass_flag  text;
  actor_text   text;
  actor_uuid   uuid;
BEGIN
  ...
  BEGIN
    bypass_flag := current_setting('app.bypass_approval',     true);
    actor_text  := current_setting('app.moderation_actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    bypass_flag := NULL; actor_text := NULL;
  END;

  IF bypass_flag = 'admin_verified'
     AND actor_text IS NOT NULL AND actor_text <> '' THEN
    BEGIN
      actor_uuid := actor_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      actor_uuid := NULL;
    END;
    IF actor_uuid IS NOT NULL AND public.has_role(actor_uuid, 'admin'::public.app_role) THEN
      bypass_ok := true;
    END IF;
  END IF;

  IF NOT (is_admin OR bypass_ok) THEN
    RAISE EXCEPTION 'insufficient_privilege: moderation fields are admin-only'
      USING ERRCODE = '42501';
  END IF;
```

**`admin_moderate_entity`** (GUC block):

```sql
PERFORM set_config('app.bypass_approval',     'admin_verified',     true);
PERFORM set_config('app.moderation_actor_id', _actor_id::text,      true);
-- ... UPDATE ...
PERFORM set_config('app.bypass_approval',     '', true);
PERFORM set_config('app.moderation_actor_id', '', true);
```

**CHECK constraint**:

```sql
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_approval_status_check;
ALTER TABLE public.entities
  ADD CONSTRAINT entities_approval_status_check
  CHECK (approval_status IN ('approved','pending','rejected'));
```

## Net effect

No functional behavior change for the happy paths in acceptance checks 1–11; the dual-GUC requirement only matters for hypothetical future paths that try to bypass the trigger. The migration remains a single file, no new RPCs, no schema additions beyond v7.1.

After approval I'll run the migration, then implement the `moderate-entity` edge function + tests, the AdminPortal Moderation tab, the queue, the reject dialog, and the moderation banner / chip, and post the acceptance-check results before moving to 3.4.
