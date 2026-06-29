## Phase 3.3B v7.3 — Patch migration

I agree with both blockers. They're real and match the originally approved plan. Proposing a small patch migration on top of v7.2 (no rollback of what's already live).

### Change 1: Protect `created_by` in BEFORE UPDATE trigger

Recreate `public.entities_protect_moderation_fields()` so `fields_changed` also detects:

```sql
OR NEW.created_by IS DISTINCT FROM OLD.created_by
```

Same dual-GUC bypass logic, same admin check, same error code. Only the change-detection set widens. Net effect: only admins (or the verified moderation RPC) can alter `created_by`. Closes the spoofing gap on UPDATE that mirrors the INSERT-side fix.

### Change 2: Block `rejected → approved` in `admin_moderate_entity`

Inside the RPC, after loading `current_row` and before the UPDATE, add:

```sql
IF current_row.approval_status = 'rejected' AND _action = 'approve' THEN
  RAISE EXCEPTION 'invalid_transition: re-approve/un-reject is out of scope for 3.3B'
    USING ERRCODE = '22023';
END IF;
```

Allowed transitions after this patch:
- `pending → approved`
- `pending → rejected`
- `approved → rejected` (post-hoc takedown — still in scope)
- `approved → approved` no-op (no audit row)
- `rejected → rejected` no-op (no audit row)

Blocked:
- `rejected → approved` → 400 from edge function (mapped via `invalid_transition` substring).

### Edge function tweak

`supabase/functions/moderate-entity/index.ts` already maps `conflict` → 409 and generic errors → 500. Add one more mapping so the new exception surfaces cleanly:

```ts
if (msg.includes('invalid_transition')) return json(409, { error: msg });
```

(409 fits better than 400 here — it's a state conflict, not a bad request shape.)

### No other changes

- No schema changes.
- No RLS changes.
- No UI changes — the Moderation queue only shows `pending`, so the blocked transition isn't reachable from the current UI anyway; this is defense-in-depth for the RPC surface.
- `admin_pending_entity_count`, `check_entity_creation_quota`, INSERT trigger, GUC handling, preflight — all untouched.

### Acceptance checks (delta only)

1. As admin, `UPDATE entities SET created_by = '<other-uuid>' WHERE id = '<mine>'` from a normal client session → `42501 insufficient_privilege`.
2. Call `admin_moderate_entity(<rejected_id>, 'approve', <admin_uuid>, NULL, 'rejected')` → raises `invalid_transition`, no row mutated, no `admin_actions` row written.
3. `pending → approved`, `pending → rejected`, `approved → rejected` still succeed and write exactly one audit row each.
4. `approved → approved` and `rejected → rejected` no-ops still write zero audit rows.

After approval I'll ship the patch migration + the one-line edge function mapping, then re-run the relevant acceptance checks before moving to 3.4.
