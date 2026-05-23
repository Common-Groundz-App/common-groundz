## Phase 3C.1 — Mux mapping sync after post edit (final, ready to implement)

Backend correctness only. Phase 3C.2 (failed-video Replace CTA) deferred until 3C.1 is verified in preview.

---

### Hard guardrail (acceptance criterion)

All new logic is gated on `item.provider === 'mux' && item.mux_upload_id`.

- Supabase image edit path: untouched.
- Legacy Supabase video edit path: untouched.
- **Hard test gate:** "If all media items are non-Mux before AND after edit, function `mux-sync-post-mappings` is never called." Enforced by an early `return` in the edit branch and asserted by an automated test that mocks `supabase.functions.invoke` and verifies zero calls for (a) image-only and (b) legacy-Supabase-video-only edits.

---

### Step 1 — Migration (incorporates both DB fixes from prior round)

Confirmed starting state in `20260521105459_...sql`:
- `CHECK (media_index >= 0)` on column.
- Table-level `UNIQUE (content_type, content_id, media_index)` covering all statuses.
- Status enum: `pending | patched | orphaned | errored`.

Migration:

```sql
-- 1A. Extend status enum to include 'removed'
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_status_check;
ALTER TABLE public.mux_upload_mappings
  ADD CONSTRAINT mux_upload_mappings_status_check
  CHECK (status IN ('pending','patched','orphaned','errored','removed'));

-- 1B. Slot uniqueness must apply to ACTIVE mappings only,
-- so a removed row at index N does not block a new pending row at index N.
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_slot_unique;

CREATE UNIQUE INDEX mux_upload_mappings_active_slot_unique
  ON public.mux_upload_mappings (content_type, content_id, media_index)
  WHERE status IN ('pending','patched','errored');
-- 'removed' and 'orphaned' are historical / non-active and do not reserve a slot.
```

Semantics:
- `removed` = user intentionally removed/replaced this Mux item during edit. Webhook ignores (existing filter is `status='pending'`).
- `orphaned` = system-detected invalid state. Never overwritten by `removed`. Never reactivated by edit sync.
- `mux_upload_id` remains globally `UNIQUE` (existing). Reactivation rule below handles re-appearance.

No webhook code changes.

---

### Step 2 — New Postgres RPC: `sync_mux_post_mappings` (atomic core — ChatGPT #1)

All mapping mutations happen here in a single transaction. The edge function only does auth + validation.

```sql
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(
  p_content_id uuid,
  p_items      jsonb         -- [{mux_upload_id: text, media_index: int}, ...]
)
RETURNS jsonb                 -- per-item result codes for the edge function to relay
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_park_offset constant int := 1000000;
  v_results     jsonb := '[]'::jsonb;
  -- ... see Technical details below
BEGIN
  -- 2A. Advisory lock keyed on content_id to serialize concurrent edits to same post
  PERFORM pg_advisory_xact_lock(hashtextextended(p_content_id::text, 0));

  -- 2B. Lock existing mapping rows for this post (FOR UPDATE) so the
  --     park-then-place dance is collision-proof.
  -- 2C. Build current-set Map<mux_upload_id, media_index> from p_items.
  -- 2D. Classify existing rows: gone | moved | unchanged | reactivate | new.
  --     'reactivate' = row.status='removed' AND mux_upload_id IS in current set.
  --     orphaned rows are NEVER classified as reactivate; always 'unchanged' (no-op).
  -- 2E. Phase order (each step appends to v_results):
  --   (a) gone + status IN ('pending','patched','errored')
  --        → UPDATE status='removed'  (frees slot from active partial unique index)
  --   (b) moved rows
  --        → UPDATE media_index = v_park_offset + row_number()
  --          OVER (ORDER BY id)         -- deterministic, collision-proof inside txn,
  --                                     -- + advisory lock guarantees no concurrent caller
  --   (c) moved rows → UPDATE media_index = target_index (preserve status)
  --   (d) reactivate rows
  --        → UPDATE status='pending', media_index = target_index,
  --                 last_error = NULL, retry_count = 0
  --   (e) new entries → INSERT (status default 'pending')
  -- 2F. Catch-up (still inside txn): for every row now in ('pending') whose
  --     mux_uploads.status IN ('ready','errored'), call patch_content_media_from_mux(id).
  --     Per-item failures are caught and recorded as 'errored_patch'; do not abort txn.

  RETURN jsonb_build_object('results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) TO service_role;
```

