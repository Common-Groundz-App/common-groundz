## Phase 3A — Mapping table + server-side reconciliation (final)

Backend-only. No composer wiring, no webhook changes, no playback, no UI changes. All four artifacts ship together; verification is curl/SQL only.

---

### Mapping status semantics (locked)

`mux_upload_mappings.status` describes **the reconciliation row**, not the Mux asset:

| status | meaning |
|---|---|
| `pending` | Mapping registered; post media not yet patched. |
| `patched` | Post media JSONB was successfully merged. Includes the case where the Mux asset is `errored` and the media item ends up with `mux_status='errored'` + `mux_error`. The mapping did its job. |
| `orphaned` | Mapping points to a media slot that no longer matches (wrong `mux_upload_id`, wrong type, deleted, etc.). Terminal until an admin requeues with intent. |
| `errored` | Internal reconciliation failure (RPC exception, JSONB corruption). NOT the same as Mux asset failure. Terminal until requeued. |

Mux asset's own state lives in `mux_uploads.status` and in patched `media[i].mux_status` — never confused with mapping status.

### RPC return values (locked, deterministic for requeue)

`patch_content_media_from_mux(p_mapping_id)` returns one of:

- `'patched'` — JSONB merged this call.
- `'noop_not_ready'` — `mux_uploads.status NOT IN ('ready','errored')`, nothing to do yet.
- `'noop_already_patched'` — mapping already `status='patched'`.
- `'noop_orphaned'` — mapping already `status='orphaned'`. Requeue is a no-op; admin must clear `status` first if they really want to retry.
- `'noop_errored'` — mapping already `status='errored'`. Same: requires explicit admin reset before reprocessing.
- `'orphaned'` — discovered orphan THIS call; mapping flipped to `status='orphaned'`, `last_error` written.

Every call also emits a single `console.log({ mapping_id, mux_upload_id, result, mux_status })` line from the edge function caller so logs are greppable per mapping.

---

### Step 1 — Migration

Pre-check: confirm `mux_uploads.upload_id` already has a unique constraint. If absent, add it in this same migration before the FK.

Create `public.mux_upload_mappings`:

