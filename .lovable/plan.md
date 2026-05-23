## Phase 3C.1 — Mux mapping sync after post edit (final, ready to implement)

Backend correctness only. Phase 3C.2 (failed-video Replace CTA) deferred until 3C.1 is verified in preview.

Two changes vs the previous approved plan, both from the latest review:
- **(NEW) `patch_content_media_from_mux` gains a `removed` terminal-no-op guard.**
- **(NEW) Edge function rejects duplicate `mux_upload_id` values in `items` with HTTP 400 before calling the RPC.**

Everything else is identical to the previously approved plan.

---

### Hard guardrail (acceptance criterion)

All new logic is gated on `item.provider === 'mux' && item.mux_upload_id`.

- Supabase image edit path: untouched.
- Legacy Supabase video edit path: untouched.
- **Hard test gate:** "If all media items are non-Mux before AND after edit, `mux-sync-post-mappings` is never called." Enforced by an early `return` in the edit branch and an automated test that mocks `supabase.functions.invoke` and verifies zero calls for (a) image-only and (b) legacy-Supabase-video-only edits.

---

### Step 1 — Migration

```sql
-- 1A. Extend status enum to include 'removed'
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_status_check;
ALTER TABLE public.mux_upload_mappings
  ADD CONSTRAINT mux_upload_mappings_status_check
  CHECK (status IN ('pending','patched','orphaned','errored','removed'));

-- 1B. Active-only slot uniqueness so removed/orphaned rows don't reserve a slot
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_slot_unique;

CREATE UNIQUE INDEX IF NOT EXISTS mux_upload_mappings_active_slot_unique
  ON public.mux_upload_mappings (content_type, content_id, media_index)
  WHERE status IN ('pending','patched','errored');
```

Semantics:
- `removed` = user intentionally removed/replaced this Mux item during edit. Webhook ignores (existing filter is `status='pending'`). Now the patch RPC also treats it as a no-op (Step 2A).
- `orphaned` = system-detected invalid state. Never overwritten by `removed`. Never reactivated by edit sync.
- `mux_upload_id` remains globally `UNIQUE`.

---

### Step 2A — Patch the existing `patch_content_media_from_mux` (NEW)

Add a `removed` terminal no-op alongside the existing `patched`, `orphaned`, `errored` checks at the top of the function. Same `CREATE OR REPLACE` body as today, only the early-return block changes:

```sql
-- after the existing FOR UPDATE SELECT of v_mapping:
IF v_mapping.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
IF v_mapping.status = 'orphaned' THEN RETURN 'noop_orphaned';        END IF;
IF v_mapping.status = 'errored'  THEN RETURN 'noop_errored';         END IF;
IF v_mapping.status = 'removed'  THEN RETURN 'noop_removed';         END IF;  -- NEW
```

Rationale: defense-in-depth against any future manual reconcile path, and against a race where the sync RPC marks a row `removed` while a concurrent catch-up call holds a `mapping_id` from a prior read.

The new sync RPC (Step 2B) also treats `noop_removed` as a clean per-item result.

---

### Step 2B — New `sync_mux_post_mappings` RPC (atomic core)

All mapping mutations happen here in a single transaction.

```sql
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(
  p_content_id uuid,
  p_items      jsonb  -- [{ mux_upload_id: text, media_index: int }, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_park_offset constant int := 1000000;
  v_results     jsonb := '[]'::jsonb;
  -- ...
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  -- Per-post serialization
  PERFORM pg_advisory_xact_lock(hashtextextended(p_content_id::text, 0));

  -- TEMP table _sync_items(mux_upload_id text PRIMARY KEY, media_index int).
  -- Edge function pre-validates duplicates; PK here is belt-and-suspenders.

  -- SELECT FOR UPDATE all existing mappings for this post.

  -- (a) GONE + active -> status='removed' (frees the active-slot unique index)
  -- (b) MOVED active rows: park to media_index = 1000000 + row_number()
  -- (c) Place parked rows at target media_index (status preserved)
  -- (d) REACTIVATE: status='removed' rows whose mux_upload_id reappears ->
  --     UPDATE status='pending', media_index = target, errors cleared.
  --     orphaned rows are NEVER reactivated.
  -- (e) NEW: INSERT for mux_upload_ids with no existing row on this content.
  --     If the mux_upload_id is mapped to a different content_id, the global
  --     UNIQUE on mux_upload_id raises -> emit per-item 'conflict'.
  -- (f) Catch-up: for each desired item whose mapping is now 'pending' and
  --     mux_uploads.status IN ('ready','errored'), call
  --     patch_content_media_from_mux(mapping_id). Wrap each in
  --     EXCEPTION WHEN OTHERS -> emit per-item 'errored_patch'; do not abort.
  --     Per-item result codes include 'patched', 'noop_already_patched',
  --     'noop_not_ready', 'noop_orphaned', 'noop_errored', 'noop_removed',
  --     'orphaned', 'noop_synced'.

  RETURN jsonb_build_object('results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) TO service_role;
```

Guarantees: atomicity (single txn), reactivation of `removed`, never reactivates `orphaned`, collision-proof parking via advisory lock + deterministic `row_number()`, and per-item failures don't poison the whole call.

---

### Step 3 — Edge function: `mux-sync-post-mappings`

Auth/CORS posture identical to `mux-register-mappings`. Body:

```ts
{
  content_type: 'post',
  content_id: string,
  items: Array<{ mux_upload_id: string, media_index: number }>  // 0..50
}
```

