# Phase 3.3A — Final plan (v4, ready to build)

Both reviewers approve v3. v4 folds in their three asks and bakes in two schema facts I just verified.

## What changes from v3

1. **Save order locked: upload-first, insert-second (ChatGPT).** On host-form Save the pending-upload flow is strictly:
   1. Resolve every `pendingUpload` marker into a real CDN URL via `uploadEntityImage(file, userId)`.
   2. If the primary image is a pending upload, replace `formData.image_url` with the real URL **before** the `entities` insert.
   3. Insert the entity with the final real `image_url` (never `blob:`, never a marker).
   4. Insert media rows with the resolved real URLs, primary first.
   5. Revoke all tracked blob URLs.

   Guard: an `assert` step right before insert verifies `image_url` does not start with `blob:` and no `MediaItem.url` starts with `blob:` — throws a clear error if violated (defense-in-depth).

2. **Idempotent duplicate persistence (ChatGPT).** The post-insert write into `duplicate_entities` uses `INSERT … ON CONFLICT (entity_a_id, entity_b_id, detection_method) DO NOTHING` so retries never surface a unique-violation toast.

3. **Telemetry stamp is conditional (ChatGPT).** `metadata.creation_source` is only set to `'url'` when the entity was created from the URL/draft-review flow (i.e. `analyzedUrl` exists or `lastAppliedUrl` is set). Plain manual creation stamps `'manual'`. Same for `creation_flow` (`'phase_3_draft_review'` vs `'manual_form'`).

4. **Duplicate-pair preflight is a no-op (Codex, verified).** Live query of `duplicate_entities` shows 110 rows and **zero** existing pair/method groups, so `CREATE UNIQUE INDEX` will apply cleanly. The migration still uses `IF NOT EXISTS` for safety.

5. **Acceptance checks switched to before/after snapshots (Codex).** `duplicate_entities.created_at` does exist (verified), but snapshot deltas are more robust and version-proof — using them.

## Implementation order

```text
3.3A-1   Gallery completion (admin-only)
3.3A-2   Duplicate check (read-only before insert; persist after insert)
── STOP — share validation results with user before any 3.3B work ──
```

---

## Phase 3.3A-1 — Gallery completion

`src/components/admin/entity-create/ImageCandidateGrid.tsx`
- Re-enable per-tile checkbox; selection model `{ primaryUrl, galleryUrls[] }`.
- `MAX_MEDIA_ITEMS = 4` total (primary + gallery). Extra checkboxes disabled with helper text.
- Primary cannot also be in gallery (auto-removed on promote).
- Dedupe comparison key: exact URL with optional strip of `utm_*`, `fbclid`, `gclid`, `mc_*` **for comparison only**. **Stored URL is always byte-identical** to the source.
- Source + confidence chips per tile: `Official site` / `Google Images` / `Firecrawl` / `Page metadata` / `User upload`; confidence dot green ≥0.7, amber ≥0.4, grey otherwise.
- **"Upload your own" tile (Option A):** opens picker → store `File` + `previewUrl = URL.createObjectURL(file)` in component state → append as `{ source: 'user_upload', confidence: 1, pendingUpload: { file, previewUrl } }`. No network call.
- **"No image" toggle:** clears primary + gallery; sets `noImageChosen=true`.
- **Blob lifecycle:** track a `Set<string>` of created blob URLs; `URL.revokeObjectURL` on tile remove, "No image" toggle, modal close, component unmount, and after Save resolves.

`DraftReviewBody.tsx`
- Stage 2 passes `{ imageOverride, galleryOverride: Array<string | PendingUpload>, noImageChosen }` to `onPrefillForm`.

`CreateEntityDialog.tsx` — `handlePrefillFromDraft`
- `imageOverride` → `formData.image_url` (string) or pass-through pending-upload marker.
- `galleryOverride` → appended to host form's Entity Media area as `MediaItem`s (`source: 'draft_candidate'`), primary at index 0, deduped on exact URL.
- `noImageChosen=true` → skip image fills entirely.
- **Zero DB writes, zero storage writes.**

`CreateEntityDialog.tsx` — host-form Save (strict order, per ChatGPT clarification)
1. **Resolve pending uploads** to real CDN URLs (parallel `Promise.allSettled`).
2. **Patch `formData.image_url`** if the primary was a pending upload; patch matching `MediaItem.url`s.
3. **Assert** no remaining `blob:` URLs in `image_url` or media list — throw on violation.
4. **Insert entity** with final real `image_url`.
5. **Insert media rows** primary-first, deduped on exact URL.
6. If any media row insert fails: entity persists, warning toast lists failed URLs, `console.error` for retry (partial-failure handling, not rollback).
7. **Revoke** every tracked blob URL.

## Phase 3.3A-2 — Duplicate check

**New edge function** `supabase/functions/check-entity-duplicates/index.ts`
- Input: `{ name, type, parentId?, websiteUrl?, sourceUrl?, slug?, apiSource?, apiRef? }` — **no `brandId`**.
- Signals → `reasons[]` chips:
  - `pg_trgm` similarity on `lower(name)` scoped by `type`, threshold 0.55.
  - Exact `lower(slug)` match on `entities.slug`.
  - Match in `entity_slug_history.old_slug`.
  - Same `parent_id` boost.
  - `website_url` host match.
  - `metadata->>'created_from_url'` host + path-prefix match against `sourceUrl`.
  - `(api_source, api_ref)` exact match when both present.