- `id uuid pk default gen_random_uuid()`
- `mux_upload_id text not null unique references public.mux_uploads(upload_id) on delete cascade`
- `content_type text not null check (content_type in ('post','review'))`
- `content_id uuid not null`
- `media_index int not null check (media_index >= 0)`
- `user_id uuid not null`
- `status text not null default 'pending' check (status in ('pending','patched','orphaned','errored'))`
- `mux_status_snapshot text` (snapshot of `mux_uploads.status` at patch time)
- `patched_at timestamptz`
- `last_error text`
- `retry_count int not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- Unique `(content_type, content_id, media_index)` — prevents two uploads claiming the same slot
- Indexes: `(content_type, content_id)`, `(user_id)`, partial `(status) WHERE status='pending'`
- `updated_at` trigger reuses existing `update_updated_at_column()`
- RLS enabled, **no policies** — service_role only

### Step 2 — DB function `patch_content_media_from_mux(p_mapping_id uuid) returns text`

`SECURITY DEFINER`, `search_path = public`, idempotent, concurrency-safe.

Logic:
1. Load mapping. Branch on current `status`:
   - `'patched'` → return `'noop_already_patched'`.
   - `'orphaned'` → return `'noop_orphaned'`.
   - `'errored'` → return `'noop_errored'`.
   - `'pending'` → continue.
2. Load matching `mux_uploads` by `upload_id`. If missing or `status NOT IN ('ready','errored')` → return `'noop_not_ready'`.
3. **`SELECT … FROM posts WHERE id = mapping.content_id FOR UPDATE`** — row lock prevents webhook + register catch-up + manual requeue from clobbering the same JSONB.
4. Validate `media[media_index]` exists, `type='video'`, `provider='mux'`, `mux_upload_id` matches. On mismatch → set mapping `status='orphaned'`, write `last_error`, return `'orphaned'`.
5. Merge into the JSONB element:
   - Asset `ready` → set `mux_asset_id`, `mux_playback_id`, `duration`, `aspect_ratio`, `mux_status='ready'`. Leave `url` (poster) untouched — Phase 4 derives HLS from `mux_playback_id`. Mapping `status='patched'`.
   - Asset `errored` → set `mux_status='errored'`, `mux_error = mux_uploads.error`. Mapping `status='patched'` (per semantics).
6. Write JSONB back, snapshot `mux_status_snapshot`, set `patched_at = now()`, return `'patched'`.
7. Any uncaught exception → edge function caller catches, updates mapping to `status='errored'` + `last_error`, increments `retry_count`.

Review branch in the same function body (`reviews` table, same pattern) so the future reviews mini-phase needs no schema/RPC change.

### Step 3 — Edge function `mux-register-mappings` (new)

`supabase/config.toml`: **add no entry** → defaults to `verify_jwt = true`. Still validate JWT in code as belt-and-suspenders.

CORS: mirror `mux-create-upload`.

Body (zod-validated):
```ts
{ content_type: 'post', content_id: uuid, items: [{ mux_upload_id: string, media_index: int >= 0 }] }
```

Logic:
1. `getClaims()` → `userId`. 401 if missing.
2. Verify ownership: `SELECT id FROM posts WHERE id = content_id AND user_id = userId`. 403 if not.
3. For each item (sequential, single connection):
   a. `INSERT … ON CONFLICT (mux_upload_id) DO NOTHING RETURNING id`.
   b. If conflict (no row returned), `SELECT` the existing mapping. Compare `(user_id, content_id, media_index)`:
      - All match → `{ status: 'already_registered' }`.
      - Mismatch → `{ status: 'conflict', error: 'upload_already_mapped_to_different_content' }`. No 500.
   c. Catch `unique_violation` on `(content_type, content_id, media_index)` → `{ status: 'slot_taken' }`.
   d. **Catch-up:** if the mapping was newly inserted (step a returned an id), check `mux_uploads.status` — if `'ready'` or `'errored'`, call `patch_content_media_from_mux(mapping_id)` and surface its return value. Wrap in try/catch; on error set mapping `status='errored'`, `last_error`, return `{ status: 'errored', error }` for that item.
   e. Log `{ mapping_id, mux_upload_id, result }`.
4. Response: `{ results: [{ mux_upload_id, status, error? }] }`. HTTP 200 even with per-item errors.

### Step 4 — Edge function `mux-reconcile-upload` (admin/service requeue)

`supabase/config.toml`: **add no entry** → defaults to `verify_jwt = true`.

Body: `{ mux_upload_id: string }`.

**Two-tier access:**
1. Service-role JWT (header check — `role: 'service_role'` claim) → allowed.
2. Otherwise `getClaims()` + `supabase.rpc('has_role', { _user_id: uid, _role: 'admin' })` must return `true`. Any other authenticated caller → 403.

Logic:
- Look up mapping by `mux_upload_id`. If none → 404.
- Call `patch_content_media_from_mux(mapping_id)`. Catch + update mapping on error.
- Log `{ mapping_id, mux_upload_id, result }`.
- Return `{ status, mapping_id, last_error? }`.

A `noop_orphaned` / `noop_errored` response tells the admin: "this mapping is terminal; if you really want to retry, manually flip `status` back to `'pending'` first and call again."

### Step 5 — `supabase/config.toml`

**Add nothing.** Both new functions use the default `verify_jwt = true`. Do NOT add entries setting them to false.

Existing `mux-create-upload` (`verify_jwt=false` + in-code validation) and `mux-webhook` (`verify_jwt=false` because Mux can't send Supabase JWTs) stay as-is. Hardening `mux-create-upload` is a future cleanup, not a blocker.

---

### Verification (curl + SQL only; no real user posts touched)

Throwaway test post under a test account, OR existing already-ready Mux test upload. Never mutate Hana Li's or any real user's row.

1. **Happy path (ready):** Insert mapping for the test post pointing at an already-ready `mux_upload_id`. Curl `mux-reconcile-upload` → `{ status: 'patched' }`. SQL: test post's `media[0]` has `mux_playback_id` + `mux_status='ready'`; mapping `status='patched'`, `patched_at` set.
2. **Happy path (errored):** If you can stage an errored `mux_uploads` row, repeat → media item gets `mux_status='errored'` + `mux_error`; mapping `status='patched'`.
3. **Ownership 403:** Curl `mux-register-mappings` with `content_id` not owned by caller → 403.
4. **Idempotent register:** Curl `mux-register-mappings` twice with identical payload → second returns `'already_registered'`; no duplicate row.
5. **Cross-content conflict:** Curl with `mux_upload_id` already mapped to a different `content_id` → `{ status: 'conflict' }`, no 500.
6. **Slot conflict:** Curl with `(content_id, media_index)` already taken by a different upload → `{ status: 'slot_taken' }`.
7. **Catch-up on register:** Register an upload that's already `ready` → item status is `'patched'`, not `'pending'`.
8. **Reconcile access control:** Curl `mux-reconcile-upload` as a normal authenticated (non-admin) user → 403. Unauthenticated → 401.
9. **Idempotent patch:** Curl `mux-reconcile-upload` twice on patched mapping → second returns `'noop_already_patched'`.
10. **Terminal-state noops:** Manually `UPDATE mux_upload_mappings SET status='orphaned'` on a test mapping; curl reconcile → `'noop_orphaned'`. Repeat with `status='errored'` → `'noop_errored'`. Confirm post JSONB is **not** mutated in either case.

### Rollback

Drop both edge functions; drop `patch_content_media_from_mux`; drop the table (FK cascade safely removes mappings, leaves `mux_uploads` and `posts` untouched).

---

### Out of scope for 3A (lands in 3B)

- Composer `invoke('mux-register-mappings')` after post create.
- `mux-webhook` extension to call the RPC on `video.asset.ready` / `.errored`.
- `MuxErroredPoster` UI + branching renderers on `isMuxErrored`.
- Edit-path reconciliation, reviews wiring, HLS playback, Phase 5 retry/telemetry polish.
- Hardening `mux-create-upload` to `verify_jwt=true` (deferred cleanup).
