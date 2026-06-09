
# Phase 8 — Gemini Merge + Conservative Cleanups (final)

Goal: surface Gemini at the wire level inside `predictions` under strict provenance rules, AND let Gemini recover the Nykaa-class error path (direct fetch fails + Firecrawl weak/null + Gemini succeeds → V2 returns 200 instead of `FETCH_BAD_STATUS`). Three deterministic cleanups (name junk override, description priority, conservative root-level category map + brand). No V1 changes, no DB writes, no frontend redesign, no Gemini prompt/model/tool changes, no response-envelope break beyond optional `metadata.merge`.

Price ranges / MRP / `list_price` / `sale_price` / `selected_variant_price` are explicitly deferred to **Phase 8.1** — NOT in this phase.

## Two paths this phase must handle

1. **Success path** — extractor (or Firecrawl-improved extractor) produced `predictions`. Gemini, if present, improves selected fields under field-level rules. The recovery validity gate does NOT apply here; field-level validity does.
2. **Recovery path** — `extractorHasPredictions === false`. If Gemini passes the recovery validity gate, V2 returns 200 with predictions sourced from Gemini (plus any deterministic image/currency that survived). Otherwise the existing error response is returned unchanged.

## In scope

### 1. `GeminiRawPrediction` → `V2Predictions` converter
- New `geminiToV2Predictions(raw: GeminiRawPrediction): V2Predictions` in `merge.ts`.
- Fills `category_id = null`, `matched_category_name = null`, `suggested_category_path = null`. Category resolution runs after merge, using both `type` and `suggested_category_path`.
- Maps `additional_data.brand/price/currency` from raw, subject to price gating (see §6).
- `tags`, `images`, `image_url` taken from already-normalized raw values.

### 2. Recovery validity gate (recovery path ONLY)
Convert a fetch failure into 200 only if ALL hold:
- `gemini.type` is in the canonical V2 extractable subset
- `gemini.name` non-empty after trim, length ≥ 2
- `gemini.confidence >= 0.6`
- at least ONE of `description`, `image_url`, `brand`, or `tags.length >= 2` populated

If the gate fails, V2 returns the original error response unchanged. The gate is NEVER applied on the success path — there, individual Gemini fields are validated per-field and discarded individually if weak.

### 3. `mergePredictions({ extract, gemini, flags })` — clean API

```ts
mergePredictions({
  extract: V2Predictions | null,
  gemini: GeminiRawPrediction | null,
  flags: {
    priceConflict: boolean,
    firecrawlCurrency: string | null,
    firecrawlImageUrl: string | null   // deterministic image even if predictions are null
  }
}): { predictions: V2Predictions | null, diagnostics: MergeDiagnostics }
```

Internal branching:
- `extract != null` → **success path**: extractor is base, Gemini improves fields under per-field rules.
- `extract == null && gemini != null && passesRecoveryGate(gemini)` → **recovery path**: call `geminiToV2Predictions(gemini)` as base, then overlay deterministic survivors:
  - `image_url`: if `flags.firecrawlImageUrl` is a valid http(s) URL, prefer it over Gemini's image. Gemini image fills only when no deterministic image exists.
  - `additional_data.currency`: if Gemini lacks one, fill from `flags.firecrawlCurrency`.
  - `additional_data.price`: subject to §6 (blocked on conflict, otherwise requires `field_confidence.price >= 0.7`).
- both null OR recovery gate failed → `predictions: null` (caller returns existing error response).

**`mergePredictions` MUST return a fresh `predictions` object** (shallow clone of `extract` then field-by-field overlays; arrays/objects copied, never mutated in place). The caller is then free to mutate the returned object for category resolution without touching `finalExtract.predictions`.

Field rules (success path):

| Field | Winner |
|---|---|
| `type` | extractor (Gemini never overrides) |
| `name` | extractor UNLESS normalized extractor name still matches junk regex (`/^(Buy\|Shop\|Order\|Get)\b/i`, `/\bOnline$/i`, or length > 120 with trailing `For Him\|For Her\|Online\|India`) AND `gemini.field_confidence.name >= 0.7` → then Gemini |
| `description` | Gemini if non-empty, length 40–600, not junk-HTML (no `<`, no `{`, not all-caps). Else `extract.description`. No markdown paragraph fallback. |
| `image_url` | **Success:** extractor > Gemini. **Recovery:** `flags.firecrawlImageUrl` > Gemini. |
| `images` | extractor ∪ Gemini, dedupe by URL |
| `tags` | union, case-insensitive dedupe, cap 12 |
| `additional_data.brand` | Gemini (non-empty string) > `extract.additional_data.brand` only. NEVER read from `metadata.sources` (those are provenance strings, not values). |
| `additional_data.price` | See §6 below |
| `additional_data.currency` | extractor > `flags.firecrawlCurrency` > Gemini |
| `confidence` | success: `min(extract.confidence, gemini.confidence)`. recovery: `gemini.confidence` |
| `reasoning` | concat `"[extractor] ..."` + `"[gemini] ..."` |

