
# Phase 3.1 — Stop auto brand creation + introduce shared EntityDraft contract (backward-compatible)

Both reviewers approve. Two small refinements folded in: Zod validation must succeed in the Deno runtime before merge (not silently skipped), and the failure flag distinguishes three modes (build / validation / schema-import-skipped). Otherwise unchanged from the previously reviewed version.

The strict rule for this phase:

> Analyze is **read-only**. Zero DB writes, zero storage writes, zero enrichment writes for brands/entities/media during Analyze — for **every** helper it calls. The new `EntityDraft` contract ships *alongside* the current response, not as a replacement.

---

## Scope — five deliverables

### 1. Stop auto brand creation (frontend)
In `src/components/admin/CreateEntityDialog.tsx`:
- Remove the `autoCreateParentBrand()` **call site** only. Leave the function defined for now — smaller diff, easier to revert. Delete the function body in Phase 3.2.
- `autoSelectParentBrand()` **stays** but is reframed as read-only: pre-selects an *existing* brand entity only when an exact/single match is found in the DB. Add a header comment making this explicit. Add a guard so a zero-match path can never call any create function.
- No other behavior changes. Apply/confirm flow from Phase 2 v8 is untouched.

### 2. Harden `create-brand-entity` (backend safety boundary)
In `supabase/functions/create-brand-entity/index.ts`:

- **`confirmCreate` is optional** (`confirmCreate?: boolean`). Existing lookup-only callers must keep working.
- Behavior matrix:
  - **Existing brand found in DB** → return `{ status: 'existing_found', brandEntity }`. No `confirmCreate` needed.
  - **No existing brand + `confirmCreate !== true`** → return `{ status: 'confirm_required' }` with HTTP 200 (control-flow signal, not an error). No write.
  - **No existing brand + `confirmCreate === true`** → create, return `{ status: 'created', brandEntity }`.
  - **Soft-deleted brand + `confirmCreate !== true`** → return `{ status: 'confirm_required' }`.
  - **Soft-deleted brand + `confirmCreate === true`** → restore, return `{ status: 'restored', brandEntity }`.
- **Response always includes an explicit `status` field**: `'existing_found' | 'confirm_required' | 'created' | 'restored'`. Keep the existing `success` / `alreadyExisted` fields too so the current admin caller doesn't break.
- **No DB schema changes**. Use the existing `created_by` column and `metadata` JSONB for audit info — no new columns.

### 3. Shared `EntityDraft` contract (versioned, dual-runtime)
Split into two files to satisfy Vite + Deno cleanly:

- **`shared/contracts/entityDraft.types.ts`** — pure TypeScript types/constants (`ENTITY_DRAFT_SCHEMA_VERSION`, `CandidateSource`, `BrandStatus`, `BrandCandidate`, `ImageCandidate`, `SourceEvidence`, `EntityDraft`). Zero runtime imports. Safe everywhere.
- **`shared/contracts/entityDraft.schema.ts`** — Zod schema mirroring the types. Match the existing edge function Zod import pattern exactly (the project already uses Zod in edge functions; reuse that specifier).

**Zod validation must succeed in the Deno edge runtime before merge.** If the import pattern fails, fix the import before merging — do not ship with validation silently skipped. The contract's whole point is that Phase 3.2 can trust the shape.

Contract shape (in `entityDraft.types.ts`):