- Output: `DuplicateCandidate[]` `{ id, name, slug, image_url, type, parent_name?, score, reasons[] }`.
- **No DB writes** in this function.
- Admin-only (returns 403 otherwise).
- Best-effort in-memory per-user rate limit: 30 req/min (acknowledged non-durable in serverless; sufficient for admin-only 3.3A).

**Migration (3.3A-2, schema only — no new tables, no GRANTs needed)**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS entities_name_trgm
  ON public.entities USING gin (lower(name) gin_trgm_ops)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS entities_lower_name_type
  ON public.entities (lower(name), type)
  WHERE is_deleted = false;

-- Preflight verified: 110 rows in duplicate_entities, zero existing pair/method groups,
-- so this applies cleanly. IF NOT EXISTS for safety on re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS duplicate_entities_pair_method_uniq
  ON public.duplicate_entities (entity_a_id, entity_b_id, detection_method);
```

**`CreateEntityDialog.handleSubmit`**
- Before insert: call `check-entity-duplicates`. If matches → inline "Did you mean?" step:
  - **Use existing** → fire `onSelectExistingEntity({ id, slug, name, type })`. Admin impl = navigate. **Zero writes.**
  - **It's different, continue** → continue with the upload-first save order above. After successful entity insert, persist one row per shown match with `ON CONFLICT (entity_a_id, entity_b_id, detection_method) DO NOTHING`:
    ```
    entity_a_id      = existing match id
    entity_b_id      = newly created entity id
    similarity_score = match score
    detection_method = 'auto_phase33a'
    status           = 'pending'
    ```
  - **Cancel** → close step. **Zero writes.**
- Stamp `metadata` on insert payload (conditional, per ChatGPT):
  - URL/draft flow: `{ creation_source: 'url', creation_flow: 'phase_3_draft_review', created_from_url: analyzedUrl, duplicate_candidates_seen: n, duplicate_decision: 'continue_new' | 'no_candidates' }`
  - Manual flow: `{ creation_source: 'manual', creation_flow: 'manual_form' }` (no duplicate fields).

---

## Files

**Add**
- `supabase/functions/check-entity-duplicates/index.ts`
- Migration: `pg_trgm` + 2 query indexes + 1 unique index

**Edit**
- `src/components/admin/entity-create/ImageCandidateGrid.tsx`
- `src/components/admin/entity-create/DraftReviewBody.tsx`
- `src/components/admin/AutoFillPreviewModal.tsx` (prop pass-through only)
- `src/components/admin/CreateEntityDialog.tsx` (gallery prefill, upload-first save order, blob-URL assertion, dedupe step, conditional telemetry, `onSelectExistingEntity`)

**Not touched in this pass**
`entities.approval_status`, RLS, moderation queue, quota function, `PendingReviewBadge`, `App.tsx` routes.

---

## Acceptance checks (snapshot-based, per Codex)

Before starting any flow: capture `dupCountBefore = SELECT count(*) FROM duplicate_entities`.

**3.3A-1**
1. Primary + 2 gallery + 1 local upload → Apply to Form → host form shows 4 media items (primary index 0), `image_url` set, **zero network requests to storage or DB** (verify in network tab).
2. 5th selection disabled with helper text.
3. "No image" → primary/gallery cleared, host form skips image fields.
4. Save with one forced media-row failure → entity persists, warning toast lists the failed URL, the other 3 media rows persist.
5. **No `blob:` URL anywhere in DB**: `SELECT image_url FROM entities WHERE id=<new>` and `SELECT url FROM entity_photos WHERE entity_id=<new>` — none start with `blob:`.
6. Signed/transform query params on stored URLs are byte-identical to the source.
7. After modal close mid-flow with pending uploads → no leaked `blob:` URLs in DevTools memory snapshot.

**3.3A-2**
8. "Sony XM5" with existing "Sony WH-1000XM5" → "Did you mean?" shows that match. **Use existing** → `onSelectExistingEntity` fires (admin navigates); `dupCountAfter == dupCountBefore`.
9. **Cancel** → `dupCountAfter == dupCountBefore`.
10. **Continue creating new** → entity inserted, `dupCountAfter == dupCountBefore + N` (N = matches shown). All new rows have `entity_b_id` = new id and `detection_method='auto_phase33a'`.
11. Re-running the same continue-new flow with the same entity id → no error (ON CONFLICT DO NOTHING), `dupCountAfter` unchanged from previous step.
12. Telemetry: URL-flow entity has 5 `metadata` keys (`creation_source='url'`, `creation_flow`, `created_from_url`, `duplicate_candidates_seen`, `duplicate_decision`). Manual-flow entity has only `creation_source='manual'` + `creation_flow='manual_form'`.

---

## Phase 3.3B — designed, NOT built in this pass

Captured for continuity; only built after 3.3A acceptance passes and the user explicitly approves.

- **Preflight (must run first):** `SELECT DISTINCT approval_status FROM public.entities;` → normalize anything outside `(pending, approved, rejected, NULL)` → then add CHECK.
- **3.3B-1:** Reuse `entities.approval_status`. Add CHECK + `approved_at` / `approved_by` / `rejection_reason`. BEFORE INSERT trigger: admin → `'approved'`, else `'pending'`. RLS SELECT: `approval_status='approved' OR created_by=auth.uid() OR has_role(auth.uid(),'admin')`. Status UPDATE admin-only.
- **3.3B-2:** Moderation queue page, pending badge, quota function + BEFORE INSERT trigger (10/24h non-admin), client precheck for friendly UX. Server trigger is source of truth.

## Out of scope (3.4+)
Non-admin rollout, Search / Lens / Barcode entry points, full merge-duplicates admin tool, reputation-based auto-approve, bulk approve, public pending visibility with badge.
