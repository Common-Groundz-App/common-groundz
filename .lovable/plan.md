## Goals

Bring the draft-review pipeline's brand/logo/image enrichment quality up to the legacy auto-brand pipeline, while keeping its no-write-until-confirmed safety. Reuse existing edge functions in read-only mode. **No DB migrations, no RLS changes, no new edge functions, no new RPCs.**

---

## Verified constraints

1. `match_entities_by_name` RPC **does not** filter `approval_status` and **does not** return that column.
2. RPC hard-gates on `has_role(auth.uid(), 'admin')` → a service-role edge call (`auth.uid() IS NULL`) returns **zero rows**.
3. No `normalized_name` column or index exists → no `regexp_replace` SQL anywhere.
4. Brand slugs are hyphen-preserving (e.g. `axis-y`), so slug equality must use a slugifier, not `normalizeBrandName`.
5. `name ILIKE '%<token>%'` for input `axisy` will NOT match DB row `AXIS-Y` — we need a separate normalized-prefix path so collapsed inputs still find punctuated rows.
6. The "first token" can be ≤ 2 chars (`A1`, `H&M`) → short-token guard required.

---

## Hard boundary — untouched

Legacy behavior with `entity_extraction.review_uses_draft = false` is fully preserved. We will NOT edit:

- `supabase/functions/analyze-entity-url/` (v1)
- `supabase/functions/enrich-brand-data/` and `fetch-url-metadata-lite/` (read-only callers only)
- `supabase/functions/create-brand-entity/`
- `autoSelectParentBrand` + legacy branch in `CreateEntityDialog.tsx`
- Shared `_shared/image_validation.ts`
- `match_entities_by_name` RPC

Validation wording: *"With `review_uses_draft = false`, legacy Analyze/create behavior and DB writes remain unchanged."*

## Analyze v2 is strictly read-only

Header comment on entry handler and every enrichment call site:

> *"Analyze v2 is read-only. No brand rows. No entity rows. No media rows. No storage objects. The only write path is the Stage 1 footer → `create-brand-entity({ confirmCreate: true })`."*

---

## 1. Stage 1 — Brand candidates

### 1a. Existing-brand matching (backend, service-role) — RPC-free

All queries include: `type = 'brand' AND is_deleted = false AND approval_status <> 'rejected'`. All result sets capped at `LIMIT 50`.

1. **Slug exact** — `eq('slug', slugifyBrandName(name))` (hyphen-preserving slugifier, NOT `normalizeBrandName`).
2. **Website / registrable-domain equality** — `eq('website_url', cleanUrl)` then registrable-domain fallback.
3. **Tokenized capped fetch + JS normalized compare** — uses `firstToken` from cleaned tokens (see guard below):
   - `name ILIKE '%<firstToken>%' OR slug ILIKE '%<firstToken>%'`, LIMIT 50.
   - JS filter: keep rows where `normalizeBrandName(row.name) === normalizeBrandName(name)` OR `normalizeBrandName(row.slug) === normalizeBrandName(name)`.
4. **Normalized-prefix capped fetch + JS compare** *(new, per ChatGPT)* — handles collapsed inputs like `axisy` matching DB `AXIS-Y`:
   - `normalizedPrefix = normalizeBrandName(name).slice(0, 3)` (skip if `< 3` chars).
   - `name ILIKE '%<p[0]>%<p[1]>%<p[2]>%' OR slug ILIKE '%<p[0]>%<p[1]>%<p[2]>%'`, LIMIT 50.
     (Interleaved `%` between chars so `axi` matches `AXIS-Y` whose name contains `a`,`x`,`i` in order even with separators.)
   - Same JS normalized-equivalence filter as step 3.
5. **Fuzzy via JS Dice/bigram** on union of steps 3+4 fetches — keep top 5 with score ≥ 0.6.
6. **Plain ILIKE fallback** — top 3, only if 1–5 empty.

**Token-cleanup rule (per Codex):** compute tokens by lowercasing, replacing `[^a-z0-9]+` with a single space, trimming, then splitting on whitespace. So `AXIS-Y → ["axis","y"]`, `H&M → ["h","m"]`, `A1 → ["a1"]`. `firstToken` = first token of length ≥ 3.

**Short-token guard:** if no token reaches 3 chars, skip step 3's ILIKE-prefix path. Step 4's normalized-prefix path is also skipped when `normalizeBrandName(name).length < 3`. Rely on steps 1, 2, and the plain ILIKE fallback. Fail safely with empty candidates rather than scanning.

Hits become `matched_existing` candidates with real `id`, `image_url`, `slug`, `website_url`. De-duplicate by `id` across all steps.

### 1b. Logo/website enrichment for `suggested_new`