```ts
export const ENTITY_DRAFT_SCHEMA_VERSION = 1;

export type CandidateSource =
  | 'official_site' | 'google_images' | 'google_cse'
  | 'places_photo' | 'book_cover' | 'movie_poster'
  | 'open_food_facts' | 'firecrawl' | 'page_metadata'
  | 'ai_inference' | 'existing_entity' | 'user_upload';

export type BrandStatus =
  | 'matched_existing' | 'suggested_new' | 'unknown' | 'not_applicable';

export interface BrandCandidate {
  id?: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  source: CandidateSource;
  confidence: number;
  reason?: string;
  status: BrandStatus;
}

export interface ImageCandidate {
  url: string;                // ORIGINAL, unmodified URL (display + fetch)
  source: CandidateSource;
  confidence: number;
  width?: number;
  height?: number;
  isLogo?: boolean;
  isProductShot?: boolean;
  reason?: string;
}

export interface SourceEvidence {
  field: string;
  value: string;              // SHORT + SANITIZED — see rules below
  source: CandidateSource;
  confidence: number;
}

export interface EntityDraft {
  schemaVersion: typeof ENTITY_DRAFT_SCHEMA_VERSION;
  inputMethod: 'url' | 'search' | 'image' | 'barcode' | 'manual';
  inputRef: string;
  nameGuess?: string;
  typeGuess?: string;
  descriptionGuess?: string;
  categoryHint?: { id?: string; path?: string };
  structuredHints?: Record<string, unknown>;
  brandCandidates: BrandCandidate[];
  imageCandidates: ImageCandidate[];
  recommendedBrandIndex?: number;
  recommendedImageIndex?: number;
  sourceEvidence: SourceEvidence[];
  warnings?: string[];
}
```

### 4. Wire `analyze-entity-url-v2` to emit `EntityDraft` alongside existing response
In `supabase/functions/analyze-entity-url-v2/index.ts`:
- Keep the current response (`predictions`, `metadata`, `success`, etc.) **exactly as-is**. UI continues to read `predictions`. Draft is dark-shipped.
- Add a new top-level field `entityDraft: EntityDraft | null`.

**Strict read-only audit of every helper reachable from Analyze**:
- `fetch-url-metadata-lite`, `enrich-brand-data`, any image/Firecrawl helper, any brand-lookup helper, any metadata helper.
- For each: verify zero DB writes, zero storage writes, zero enrichment inserts, zero brand/entity/media row touches.
- If a helper has side effects: either skip it entirely during Analyze in 3.1, or introduce a read-only variant and call only that. No "fix later."
- Document the audit results as a short comment block at the top of `analyze-entity-url-v2/index.ts`.

**Building `entityDraft`**:
- `brandCandidates`: from existing AI output + DB ilike lookup for existing brands. Up to 5. Read-only only.
- `imageCandidates`: all images already collected (page metadata, Firecrawl, AI output), deduped and capped at top 12 by confidence desc.
- **Image dedupe**: build a separate internal **normalized dedupe key** (lowercase host, drop fragment, drop known sizing/tracking params). **Never mutate `ImageCandidate.url`** — it stays the original, valid URL with signatures/CDN tokens intact.
- Drop empty strings, `data:` URLs, malformed URLs (no host).
- **Recompute `recommendedImageIndex` after dedupe + cap** so it points at a surviving candidate. If the original recommendation was dropped, fall back to index 0; if list is empty, leave undefined.
- `recommendedBrandIndex`: index of what current code would have auto-picked, so 3.2 preserves default behavior.
- `sourceEvidence`: at minimum one entry per top-level field (`name`, `description`, `brand`, `image`).

**`sourceEvidence.value` sanitization** via a single shared `sanitizeEvidenceValue()` helper:
- Hard cap **200 chars**, truncated with `…` suffix.
- Strip control characters; collapse whitespace.
- For URL-valued evidence: strip query string entirely (no signatures, no tracking params).
- Never include raw HTML, raw model output, full scraped page text, or auth/session tokens.

**Failure handling** — wrap draft assembly + Zod validation in try/catch. On failure:
- Existing `predictions` response returns normally.
- `entityDraft: null` in the response body.
- Visible debug signal on `metadata` that **distinguishes the three failure modes**:
  - `metadata.entityDraftStatus: 'ok' | 'build_failed' | 'validation_failed' | 'schema_unavailable'`
  - `'build_failed'` = assembly threw before validation
  - `'validation_failed'` = assembled, Zod rejected it
  - `'schema_unavailable'` = Zod import didn't load at runtime (should be impossible by merge-time, but flagged loudly if it ever happens)
- `console.error` with `request_id` + error stack on any non-`ok` state — never silent.

**Legacy `analyze-entity-url`**: only patch it if the current app or any feature flag still routes to V1. `rg "analyze-entity-url[^-]"` first. If V1 is dead, skip it.

