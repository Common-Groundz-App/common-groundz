## Phase 3.3B v7.4 — No-op short-circuit + explicit grants

Both points are valid. Agree.

### Change A: True no-op short-circuit

Inside `admin_moderate_entity`, immediately after loading `current_row` and running the `_expected_status` and `invalid_transition` guards — **before** setting any GUC and **before** the UPDATE — short-circuit:

```sql
IF _action = 'approve' AND current_row.approval_status = 'approved' THEN
  RETURN current_row;
END IF;

IF _action = 'reject' AND current_row.approval_status = 'rejected' THEN
  RETURN current_row;
END IF;
```

Effect: `approved → approved` and `rejected → rejected` no longer touch `approved_by/at`, `rejected_by/at`, or `rejection_reason`, and no audit row is written. Matches the originally documented "no audit row on no-op" contract. Changing a rejection reason later, if ever needed, becomes a separate explicit audited action — out of scope for 3.3B.

This also lets us drop the `did_change` variable; the audit `INSERT` becomes unconditional in the remaining code path, since by the time we reach it we know the status really changed.

### Change B: Re-assert RPC permissions

After the `CREATE OR REPLACE FUNCTION public.admin_moderate_entity(...)`:

```sql
REVOKE ALL ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_entity(uuid, text, uuid, text, text)
  TO service_role;
```

Defensive — Postgres normally preserves grants across `CREATE OR REPLACE`, but restating keeps the surface explicit and grep-able.

### Nothing else changes

- The BEFORE UPDATE trigger update from v7.3 (now also protecting `created_by`) stays as-is.
- The `rejected → approved` block from v7.3 stays.
- Dual-GUC bypass, `_expected_status` optimistic-concurrency check, edge function, UI — all untouched.

### Acceptance checks (delta only)

1. `admin_moderate_entity(<approved_id>, 'approve', <admin>, NULL, NULL)` → returns the row unchanged; `approved_at` is **not** bumped; zero new `admin_actions` rows.
2. `admin_moderate_entity(<rejected_id>, 'reject', <admin>, 'new reason', NULL)` → returns the row unchanged; `rejection_reason` is **not** overwritten; zero new `admin_actions` rows.
3. `pending → approved`, `pending → rejected`, `approved → rejected` still write exactly one audit row and update moderation columns.
4. `rejected → approved` still raises `invalid_transition`.
5. `SELECT has_function_privilege('authenticated', 'public.admin_moderate_entity(uuid,text,uuid,text,text)', 'EXECUTE')` → `false`.

After approval I'll ship the patch migration only — no code or UI changes needed.