For up to 2 remaining `suggested_new` candidates with no `logoUrl`, invoke `enrich-brand-data` and use only `logo` + `website`. Per-call timeout 2.5s, total budget 5s. Failures silent + non-blocking.

### 1c. Manual duplicate check (frontend, admin JWT)

```ts
// src/utils/brandDuplicateCheck.ts
const { data: rpcRows } = await supabase.rpc('match_entities_by_name', {
  _name: input, _type: 'brand', _threshold: 0.6, _limit: 5,
});
const ids = (rpcRows ?? []).map(r => r.id);
const { data: safeRows } = ids.length
  ? await supabase
      .from('entities')
      .select('id, name, slug, image_url, website_url, approval_status, is_deleted, type')
      .in('id', ids)
      .eq('type', 'brand')
      .eq('is_deleted', false)
      .neq('approval_status', 'rejected')
  : { data: [] };
// Then normalize in JS for exact-equivalence highlight.
```

Rejected/deleted/non-brand rows never appear.

### 1d. Frontend grouping (`BrandPicker.tsx`)

Two sections: **Existing brands** (`[in database]` badge + logo) and **Suggested new brand** (`[new]` badge + "Inferred from URL — confirm to create."). `recommendedBrandIndex` set only on exact DB hit (step 1a.1, 1a.3, or 1a.4).

## 2. Remove duplicated "Confirm new brand" block

Delete `pendingNew` + inline `<Alert>` from `BrandPicker.tsx`. Clicking a `suggested_new` card sets `BrandDecision = { kind: 'create_new', candidate }` directly. One helper line under the selected card. Footer "Create Brand & Continue" in `DraftReviewBody.tsx` is the **only write trigger**.

## 3. Manual "Create new brand…"

Inline form: Brand name (req, ≥ 2), Website URL (optional), Logo URL (optional). On name change/submit → `brandDuplicateCheck`. Only after explicit "Create anyway" → `BrandDecision` with `source: 'admin_manual', status: 'suggested_new', confidence: 1`. Footer routes through `create-brand-entity({ confirmCreate: true })`.

## 4. Stage 2 — Image candidates

### 4a. Structured shape

```ts
type ExtraImageInput = {
  url: string;
  source: 'page_metadata' | 'firecrawl' | 'google_images' | 'official_site';
  confidence: number;
  width?: number; height?: number;
};
buildEntityDraft({ …, extraImageCandidates?: ExtraImageInput[] })
```

### 4b. Ranking — Google never auto-wins

`official_site` / `page_metadata` (0.85–0.95) > `firecrawl` (0.7–0.85) > `google_images` (**clamped ≤ 0.55**). `recommendedImageIndex` picks highest-confidence **non-Google** image.

### 4c. Google CSE trigger — quality + diversity

Trigger when **any** is true after dedupe + filter:

1. `usableCandidates.length < 4`
2. All usable candidates share one `source`
3. Fewer than 2 look product-specific (path contains slug/SKU/`product`/`pdp`, or ≥ 600px on known dimension)
4. > 60% with known aspect ratio outside `0.6–1.7`
5. ≥ 50% share image-hash prefix or path stem

One CSE call, `q = "<brandName> <entityName>"`, `num=3`, **2s timeout, silent on failure/missing keys**. Telemetry `image_fallback_reason ∈ {few, low_diversity, low_product_specificity, banner_heavy, repetitive, none}`.

### 4d. V2-only junk filter

New `supabase/functions/analyze-entity-url-v2/image_filter.ts`: `/favicon`, `/sprite`, `/banner`, `/1x1`, `/pixel`, `/spacer`, `/blank`, sub-100px when known. Shared `image_validation.ts` not modified.

### 4e. Broken-image handling (`ImageCandidateGrid.tsx`)

`useRef<Set<string>>` of broken URLs. `onError` adds URL → re-render. Broken tiles: greyed, "Image unavailable", checkbox disabled, excluded from `totalSelected`. If a broken URL was primary/in gallery, fire one idempotent `onChange` to deselect.

## 5. Admin Feature Flags — pipeline switcher

`AdminFeatureFlagsPanel.tsx` gets an "Entity creation pipeline" card writing `entity_extraction.review_uses_draft` via existing `useSetAppFlag` + AlertDialog + reason textarea:

- **Legacy — auto-create brand during Analyze** (`{ enabled: false }`)
- **Draft Review — create brand only after confirmation** (`{ enabled: true }`)

Footer shows current value, "Updated X ago — '<reason>'", affected surfaces. No new RPC.

---

## Shared text helpers — JS-only, no SQL