Key guarantees:
- **Atomicity (ChatGPT #1):** one transaction; mid-failure rolls back the entire mapping mutation.
- **Reactivation (ChatGPT #2):** because `mux_upload_id` is globally `UNIQUE`, a re-appearing `removed` row is UPDATEd back to `pending` at the new index. Never re-INSERTed. `orphaned` rows are excluded from reactivation.
- **Parking collision-proof (codex #2):** `pg_advisory_xact_lock(content_id)` blocks concurrent calls for the same post; `row_number() OVER (ORDER BY id)` is deterministic within the txn; the `1_000_000+` offset is far above the composer/register cap (≤ 50) and outside the active partial unique index for any realistic post.
- Edit-window enforcement is unchanged: the preceding `posts.update` in the edge composer flow goes through `enforce_post_edit_window` trigger; sync only runs after that succeeds. No `app.mux_system_patch` bypass.

---

### Step 3 — Edge function: `mux-sync-post-mappings` (thin wrapper)

Auth/CORS posture identical to `mux-register-mappings` (JWT-required, Zod-style validation, owner check). Body:

```ts
{
  content_type: 'post',
  content_id: string,
  items: Array<{ mux_upload_id: string, media_index: number }>  // 0..50 each, length 0..50
}
```

Server logic:
1. Validate JWT → `userId`.
2. Validate body (UUID, length caps matching `register`).
3. Verify caller owns the post (`posts.user_id === userId`).
4. Load saved `posts.media`. For each request item assert `media[media_index].mux_upload_id === item.mux_upload_id`. Mismatch → `400 media_index_mismatch`.
5. Call `admin.rpc('sync_mux_post_mappings', { p_content_id, p_items })`.
6. Return `{ results }` from the RPC unchanged.

Per-item codes: `registered | already_registered | media_index_updated | removed | reactivated | patched | noop_unchanged | noop_not_ready | errored_patch | errored_*`.

The edge function performs zero mapping mutations directly — every write is inside the RPC transaction.

---

### Step 4 — Type / code audit for the new status

After regenerated Supabase types:
- Grep TS unions like `'pending' | 'patched' | 'orphaned' | 'errored'` → widen to include `'removed'`.
- Grep edge functions for `switch (status)` / `status === ...` on mapping rows → add a no-op `'removed'` arm.
- Do not touch webhook filter (`status='pending'`).

---

### Step 5 — Frontend wiring (`EnhancedCreatePostForm.tsx`, edit branch only)

Replace the `TODO(phase 3C): reconcile mux mappings on media edits` block. After `posts.update` succeeds:

```ts
const muxItemsAfter = mediaToSave
  .map((m, idx) => ({ m, idx }))
  .filter(({ m }) => m.provider === 'mux' && typeof m.mux_upload_id === 'string' && m.mux_upload_id.length > 0)
  .map(({ m, idx }) => ({ mux_upload_id: m.mux_upload_id!, media_index: idx }));

const hadMuxBefore = (postToEdit.media ?? []).some(
  (m: any) => m?.provider === 'mux' && typeof m?.mux_upload_id === 'string' && m.mux_upload_id.length > 0
);

// HARD GUARDRAIL — never call sync for pure-Supabase posts (test-gated)
if (muxItemsAfter.length === 0 && !hadMuxBefore) {
  return;
}

await invokeMuxSync({
  content_type: 'post',
  content_id: postToEdit.id,
  items: muxItemsAfter,
});
// Soft-toast on failure (same non-blocking posture as the create-branch register call).
```

Create branch keeps using `mux-register-mappings` unchanged. Image and legacy-Supabase-video edit code paths are not touched.

---

### Step 6 — Verification (preview)

Manual:
1. **Pure-image edit (no Mux ever)** → sync not invoked (Network panel + edge logs). **Hard gate.**
2. **Pure-image edit on a post that previously had Mux items** → sync called, all `noop_unchanged`.
3. **Legacy Supabase-only video edit** → no Mux network call.
4. **Edit-add a Mux video** → new mapping `pending` → webhook patches (or catch-up if already ready).
5. **Edit-remove a still-preparing Mux video** → mapping → `removed`; later webhook for that asset hits no-op (filter is `status='pending'`).
6. **Edit-replace at same index** → old row `removed`, new row `pending` → patched. Validates partial-unique-active-slot index.
7. **Reorder two Mux items (one pending, one patched)** → both `media_index` updated via park-then-place; no `media_index >= 0` violation, no unique violation.
8. **Edit window expired** → `posts.update` fails at trigger; sync never runs.
9. **Pre-existing `orphaned` row on the post** → unaffected even if its `mux_upload_id` is missing from current media; never silently converted to `removed`; never reactivated even if it reappears.
10. **Reactivation path** → remove a Mux item (mapping → `removed`), re-add the same `mux_upload_id` in a later edit within the same window → existing row UPDATEd to `status='pending'` at the new index; no INSERT attempt; UNIQUE on `mux_upload_id` not violated.

Automated (Step 5 guardrail):
- Mock `supabase.functions.invoke`.
- Simulate edit submit for (a) image-only post and (b) legacy Supabase-video-only post.
- Assert `invoke('mux-sync-post-mappings', ...)` is not called.

RPC unit checks (via `supabase--test_edge_functions` against a thin test edge function, or psql sanity queries):
- Park collision: simulate 5 mapping rows on one post all needing to swap indices → no constraint violation.
- Reactivation: insert `removed` row, run sync with same `mux_upload_id` → row updated, no duplicate.
- Orphaned safety: insert `orphaned` row, run sync with same `mux_upload_id` → row untouched, `noop_unchanged`/no-op classification.

---

### Out of scope for 3C.1

Phase 3C.2 Replace CTA + `replaceMediaIndex` composer flow. Reviews. Backfill, orphan cleanup cron, Mux Player swap, captions, signed URLs, Mux Data, automatic Mux asset deletion. Phase 5 owner hints / processing chips. Webhook logic.

---

### Rollback

- Revert the edit-branch sync call in `EnhancedCreatePostForm.tsx` to the prior TODO no-op.
- Edge function + RPC + migration are additive and harmless when unused. Full revert: drop the RPC, drop the partial unique index, recreate the original `UNIQUE (content_type, content_id, media_index)` constraint (safe as long as no active-slot duplicates exist — which by construction they don't).

---

### Technical details (for implementer)

- All `UPDATE`s in the RPC use `FOR UPDATE` locking on the affected mapping rows (selected at the top of the function via `SELECT ... FROM mux_upload_mappings WHERE content_type='post' AND content_id=p_content_id FOR UPDATE`).
- `pg_advisory_xact_lock(hashtextextended(p_content_id::text, 0))` ensures no two concurrent RPC calls on the same post can interleave parking phases.
- The advisory lock is released automatically at txn end.
- The RPC stays under ~150 lines; classification can use a CTE or two temp arrays.
- Per-item `errored_patch` results are collected via a `BEGIN ... EXCEPTION WHEN OTHERS` block around each `patch_content_media_from_mux` call so one bad mapping doesn't abort the whole sync.
- Edge function deploys automatically. New RPC needs a migration; types regenerate after migration approval.
