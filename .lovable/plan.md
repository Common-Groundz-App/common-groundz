## Phase 3A — Revised migration + RPC (post-only, hardened)

Same scope as before (mapping table + reconciliation RPC + two edge functions, server-side only, no client/webhook/UI changes). This revision incorporates the three reviewer notes plus one extra integrity guard.

### Changes from the previous draft

1. **Post-only scope in 3A.** CHECK constraint narrowed to `content_type IN ('post')`. Review branch removed from `patch_content_media_from_mux`. When reviews wiring lands in its own mini-phase, the constraint is widened (`DROP CONSTRAINT … ADD CONSTRAINT … CHECK (content_type IN ('post','review'))`) and a `review` branch is added to the RPC. No dead code in the meantime.

2. **Defense-in-depth ownership checks inside the RPC.** Even though `mux-register-mappings` validates `posts.user_id = caller`, the SECURITY DEFINER function re-validates:
   - `mux_uploads.user_id = mapping.user_id` (the upload belongs to the mapping's user)
   - `posts.user_id      = mapping.user_id` (the target post belongs to the mapping's user)
   Mismatch on either → mapping flipped to `status='orphaned'`, `last_error='ownership_mismatch'`, return `'orphaned'`. JSONB is **not** mutated.

3. **`mux_asset_id` patched on errored too** (when available). Useful for support/debugging.

4. **(New) Integrity guard for ready uploads.** If `v_upload.status='ready'` but `v_upload.asset_id IS NULL` or `v_upload.playback_id IS NULL`, bail to `'orphaned'` with `last_error='ready_without_asset_id'` or `'ready_without_playback_id'`. Prevents writing nulls into the JSONB and falsely marking the mapping `patched`.

### Confirmed prerequisites

- `public.mux_uploads.upload_id` already has a `UNIQUE` constraint → FK target is valid.
- `public.update_updated_at_column()` exists → reused for the trigger.
- `public.has_role(_user_id uuid, _role app_role)` exists → reused by `mux-reconcile-upload`.
- `public.reviews.media` exists as `jsonb` (verified), but is intentionally not used in 3A.

### Final RPC return values (unchanged)

`patched | noop_not_ready | noop_already_patched | noop_orphaned | noop_errored | orphaned`

### Edge functions (unchanged from approved plan)

- `mux-register-mappings` — JWT-required (default verify_jwt=true, also validates in code). Body accepts `content_type: 'post'` only. Ownership + conflict + slot-taken + catch-up paths as previously approved. Per-item structured response, never 500 on conflict.
- `mux-reconcile-upload` — JWT-required, two-tier: service_role JWT bypasses, otherwise `has_role(uid, 'admin')` required; everyone else → 403. Calls the RPC, surfaces structured result, logs `{ mapping_id, mux_upload_id, result }`.

### `supabase/config.toml`

Add nothing. Both new functions default to `verify_jwt=true`. Existing `mux-create-upload` / `mux-webhook` entries left as-is (their security models are intentional; hardening `mux-create-upload` is a deferred cleanup).

### Verification (unchanged, curl/SQL only, throwaway test data)

Original 10 scenarios stand. Two extras worth running now that we added defensive checks:

11. **Ownership-mismatch (RPC level):** manually insert a `mux_upload_mappings` row whose `user_id` differs from the target `posts.user_id`. Call `mux-reconcile-upload` → `'orphaned'`, `last_error='ownership_mismatch'`, post JSONB untouched.
12. **Ready-without-asset_id:** stage a `mux_uploads` row with `status='ready'`, `asset_id=NULL`. Reconcile → `'orphaned'`, `last_error='ready_without_asset_id'`.

### Rollback (unchanged)

Drop both edge functions; drop `patch_content_media_from_mux`; drop the table (cascade removes mappings, leaves `mux_uploads` and `posts` untouched).

### Out of scope for 3A (unchanged)

Composer wiring, webhook RPC trigger, errored UI baseline, reviews wiring, HLS playback, Phase 5 retry/telemetry, hardening `mux-create-upload`.

---

### Technical: final SQL shape

```sql
-- Table: mux_upload_mappings
-- (same as previous draft, except CHECK narrowed)
CREATE TABLE public.mux_upload_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mux_upload_id text NOT NULL UNIQUE
    REFERENCES public.mux_uploads(upload_id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post')),  -- narrowed
  content_id uuid NOT NULL,
  media_index integer NOT NULL CHECK (media_index >= 0),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','patched','orphaned','errored')),
  mux_status_snapshot text,
  patched_at timestamptz,
  last_error text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mux_upload_mappings_slot_unique UNIQUE (content_type, content_id, media_index)
);
CREATE INDEX idx_mux_upload_mappings_content ON public.mux_upload_mappings (content_type, content_id);
CREATE INDEX idx_mux_upload_mappings_user    ON public.mux_upload_mappings (user_id);
CREATE INDEX idx_mux_upload_mappings_pending ON public.mux_upload_mappings (status) WHERE status='pending';
CREATE TRIGGER trg_mux_upload_mappings_updated_at
  BEFORE UPDATE ON public.mux_upload_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.mux_upload_mappings ENABLE ROW LEVEL SECURITY;
-- no policies → service_role only

-- RPC: patch_content_media_from_mux (post-only branch + hardening)
-- Steps inside the function:
--   1. SELECT mapping FOR UPDATE
--   2. terminal-state noops: noop_already_patched / noop_orphaned / noop_errored
--   3. SELECT mux_uploads by upload_id; if missing or status NOT IN ('ready','errored') → 'noop_not_ready'
--   4. ownership check: mux_uploads.user_id = mapping.user_id, else orphan + 'ownership_mismatch'
--   5. SELECT posts FOR UPDATE; posts.user_id = mapping.user_id, else orphan + 'ownership_mismatch'
--   6. media[media_index] must exist, type='video', provider='mux', mux_upload_id matches → else orphan + 'slot_mismatch'
--   7. if ready: require asset_id + playback_id non-null, else orphan + 'ready_without_asset_id' / 'ready_without_playback_id'
--      merge: mux_asset_id, mux_playback_id, mux_status='ready', and duration/aspect_ratio when not null
--   8. if errored: merge mux_status='errored', mux_error=COALESCE(v_upload.error,'unknown'),
--      plus mux_asset_id when not null
--   9. UPDATE posts SET media = jsonb_set(...); UPDATE mapping SET status='patched', patched_at=now(), mux_status_snapshot=...
--  10. RETURN 'patched'
REVOKE ALL ON FUNCTION public.patch_content_media_from_mux(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_content_media_from_mux(uuid) TO service_role;
```

Approve and I'll run the migration with these revisions, then create the two edge functions and run the curl/SQL verification.