```ts
// _shared/brand_normalize.ts (Deno) + src/utils/brandNormalize.ts (browser)
// NAME equivalence ("AXIS-Y" vs "Axis Y" vs "axisy").
export function normalizeBrandName(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

// _shared/brand_slug.ts (Deno) + src/utils/brandSlug.ts (browser)
// SLUG equality — preserves hyphens, matches DB convention "axis-y".
export function slugifyBrandName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// _shared/brand_tokens.ts (Deno) + src/utils/brandTokens.ts (browser)
// Token extraction for ILIKE prefix matching — per Codex.
export function brandTokens(s: string): string[] {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
```

**No SQL `regexp_replace` anywhere.** All comparisons run in JS on LIMIT 50 result sets.

**Parity vitest** (`src/utils/brandTextHelpers.test.ts`):

- `normalizeBrandName`: `AXIS-Y`, `Axis Y`, `AXIS Y`, `axis_y`, `axisy`, `axis.y`, `"axis y "` → `axisy`
- `slugifyBrandName`: `AXIS-Y`, `Axis Y`, `axis_y`, `axis y`, `Axis--Y` → `axis-y`
- `brandTokens`: `AXIS-Y` → `["axis","y"]`, `H&M` → `["h","m"]`, `A1` → `["a1"]`
- Cross-check: `normalizeBrandName(slugifyBrandName(x)) === normalizeBrandName(x)` for the AXIS-Y set.

---

## Files touched

```text
supabase/functions/analyze-entity-url-v2/index.ts           # direct service-role brand queries 1a.1–1a.6, normalized-prefix path, enrich-brand-data calls (timeout-safe), extraImageCandidates, smart Google CSE trigger
supabase/functions/analyze-entity-url-v2/entity_draft.ts    # accept ExtraImageInput[], preserve source/confidence
supabase/functions/analyze-entity-url-v2/image_filter.ts    # NEW — V2-only junk filter
supabase/functions/_shared/brand_normalize.ts               # NEW
supabase/functions/_shared/brand_slug.ts                    # NEW
supabase/functions/_shared/brand_tokens.ts                  # NEW
src/utils/brandNormalize.ts                                 # NEW
src/utils/brandSlug.ts                                      # NEW
src/utils/brandTokens.ts                                    # NEW
src/utils/brandTextHelpers.test.ts                          # NEW — parity vitest for all three helpers
src/utils/brandDuplicateCheck.ts                            # NEW — RPC + post-filter + normalized equivalence
src/types/entityDraft.ts                                    # ExtraImageInput, BrandCandidate.source += 'admin_manual'
src/components/admin/entity-create/BrandPicker.tsx          # grouped sections, drop pendingNew, "Create new brand…" form
src/components/admin/entity-create/DraftReviewBody.tsx      # helper copy under create_new
src/components/admin/entity-create/ImageCandidateGrid.tsx   # onError → unavailable, auto-deselect, exclude from totalSelected
src/components/admin/AdminFeatureFlagsPanel.tsx             # pipeline switcher card
```

## Validation checklist

1. **Legacy unchanged**: flag OFF → same brand auto-create + same DB writes.
2. **Analyze v2 read-only**: flag ON → zero rows in `entities`, `entity_photos`, `mux_uploads`; zero storage uploads.
3. **Parity vitest passes** for `normalizeBrandName`, `slugifyBrandName`, `brandTokens`.
4. **Edge matcher returns non-zero rows** via direct service-role queries (not the admin-gated RPC).
5. **All AXIS-Y input variants resolve to existing slug `axis-y`**:
   - `AXIS-Y` → step 1a.1 (slug exact).
   - `Axis Y` → step 1a.1 (slug exact).
   - `axis_y` → step 1a.1 (slug exact).
   - `axisy` → step 1a.4 (normalized-prefix `axi` fetches `AXIS-Y` row, JS compare confirms).
6. **Short-token guard**: `H&M`, `A1` resolve via slug/domain without scanning. No errors when no token ≥ 3 chars.
7. **Frontend matcher** returns rows under admin JWT; rejected/deleted/non-brand IDs post-filtered out.
8. **Rejected brands never surface** in either path.
9. No inline "Confirm create" block; footer is the only write trigger.
10. Stage 2 shows mixed source chips when a diversity trigger fires. Verify `image_fallback_reason` in edge logs.
11. Broken tiles greyed, disabled, removed from selection count. Google never auto-promoted to primary.
12. Feature Flags toggle switches pipeline without SQL.
13. **Enrichment failures silent + non-blocking**: `enrich-brand-data` timeout / Google CSE 5xx → Analyze still returns a draft.

## Out of scope

- No DB migrations, RLS changes, new edge functions, new RPCs, `normalized_name` column, or `regexp_replace` SQL.
- No edits to legacy v1, `enrich-brand-data`, `fetch-url-metadata-lite`, `create-brand-entity`, or shared `image_validation`.