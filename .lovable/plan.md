
# Phase 8.1A — Pricing Block (additive, no extractor/firecrawl/UI changes)

This build implements **only 8.1A**. Sub-phases 8.1B (JSON-LD Offer[] / AggregateOffer), 8.1C (Firecrawl MRP/Sale pair), and 8.1D (admin preview UI) are documented as future work and are **not** in this build.

## Hard invariants (apply to 8.1A and ALL future 8.1 sub-phases)

These are non-negotiable. Tests must enforce them.

1. **`additional_data.price` is never changed from Phase 8 behavior.**
   - 8.1A does not write, recompute, or delete `additional_data.price`.
   - 8.1B/C/D will not either. The only path that omits `price` remains the existing Phase 8 `flags.priceConflict` rule.
2. **`additional_data.pricing` is attached** whenever it carries useful info:
   - `price_source !== "omitted"`, OR
   - `price_conflict === true`, OR
   - `currency` is known, OR
   - any of `list_price` / `sale_price` / `price_min` / `price_max` / `selected_variant_price` is non-null.
3. **Gemini never creates or widens a public price range.** Gemini disagreement is recorded as diagnostic only (`gemini_observed_price`).
4. **No V1, DB, Gemini prompt/model/tools, or response envelope changes.** Additive only: `additional_data.pricing` and `metadata.pricing`.
5. **Fail-safe formatting.** If `Intl.NumberFormat` cannot resolve a currency symbol, fall back to `"<CODE> <number>"` (e.g. `"INR 1,499"`). Never throw.
6. **No over-inference of `price_source`.** If existing diagnostics do not unambiguously identify the source, use the conservative generic value (see §"Source resolution") and set the internal `price_source_used` diagnostic. Never claim JSON-LD/OG/Firecrawl certainty without evidence.

## Schema (introduced in 8.1A)

```ts
additional_data.pricing?: {
  currency: string | null;
  list_price: number | null;               // null in 8.1A (filled in 8.1B/8.1C)
  sale_price: number | null;               // mirrors the legacy price when one exists
  selected_variant_price: number | null;   // null in 8.1A
  price_min: number | null;                // null in 8.1A
  price_max: number | null;                // null in 8.1A
  price_display: string | null;            // formatted via formatPriceDisplay
  price_source:
    | "extractor_jsonld_offer"
    | "extractor_meta_og"
    | "firecrawl_metadata"
    | "firecrawl_markdown_single"
    | "gemini"
    | "unknown"                            // conservative tag when source is ambiguous
    | "omitted";
  price_confidence: number;                // 0..1
  price_conflict: boolean;                 // mirrors Phase 8 flag
  gemini_observed_price?: number | null;   // diagnostic only, never widens a range
  gemini_observed_currency?: string | null;
}

metadata.pricing?: {
  source: pricing.price_source;
  confidence: number;
  conflict: boolean;
  has_range: boolean;                      // always false in 8.1A
  has_list_sale: boolean;                  // always false in 8.1A
  gemini_diagnostic_only: boolean;         // Gemini disagreed but was not used
  price_source_used?: "exact" | "inferred" | "unknown";  // internal honesty signal
}
```

`list_price`, `selected_variant_price`, `price_min`, `price_max`, and the range/MRP-pair-derived `price_source` values are reserved for 8.1B/8.1C. They stay in the type now so future sub-phases are purely additive.

## Source resolution (8.1A — conservative)

| Existing Phase 8 signal | `price_source` | `price_source_used` | confidence |
|---|---|---|---|
| Phase 8 wrote a price AND `metadata.extract.sources` clearly indicates JSON-LD | `extractor_jsonld_offer` | `"exact"` | 0.90 |
| Phase 8 wrote a price AND `metadata.extract.sources` clearly indicates OG meta | `extractor_meta_og` | `"exact"` | 0.80 |
| Phase 8 wrote a price AND `metadata.firecrawl` was the final extraction source AND metadata-tier signal | `firecrawl_metadata` | `"exact"` | 0.75 |
| Phase 8 wrote a price AND `metadata.firecrawl` was the final extraction source AND markdown-tier signal | `firecrawl_markdown_single` | `"exact"` | 0.65 |
| Phase 8 wrote a price AND `metadata.gemini` was the source (recovery path) | `gemini` | `"exact"` | `min(0.70, gemini.field_confidence.price)` |
| Phase 8 wrote a price but source cannot be uniquely identified | `"unknown"` | `"inferred"` | 0.50 |
| Phase 8 omitted due to `priceConflict` | `"omitted"` | `"exact"` | 0.0 (`price_conflict: true`, currency kept) |
| Phase 8 omitted, no conflict, but currency is known | `"omitted"` | `"exact"` | 0.0 |
| Phase 8 had nothing | n/a — block not attached unless currency/conflict info present | — | — |