### 4. `MergeDiagnostics` → `metadata.merge` (additive)

```ts
{
  path: "success" | "recovery",
  gemini_used: boolean,
  gemini_fields_used: number,       // count of fields whose winner === "gemini" (or "merged" for tags)
  field_winners: {
    type:        "extractor" | "gemini" | "none",
    name:        "extractor" | "gemini" | "none",
    description: "extractor" | "gemini" | "none",
    image_url:   "extractor" | "gemini" | "firecrawl" | "none",
    brand:       "extractor" | "gemini" | "none",
    price:       "extractor" | "gemini" | "none",
    currency:    "extractor" | "gemini" | "firecrawl" | "none",
    tags:        "extractor" | "gemini" | "merged" | "none"
  },
  name_junk_override_applied: boolean,
  price_conflict_blocked_gemini: boolean,
  recovery_gate_passed?: boolean    // present only when extract was null
}
```

- `field_winners.tags === "merged"` when BOTH extractor and Gemini contributed at least one surviving tag after dedupe.
- `field_winners.image_url === "firecrawl"` on recovery path when `flags.firecrawlImageUrl` won.
- On recovery path: `path: "recovery"`, `gemini_used: true`, `gemini_fields_used` reflects Gemini-sourced fields (NOT 0).
- Add `merge?: MergeDiagnostics` to `V2SuccessResponse.metadata` in `schema.ts`. Additive only.

### 5. Conservative root-level category resolver
- New `category_resolver.ts` + `categories_snapshot.json` (~15 root entries) checked into the function directory.
- **`categories_snapshot.json` contains pure JSON only — NO comments, NO header.** Snapshot staleness, last-verified date, and rules for adding entries are documented in `README.md` and in a top-of-file comment in `category_resolver.ts`.
- Signature: `resolveCategory({ type, suggested_category_path }) → { category_id, matched_category_name }`.
- Attempts:
  1. Match `suggested_category_path` (case-insensitive) to a root entry.
  2. Fallback: match canonical `type` (e.g. `product`, `book`, `movie`, `tv_show`) to its root entry. Recovery path (where `suggested_category_path` is null) still resolves.
- **Snapshot safety:** entries where the `category_id` cannot be verified as current store `category_id: null` and only `matched_category_name`. We never emit an unverified ID. Miss → both null, `suggested_category_path` preserved on `predictions`.
- No live DB dump script. No subcategories. No fuzzy matching.

### 6. Price handling — unified rule (success AND recovery)

`priceConflict` MUST be derived from deterministic diagnostics (`selected_price_source === "omitted"`). Never inferred.

| Condition | Result |
|---|---|
| `flags.priceConflict === true` | `additional_data.price` is OMITTED. Currency kept. Gemini price IGNORED on both paths. `price_conflict_blocked_gemini = true`. |
| `flags.priceConflict === false` AND extractor has a price (success path) | Use extractor price. Gemini price ignored. |
| `flags.priceConflict === false` AND extractor has no price AND `gemini.additional_data.price != null` AND `gemini.field_confidence.price >= 0.7` | Use Gemini price. |
| Otherwise | OMIT price, keep currency if known. |

This rule applies in BOTH `mergePredictions` (success path) AND `geminiToV2Predictions` (recovery path). `geminiToV2Predictions` does NOT copy `gemini.additional_data.price` blindly — it applies the same confidence gate.

### 7. Wiring in `index.ts`

```
const fetchOutcome = await safeFetch(...);
const extract = fetchOutcome.ok ? runExtractor(...) : null;
const firecrawl = maybeRunFirecrawl(...);
const finalExtract = pickFinalExtract(extract, firecrawl);

const priceConflict      = deriveConflictFromDiagnostics(finalExtract, firecrawl);
const firecrawlCurrency  = deriveCurrencyFromDiagnostics(finalExtract, firecrawl);
const firecrawlImageUrl  = deriveImageFromDiagnostics(finalExtract, firecrawl);

const geminiResult = await maybeRunGemini(...);
// NOTE: Use the ACTUAL GeminiSuccess field from current code
// (likely geminiResult.prediction). Verify in build mode; do NOT
// invent geminiResult.raw.
const geminiPred = geminiResult?.prediction ?? null;

const extractorHasPredictions = !!finalExtract?.predictions;

if (!extractorHasPredictions && (!geminiPred || !passesRecoveryGate(geminiPred))) {
  return existingErrorResponse;   // unchanged
}

const { predictions, diagnostics } = mergePredictions({
  extract: finalExtract?.predictions ?? null,
  gemini: geminiPred,
  flags: { priceConflict, firecrawlCurrency, firecrawlImageUrl }
});

// predictions is a FRESH object; safe to mutate.
const resolved = resolveCategory({
  type: predictions.type,
  suggested_category_path: predictions.suggested_category_path
});
predictions.category_id = resolved.category_id;
predictions.matched_category_name = resolved.matched_category_name;

return success({ predictions, metadata: { ..., merge: diagnostics } });
```

