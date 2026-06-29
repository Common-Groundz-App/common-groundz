
# Phase 3.3B v7.1 — Moderation rails (revised)

Folds in three of ChatGPT's points (SELECT-policy preflight, drop `reset`, add pending-count RPC) and explicitly keeps the post-hoc takedown semantics that point 3 would have broken.

---

## Service-role insert audit (confirmed, no code change)

- Only `create-brand-entity` inserts into `public.entities`. `extract-product-relationships` inserts only into `user_stuff`, `user_entity_journeys`, `product_relationships` — no action needed there.
- `create-brand-entity` runs admin-gated, uses `supabaseAdmin` (service-role, so `auth.uid()` is NULL inside the trigger), and passes `created_by: userId` derived from the verified JWT.
- Under the new BEFORE INSERT trigger this path lands as `approved` (admin actor) without any code change. Verified by acceptance check 4a below.

---

## 1. Migration (single file)

### 1a. Preflight — abort on unexpected state
- **Bad approval values.** Abort if any row has `approval_status` outside `{approved, pending, rejected, NULL}`.
- **Unexpected permissive SELECT policies (NEW).** Whitelist the SELECT policies allowed to remain on `public.entities`:
  - `Admins can view deleted entities` (admin-only)
  - `Admins can manage all entities` (admin-only, ALL command)
  - `Anyone can view non-deleted entities` (the one we're about to drop)
  Abort the migration if any other SELECT or ALL policy exists on the table. Prevents a future broad policy from silently exposing `rejected` rows.

### 1b. Columns
Add to `entities`: `approved_by uuid`, `approved_at timestamptz`, `rejected_by uuid`, `rejected_at timestamptz`, `rejection_reason text`.

### 1c. Backfill (NULL only)
`UPDATE entities SET approval_status='approved', approved_at=COALESCE(approved_at, created_at, now()) WHERE approval_status IS NULL;`
Touches only the legacy rows — preflight already guaranteed no unexpected non-null values.

### 1d. Harden column
- `DEFAULT 'pending'`, `NOT NULL`
- `CHECK (approval_status IN ('approved','pending','rejected'))`
- Indexes: partial index on `(created_at DESC) WHERE approval_status='pending' AND is_deleted=false` for the queue; secondary index on `approval_status WHERE is_deleted=false`.

### 1e. Feature flag
Insert `app_config` row `entity_creation.non_admin_enabled = { enabled: false }`.
Helper `is_non_admin_entity_creation_enabled()` (SECURITY DEFINER, STABLE).
Grants: `authenticated`, `service_role` only — **not** `anon`.

### 1f. BEFORE INSERT trigger `entities_enforce_creation`
- If `auth.uid() IS NOT NULL` → `NEW.created_by := auth.uid()` (no spoofing).
- If `NEW.created_by IS NULL` → raise (service-role must supply it).
- `has_role(NEW.created_by, 'admin')` → `approved` + stamp `approved_by/at`; else `pending`; always clear `rejected_*` and `rejection_reason`.

### 1g. BEFORE UPDATE trigger `entities_protect_moderation_fields`
Block any change to `approval_status`, `approved_by/at`, `rejected_by/at`, `rejection_reason`, `created_by` unless the actor is an admin **or** the transaction-scoped GUC `app.bypass_approval = 'admin_verified'` is set (only `admin_moderate_entity` sets it).

### 1h. RPC `admin_moderate_entity(entity_id, action, actor_id, reason DEFAULT NULL, expected_status DEFAULT NULL)`
- Service-role only (revoke from `anon`/`authenticated`).
- `action ∈ {'approve','reject'}` — **`reset` removed.**
- Verifies `has_role(actor_id,'admin')`.
- `SELECT … FOR UPDATE` the row, then:
  - **Optimistic concurrency:** if `_expected_status` is supplied and current ≠ expected → return `{success:false, code:'STATUS_CONFLICT', current_status, expected_status}`.
  - **Post-hoc takedown semantics retained on purpose:** we do *not* restrict to `pending` rows. Admins must be able to reject an already-`approved` row (the whole point of the post-hoc model). Idempotent no-op (e.g. approve → approve) is handled by the "audit only on real transition" check below.
- Reject requires non-empty `_reason`.
- Sets `set_config('app.bypass_approval','admin_verified', true)`, performs the UPDATE, clears the GUC.
- Inserts `admin_actions` row **only when `old_status ≠ new_status`** (`action_type = 'entity_moderation_' || _action`; schema confirmed via read_query).

### 1i. RPC `admin_pending_entity_count()` (NEW)
- SECURITY DEFINER, STABLE.
- Raises `insufficient_privilege` unless `has_role(auth.uid(),'admin')`.
- Returns `count(*) FROM entities WHERE approval_status='pending' AND is_deleted=false`.
- Grants: `authenticated`, `service_role`.

### 1j. RPC `check_entity_creation_quota(user_id, window_hours=24, max_pending=10)`
Prepared but unused. Locked to self or admin via `auth.uid()` check.

### 1k. RLS swap
- Drop `Anyone can view non-deleted entities`.
- Create `Public can view non-rejected entities`:
  `is_deleted=false AND (approval_status <> 'rejected' OR created_by = auth.uid() OR is_admin_user(auth.jwt()->>'email'))`.
- Drop `Users can create entities`; create `Users can create entities (gated)` requiring authenticated **and** (admin OR `is_non_admin_entity_creation_enabled()`). Keeps non-admin INSERT blocked until the flag flips.

---

## 2. Edge function `moderate-entity`

- JWT auth gate + admin check via `has_role`.
- Body: `{ entityId: uuid, action: 'approve'|'reject', reason?: string, expectedStatus?: 'approved'|'pending'|'rejected' }` (Zod).
- Calls `supabaseAdmin.rpc('admin_moderate_entity', …)` with the verified `actor_id`.
- Surfaces `STATUS_CONFLICT` as HTTP 409 with the server's current status (so UI can refresh).
- Deno tests covering: success approve, success reject (with reason), missing reason on reject → 400, non-admin caller → 403, conflict → 409, idempotent transition writes no audit row.

---

## 3. Admin UI

### `src/pages/AdminPortal.tsx`
- Add **Moderation** tab.
- Tab label shows a count chip fed by `admin_pending_entity_count()` (polled / refetched after each action).

### `src/components/admin/moderation/PendingEntitiesQueue.tsx`
- Paginated list of `is_deleted=false AND approval_status='pending'` ordered by `created_at DESC`.
- Each row: thumbnail, name, type, creator (profile join), created-from URL, "Approve" and "Reject" buttons.
- Reject opens `RejectEntityDialog` requiring a reason (min 5 chars).
- Both actions pass `expectedStatus: 'pending'` to surface conflicts.
- After success, optimistic remove from the list + refetch the badge count.

### `src/components/entity/EntityModerationBanner.tsx`
- Shown on entity detail pages.
- `approval_status === 'pending'` → blue "Awaiting review" banner; visible to creator + admins only (not the general public, even though the row itself is visible, to avoid surfacing the moderation state to random visitors).
- `approval_status === 'rejected'` → only the creator and admins reach this code path (RLS hides the row from others); show red banner with `rejection_reason`.
- `approval_status === 'approved'` → no banner.

### Status chip
- Small reusable `EntityApprovalChip` for admin-only contexts (queue, entity admin edit). Not shown in public UI.

---

## 4. Acceptance checks (run before declaring done)

| # | Scenario | Expected |
|---|---|---|
| 1 | Admin creates a brand via `create-brand-entity` | Row lands `approval_status='approved'`, `approved_by=admin uuid`, no `admin_actions` row (creation, not moderation). |
| 2 | Public anon `SELECT` on entities | Returns approved + pending, never rejected. |
| 3 | Creator `SELECT` on their own rejected row | Returns the row (with rejection_reason). |
| 4a | Service-role insert with `created_by=<admin uuid>` | Trigger keeps that uuid (auth.uid IS NULL), lands `approved`. |
| **4b** | **Authenticated non-admin attempts `INSERT(..., created_by=<admin uuid>, approval_status='approved')`** | **Blocked by INSERT RLS today (flag off). When flag flipped, trigger forces `created_by=auth.uid()` and `approval_status='pending'`.** Test both states. |
| 5 | Non-admin attempts `UPDATE entities SET approval_status='approved' WHERE id=…` | Raises `insufficient_privilege` from BEFORE UPDATE trigger. |
| 6 | Admin calls `moderate-entity { action:'reject', reason:'spam', expectedStatus:'approved' }` on an approved row | Succeeds; row becomes `rejected`; `admin_actions` row written. (Validates post-hoc takedown.) |
| 7 | Two admins reject the same row concurrently | One gets success, the other gets HTTP 409 `STATUS_CONFLICT` with `current_status='rejected'`. |
| 8 | Admin calls `moderate-entity { action:'reject' }` without reason | HTTP 400. |
| 9 | Non-admin calls `moderate-entity` | HTTP 403. |
| 10 | Direct anon RPC to `is_non_admin_entity_creation_enabled()` | Permission denied. |
| 11 | `admin_pending_entity_count()` called as non-admin | Raises `insufficient_privilege`. |

Results posted in chat before moving to 3.4.

---

## Out of scope (deferred)

- Duplicate-merge UX
- Non-admin creation UI / flag flip
- `reset` / un-reject action
- Public-facing "pending review" badge on entity cards

---

## Technical notes

- All new functions: `SET search_path = public`, `SECURITY DEFINER`.
- New triggers named `aa_…` so they sort before `entity_slug_trigger` / `trigger_generate_entity_slug_on_insert` alphabetically (slug logic is unaffected, but earlier execution keeps validation errors clean).
- `is_admin_user(email)` is the legacy email-based admin check used by existing RLS; we keep it in the new SELECT policy for consistency with the other entity policies. All new RPCs/triggers use the canonical `has_role(uuid, app_role)`.