### 5. Validation — prove the safety goal

1. **Zero new brand rows during Analyze**: snapshot `count(*) FROM entities WHERE type='brand'` before/after analyzing 3 URLs (brand-in-DB, brand-not-in-DB, AI-failure). Counts must match. Numbers in PR description.
2. **Zero `create-brand-entity` invocations during Analyze** — verified in edge function logs across all 3 runs.
3. **Zero storage writes during Analyze** — spot-check storage object counts in relevant buckets before/after.
4. **`create-brand-entity` status matrix** — all 5 cases above return the documented status and write (or don't write) accordingly.
5. **Backward compatibility** — Phase 2 v8 verification steps 1–8 still pass against the existing AutoFillPreviewModal.
6. **`entityDraft` validates in Deno** — Zod-parse runs successfully in the deployed edge function for a real analyze response. Synthetic forced-failure produces `entityDraft: null` + `metadata.entityDraftStatus: 'validation_failed'` + log line with `request_id`. **If `entityDraftStatus` is `'schema_unavailable'` in normal operation, the import pattern is broken and must be fixed before merge.**
7. **Image candidates are clean** — heavy URL (e.g. Amazon PDP): ≤ 12 candidates, deduped, **`ImageCandidate.url` byte-identical to source** (no stripped params), `recommendedImageIndex` points at a valid surviving candidate.
8. **Existing-brand pre-selection still works** — `recommendedBrandIndex` points at a candidate with `status: 'matched_existing'` and the correct `id`.
9. **`sourceEvidence` sanitization** — synthetic oversized AI response: every `value` ≤ 200 chars, no HTML, no query strings on URL values.

---

## Out of scope for 3.1 (explicitly deferred)

- Multi-candidate `BrandPicker` / `ImageCandidateGrid` UI → **Phase 3.2**
- "Not sure" / "Brand not listed" UX → **Phase 3.2**
- Deleting `autoCreateParentBrand` function body → **Phase 3.2**
- Dedupe edge function, quota, soft-publish, admin moderation queue → **Phase 3.3**
- Opening to non-admin users, RLS changes, continuation prompt → **Phase 3.4**
- Search / Lens / Barcode adapters → **Phases 3.5–3.7**

---

## Files touched

- `src/components/admin/CreateEntityDialog.tsx` — remove one call site, add comment + guard on `autoSelectParentBrand`.
- `supabase/functions/create-brand-entity/index.ts` — optional `confirmCreate`, explicit `status` in responses, no new columns.
- `supabase/functions/analyze-entity-url-v2/index.ts` — add `entityDraft` to response; read-only-helper audit comment; `sanitizeEvidenceValue()` helper; tri-state `entityDraftStatus`.
- `supabase/functions/analyze-entity-url/index.ts` — only if V1 is still routed.
- `shared/contracts/entityDraft.types.ts` — **new**, pure types/constants.
- `shared/contracts/entityDraft.schema.ts` — **new**, Zod wrappers.
- `.lovable/plan.md` — replace Phase 2 v8 content with this Phase 3.1 plan.

No DB migrations. No new secrets. No new external API calls. No UI changes.

---

## Risk assessment

- **Low risk**: no rendered behavior changes; draft is dark-shipped; failure is wrapped with tri-state diagnostics.
- **`confirmCreate` change** is gated on opt-in; lookup-only callers keep working because the flag is optional. Before merging: `rg "create-brand-entity"` to enumerate callers and confirm none rely on the old implicit "create on missing." Any that do must pass `confirmCreate: true` from a user-confirmed code path.
- **Shared-contract import**: types/schema split keeps types safe in either runtime; Zod validation itself must work in Deno by merge-time — that's a hard requirement, not a fallback.

---

Ready to start 3.1 on approval. After validations #1, #2, #3 (zero new brand rows, zero `create-brand-entity` calls, zero storage writes) are confirmed on a real preview run, we move to Phase 3.2 (`BrandPicker` + `ImageCandidateGrid` + Review Modal refactor).