## Out of scope (explicit)
- **Price ranges, MRP, `list_price`, `sale_price`, `selected_variant_price`, `price_min/max`, `price_display`** — deferred to **Phase 8.1**. Single-`price` contract preserved.
- No DB writes, no brand entity auto-create, no schema migrations.
- No V1 changes.
- No Gemini prompt / model / tool changes.
- No response envelope break — only additive `metadata.merge`.
- No `proxy-external-image`, `ImageWithFallback`, `AutoFillPreviewModal` changes.
- No live DB category dump script.
- No name normalization beyond the junk-override switch.
- No description markdown paragraph fallback.
- No `categories_snapshot.json` comments/headers.

## Verification

**Nykaa URL (currently `FETCH_BAD_STATUS`):**
- 200 `success: true`.
- `predictions.name`, `description`, `additional_data.brand` populated from Gemini.
- `predictions.image_url` = Firecrawl/extractor image if available, else Gemini image.
- `additional_data.price` absent (priceConflict); `additional_data.currency === "INR"`.
- `metadata.merge.path === "recovery"`, `gemini_used: true`, `recovery_gate_passed: true`, `gemini_fields_used >= 2`, `price_conflict_blocked_gemini: true`, `field_winners.image_url` is `"firecrawl"` or `"gemini"` depending on what survived.
- `predictions.category_id` verified product-root ID or null.

**Clean Amazon book URL (success path):**
- `predictions.type === "book"` from extractor.
- `metadata.merge.path === "success"`. Phase 7 diagnostics unchanged in shape.

**Gemini disabled or failing on a clean URL:**
- Output identical to Phase 7; `merge.gemini_used: false`, `gemini_fields_used: 0`.

**Recovery gate failure:**
- Original error response preserved.

**Success path with weak Gemini description:**
- Extractor description retained; other Gemini fields (e.g. brand) can still win individually. Confirms recovery gate does NOT apply on success path.

**Mutation safety:**
- After merge + category resolution, `finalExtract.predictions` is unchanged. Asserted in a unit test by snapshotting `finalExtract.predictions` before and after.

**Offline unit tests:**
- `merge_test.ts`:
  - success + recovery winners
  - junk-name override on/off
  - `priceConflict` blocks Gemini price on BOTH paths
  - Gemini price requires `field_confidence.price >= 0.7` on BOTH paths
  - `firecrawlCurrency` preserved on recovery
  - `firecrawlImageUrl` wins over Gemini image on recovery
  - brand never sourced from `metadata.sources`
  - junk-HTML description rejected
  - recovery gate accept/reject
  - `field_winners.tags === "merged"` when both contribute
  - returned predictions is a fresh object (mutation does not affect input)
- `category_resolver_test.ts`: root match via path, fallback via type, miss → both null + `suggested_category_path` preserved, unverified entries return name only.
- `geminiToV2Predictions`: required fields filled, category fields null, price gating honored.

## Files

New:
- `supabase/functions/analyze-entity-url-v2/merge.ts`
- `supabase/functions/analyze-entity-url-v2/merge_test.ts`
- `supabase/functions/analyze-entity-url-v2/category_resolver.ts` (snapshot-staleness docs in top comment)
- `supabase/functions/analyze-entity-url-v2/category_resolver_test.ts`
- `supabase/functions/analyze-entity-url-v2/categories_snapshot.json` (pure JSON, no comments)

Modified:
- `supabase/functions/analyze-entity-url-v2/index.ts` — wire merge + recovery branch + diagnostics plumbing (`firecrawlImageUrl` added).
- `supabase/functions/analyze-entity-url-v2/schema.ts` — add optional `metadata.merge` with `"firecrawl"` and `"merged"` winners.
- `supabase/functions/analyze-entity-url-v2/README.md` — document merge rules, recovery gate, image precedence, category snapshot staleness policy.

Untouched: all V1 files, `prompt-generator-v2.ts`, `gemini.ts`, `extractor.ts`, `fetcher.ts`, `firecrawl_recovery.ts`, `response_schema.ts`, `AutoFillPreviewModal.tsx`, `ImageWithFallback`, `proxy-external-image`, DB schema.

## Build-mode preflight (verify before writing code)
1. Confirm the actual `GeminiSuccess` property name (likely `geminiResult.prediction`) — do NOT invent `.raw`.
2. Confirm where `selected_price_source`, currency, and og:image / Firecrawl image diagnostics live so `priceConflict`, `firecrawlCurrency`, and `firecrawlImageUrl` are read from the correct fields even when deterministic `predictions` is null.
3. Confirm each `categories_snapshot.json` `category_id` is currently valid; if not, store name-only.

## Future (Phase 8.1, NOT this phase)
Dedicated pricing model: `price_range { min, max }`, `list_price`, `sale_price`, `selected_variant_price`, `price_source`, `price_confidence`, multi-SKU handling. Separate plan; UI + contract decision.