If the existing diagnostics in `index.ts` cannot reliably distinguish the source in any one of the rows above, add a minimal `price_source_used` annotation in the diagnostics produced by `mergePredictions` (the existing one written next to `flags.priceConflict`). Do not add new fields to V1 or extractor.

## Gemini disagreement handling (8.1A)

When Phase 8 used a deterministic price AND Gemini reported a different price (`field_confidence.price >= 0.7`, same currency):
- Record `gemini_observed_price` and `gemini_observed_currency` on the pricing block.
- Set `metadata.pricing.gemini_diagnostic_only = true`.
- Do NOT change `sale_price`. Do NOT create a range. Do NOT touch `additional_data.price`.

## New files

- `supabase/functions/analyze-entity-url-v2/pricing.ts`
  - `buildPricing(input): PricingBlock`
  - `formatPriceDisplay(amount: number | null, currency: string | null): string | null` — Intl-based with `"<CODE> <amount>"` fallback. Never throws on garbage input.
  - `summarizePricing(p: PricingBlock): MetadataPricingBlock`
- `supabase/functions/analyze-entity-url-v2/pricing_test.ts`

## Modified files

- `supabase/functions/analyze-entity-url-v2/merge.ts` — after existing price logic, call `buildPricing` with: legacy `out.additional_data.price`, currency, `flags`, gemini's price + currency + `field_confidence.price`, and the source hint resolved per the table above. Attach `out.additional_data.pricing` per invariant #2. **Do not touch** `out.additional_data.price`.
- `supabase/functions/analyze-entity-url-v2/merge_test.ts` — add regression assertions enforcing invariants #1–#3.
- `supabase/functions/analyze-entity-url-v2/schema.ts` — add optional `metadata.pricing` typing (additive).
- `supabase/functions/analyze-entity-url-v2/index.ts` — when pricing block was attached, set `metadata.pricing = summarizePricing(pricing)`.
- `supabase/functions/analyze-entity-url-v2/README.md` — document the pricing block, source resolution table, invariants, and that 8.1B/C/D are deferred.

**Untouched in 8.1A:** `extractor.ts`, `firecrawl_recovery.ts`, `gemini.ts`, `prompt-generator-v2.ts`, `fetcher.ts`, `response_schema.ts`, all V1 files, DB, and `AutoFillPreviewModal.tsx`.

## Tests (`pricing_test.ts`)

- Phase 8 extractor price preserved → `sale_price` filled, `additional_data.price` byte-identical.
- Phase 8 `priceConflict` → `price_source: "omitted"`, `price_conflict: true`, currency preserved, pricing block attached, `additional_data.price` absent (unchanged).
- Phase 8 omitted, no conflict, no currency → pricing block NOT attached.
- Nykaa-class: currency known + conflict + no price → pricing block attached with `currency: "INR"`, `price_source: "omitted"`, `price_conflict: true`.
- Gemini disagrees with deterministic price → `gemini_observed_price` recorded; `gemini_diagnostic_only: true`; no range; legacy price untouched.
- Ambiguous source → `price_source: "unknown"`, `price_source_used: "inferred"`, confidence 0.50.
- `formatPriceDisplay` returns `"INR 1,499"` when Intl currency symbol is unavailable (mock).
- `formatPriceDisplay` never throws on `NaN`, negative, null, or unknown currency code.
- **Regression suite:** every existing `merge_test.ts` case still passes; for each, snapshot `additional_data.price` before/after 8.1A and assert equality.