Server logic:
1. JWT validation → `userId`.
2. Body validation matching `mux-register-mappings` (UUID, length caps).
3. **NEW — duplicate-`mux_upload_id` rejection.** After per-item validation, compute `new Set(items.map(i => i.mux_upload_id)).size !== items.length` → return `400 { error: 'duplicate_mux_upload_id' }`.
4. Verify caller owns `posts.id = content_id`.
5. Load `posts.media`. For each request item assert `media[media_index].mux_upload_id === item.mux_upload_id`. Mismatch → `400 media_index_mismatch`.
6. Call `admin.rpc('sync_mux_post_mappings', { p_content_id, p_items })`.
7. Return `{ results }` from the RPC.

Per-item codes the edge function and frontend tolerate as non-errors: `registered | already_registered | media_index_updated | removed | reactivated | patched | noop_synced | noop_unchanged | noop_not_ready | noop_already_patched | noop_orphaned | noop_errored | noop_removed | orphaned | conflict | errored_patch`.

The edge function performs zero mapping mutations directly — every write is inside the RPC transaction.

---

### Step 4 — Type / code audit

After Supabase types regen:
- Widen TS unions like `'pending' | 'patched' | 'orphaned' | 'errored'` → add `'removed'`.
- Grep edge functions for status switches → add no-op `'removed'` arm.
- Webhook filter (`status='pending'`) unchanged.

---

### Step 5 — Frontend wiring (`EnhancedCreatePostForm.tsx`, edit branch only)

Replaces the `TODO(phase 3C)` after a successful `posts.update`:

```ts
const muxItemsAfter = mediaToSave
  .map((m, idx) => ({ m, idx }))
  .filter(({ m }) => m.provider === 'mux' && typeof m.mux_upload_id === 'string' && m.mux_upload_id.length > 0)
  .map(({ m, idx }) => ({ mux_upload_id: m.mux_upload_id!, media_index: idx }));

const hadMuxBefore = (postToEdit.media ?? []).some(
  (m: any) => m?.provider === 'mux' && typeof m?.mux_upload_id === 'string' && m.mux_upload_id.length > 0
);

if (muxItemsAfter.length === 0 && !hadMuxBefore) return; // HARD GUARDRAIL

await invokeMuxSync({ content_type: 'post', content_id: postToEdit.id, items: muxItemsAfter });
// Soft-toast on failure (same non-blocking posture as create-branch register call).
```

Create branch keeps using `mux-register-mappings`. Image and legacy-Supabase-video edit paths untouched.

---

### Step 6 — Verification

Manual preview tests:
1. Pure-image edit (no Mux ever) → sync not invoked. **Hard gate.**
2. Pure-image edit on a post that previously had Mux → sync called, all `noop_synced`/`noop_already_patched`.
3. Legacy Supabase-only video edit → no Mux network call.
4. Edit-add a Mux video → new mapping `pending` → webhook or catch-up patches.
5. Edit-remove a still-preparing Mux video → row → `removed`; later webhook hits no-op.
6. Edit-replace at same index → old row `removed`, new row `pending` → patched.
7. Reorder two Mux items (one pending, one patched) → both `media_index` updated; no constraint violation.
8. Edit window expired → `posts.update` fails at trigger; sync never runs.
9. Pre-existing `orphaned` row → unaffected; never converted to `removed`; never reactivated.
10. Reactivation → remove a Mux item, re-add same `mux_upload_id` later in the window → existing row UPDATEd to `pending` at the new index. No INSERT attempt.
11. **NEW — `noop_removed` guard:** manually call `patch_content_media_from_mux` (via `supabase--read_query`'s read-only sister or a service-role test edge function) on a `removed` mapping → returns `noop_removed`; `posts.media` unchanged; mapping status unchanged.
12. **NEW — duplicate items rejection:** call `mux-sync-post-mappings` with two items sharing the same `mux_upload_id` → HTTP 400 `{ error: 'duplicate_mux_upload_id' }`; no RPC call.

Automated:
- Mock `supabase.functions.invoke`; simulate image-only and legacy-video-only edits; assert `invoke('mux-sync-post-mappings', ...)` is not called.

---

### Out of scope

3C.2 Replace CTA. Reviews. Backfill, orphan cleanup cron, Mux Player swap, captions, signed URLs, Mux Data, automatic Mux asset deletion. Phase 5 owner hints. Webhook logic.

---

### Rollback

- Revert the edit-branch sync call → back to TODO no-op.
- Migration + RPC + edge function are additive and harmless when unused.

---

### Technical details

- `FOR UPDATE` on the post's mapping rows at the top of the RPC + `pg_advisory_xact_lock(content_id_hash)` together make the park-then-place sequence safe across concurrent calls and serialize same-post edits.
- The `1_000_000+row_number()` parking offset is far above the composer cap (≤ 50) so it never collides with real indices, and it sits outside the partial unique active-slot index window only insofar as the parked rows themselves are still active — the `row_number()` makes each parked index distinct within the txn, satisfying the partial unique index.
- Per-item catch-up is wrapped in `BEGIN ... EXCEPTION WHEN OTHERS` so one bad mapping doesn't abort the sync; the offending item gets `'errored_patch'`.
- Frontend duplicate guard is cheap (`Set.size` comparison) and fires before the RPC, so the temp-table `PRIMARY KEY` defense never triggers in practice.