## Verification (manual)

1. Clean Amazon product → `pricing.sale_price` populated, `pricing.price_source` = `extractor_jsonld_offer` (or `unknown` if diagnostics are ambiguous), `pricing.price_display` = `"₹1,499"`, `additional_data.price` unchanged from Phase 8.
2. Nykaa recovery → 200 success, `additional_data.price` absent, `additional_data.currency: "INR"`, `pricing.price_source: "omitted"`, `pricing.price_conflict: true`, `metadata.pricing.conflict: true`.
3. Clean URL with Gemini disagreement → deterministic price kept; `gemini_observed_price` recorded; `gemini_diagnostic_only: true`.
4. Phase 8 regression test suite: green, zero changes to `additional_data.price`.

## Build-mode preflight

1. Confirm which existing diagnostic fields in `index.ts` identify the source of the price Phase 8 wrote. If none uniquely identify it, the merge diagnostic adds `price_source_used` set to `"inferred"` and `pricing.price_source` defaults to `"unknown"` — no extractor changes.
2. Verify `Intl.NumberFormat` fallback path in the Deno edge runtime (write a tiny probe in `pricing_test.ts` that asserts fallback string format).
3. Confirm `mergePredictions` returns a fresh object (already enforced by Phase 8) so attaching `additional_data.pricing` cannot mutate `finalExtract.predictions`.

---

## Future sub-phases (DOCUMENTED, NOT IMPLEMENTED IN THIS BUILD)

Each is a separate build, decided after 8.1A verification. All future sub-phases inherit invariants #1–#6 above.

### 8.1B — JSON-LD Offer[] / AggregateOffer (extractor change)

- Add `extractedOffers?: { offers: Array<{ price; currency; availability?; selected? }>; aggregate?: { low; high; currency } }` to `ExtractResult`. Populate from JSON-LD `Product.offers`. Existing extractor price/currency writes unchanged.
- `pricing.ts` deterministic range rules:
  - `AggregateOffer` with `low < high`, same currency, `high/low <= 1.5` → `price_min`/`price_max`, source `extractor_jsonld_aggregate`, confidence 0.95.
  - `Offer[]` ≥ 2 with same currency, `max/min <= 1.5` → `price_min`/`price_max`, source `merged_range` (deterministic-deterministic), confidence 0.90.
  - **Mixed-currency `Offer[]`** → no range, no `sale_price` from the offer set, mark `pricing.price_conflict = true`, `price_source: "omitted"`, **preserve any legacy currency from Phase 8**. No majority-currency fallback.
  - Selected variant: **explicit `selected: true` or `default: true` ONLY**. No URL/SKU parsing in 8.1B. `eligibleQuantity` is never a selection signal.
- `additional_data.price` still untouched (invariant #1).

### 8.1C — Firecrawl labeled MRP + Sale pair

- Extend `firecrawl_recovery.ts` diagnostics with `mrp_sale_pair: { mrp: number; sale: number; currency: string | null } | null` (currency included so `pricing.ts` does not have to re-infer).
- Detect only when markdown has explicitly labeled `MRP`/`List` AND `Sale`/`Offer Price`/`Price` in the main region, same currency, `mrp >= sale`. Variant-size prices (e.g. Nykaa's 100ml vs 200ml) must NOT be treated as MRP/sale.
- `pricing.ts`: when pair present, set `list_price = mrp`, `sale_price = sale`, source `firecrawl_markdown_mrp_sale_pair`, confidence 0.70.
- `additional_data.price` still untouched (invariant #1).

### 8.1D — Admin preview UI

- `AutoFillPreviewModal.tsx`: render `pricing.price_display` as a labeled row when present. When `price_conflict: true` and no display, render `"Price omitted — conflicting sources"` with currency if known. Raw `pricing` still appears in the generic `additional_data` dump.
- No backend changes.

## Out of scope (deferred again)

- DB persistence of the `pricing` block.
- Per-SKU enumeration beyond min/max + optional selected.
- Cross-currency normalization.
- Historical price tracking.
- Tax/shipping computation.
- URL/SKU-to-Offer matching.
- Letting Gemini create or widen public price ranges.
