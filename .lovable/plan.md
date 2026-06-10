
# Phase 8.1B — JSON-LD Offers / AggregateOffer (deterministic ranges + explicit variant)

Backend-only. Extends the 8.1A pricing block with deterministic public ranges and an explicit selected-variant price from JSON-LD. Inherits all six 8.1A invariants. **`additional_data.price` stays byte-identical to Phase 8.**

## Clarifications baked in (all review rounds)

1. **Source = `finalExtract?.extractedOffers`.** Recovery with no extract → undefined (fine).
2. **Public ranges require a deterministic currency.** Never adopt a Gemini-only currency. Deterministic hints: `jsonld`, `og`, `firecrawl_metadata`, `firecrawl_markdown`. Non-deterministic: `gemini`, `unknown`, `null`.
3. **Semantic split — do NOT overload `price_conflict`.** `pricing.price_conflict` keeps its 8.1A meaning (Phase 8 omitted legacy price). 8.1B adds a separate `range_conflict: boolean` field for mixed-currency Offer[]. `metadata.pricing.conflict` is true when either is true; new `metadata.pricing.range_conflict` mirrors the new field.
4. **Mixed-currency Offer[] never overwrites 8.1A output.** Only sets `range_conflict: true` and `metadata.pricing.range_conflict: true`. `sale_price`, `price_source`, `price_confidence`, `currency`, `price_display`, `flags.priceConflict`, and `additional_data.price` are all untouched.
5. **Precedence when selected variant AND range both qualify:** populate both; `price_source = "extractor_jsonld_offers_selected"`; `price_confidence = 0.92`; `has_range = true`.
6. **New `PriceSource` values:** `extractor_jsonld_aggregate`, `extractor_jsonld_offers_merged_range`, `extractor_jsonld_offers_selected`.
7. **Strict boolean parsing.** `selected === true` / `default === true` only. String `"true"`, `1`, truthy objects ignored. `eligibleQuantity` is never a selection signal.
8. **Narrow, deterministic JSON-LD price parsing.**
   - **Accept:** finite `number` > 0 (excluding `Infinity`/`NaN`); numeric strings matching exactly one of:
     - `/^\s*\d+\s*$/`                    (e.g. `"1499"`)
     - `/^\s*\d+\.\d+\s*$/`               (e.g. `"1499.00"`)
     - `/^\s*\d{1,3}(?:,\d{3})+\s*$/`     (US thousands, e.g. `"1,499"`, `"12,499"`)
     - `/^\s*\d{1,3}(?:,\d{3})+\.\d+\s*$/` (US thousands + decimal, e.g. `"12,499.50"`)
   - **Reject (no throw, just drop the offer):** `null`, `undefined`, `""`, `"N/A"`, `NaN`, `Infinity`, `-Infinity`, zero, negative; European formats (`"1499,00"`, `"1.499,00"`); space-separated (`"1 499"`); currency-prefixed (`"₹1,499"`, `"$1,499"`, `"INR 1499"`); any other shape.
   - Comma is **only** a thousands separator. Decimal is **only** `.`.
9. **JSON-LD `@type` array handling.** A node counts as `Offer`/`AggregateOffer` if `@type` is a string matching that type **or** an array containing it (case-insensitive compare). Unrelated types are skipped silently.
10. **Partial-null currencies in Offer[]** (new):
    - All offers have the same non-null `priceCurrency` → use it.
    - All offers have null `priceCurrency` → adopt Phase 8 currency only if `priceSourceHint` is deterministic (per #2).
    - **Some non-null + some null**, and all non-null values agree on currency `C`, **and** Phase 8 deterministic currency equals `C` → adopt `C` for the range; emit range if other rules pass.
    - **Some non-null + some null**, all non-null agree on `C`, but Phase 8 currency is missing or differs from `C` → no range, no conflict.
    - **Non-null currencies disagree** (regardless of nulls present) → `range_conflict: true`; no range; 8.1A untouched.
    - Gemini-only currency never participates in adoption.

## What 8.1B adds to the pricing block

| Field                              | When populated                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `price_min` / `price_max`          | Deterministic range per rules below. Omitted when `min === max` (collapsed).        |
| `selected_variant_price`           | Exactly one Offer with strict `selected === true` OR `default === true`, finite price, matching/adoptable currency |
| `range_conflict`                   | New. Mixed-currency Offer[] only. Pricing-block-scoped.                              |
| `price_source` (new enum values)   | `extractor_jsonld_aggregate`, `extractor_jsonld_offers_merged_range`, `extractor_jsonld_offers_selected` |
| `metadata.pricing.has_range`       | True when range emitted                                                              |
| `metadata.pricing.range_conflict`  | New. Mirrors block-level `range_conflict`                                            |

`list_price`, `additional_data.price`, and 8.1A's `sale_price` are never modified by 8.1B (except via the precedence rule in #5, which only **adds** alongside).

## Range rules (deterministic-only)

Emit a range ONLY when ALL hold:
- **AggregateOffer:** finite `lowPrice < highPrice`, same non-null `priceCurrency`, `highPrice / lowPrice ≤ 1.5`. Source `extractor_jsonld_aggregate`, confidence 0.95.
- **Offer[] ≥ 2 valid:** at least two parseable offers; currency rule per #10; `max / min ≤ 1.5`. Source `extractor_jsonld_offers_merged_range`, confidence 0.90.
- **Ratio > 1.5** → no range, no conflict (likely different variants).
- **Mixed currencies in Offer[]** → no range; `range_conflict: true`; no other 8.1A change.
- **`min === max`** → omit `price_min`/`price_max`.
- **Currency unknown and not adoptable** → no range, no conflict.

## Selected variant rule (strict)

Set `selected_variant_price` only when:
- Exactly ONE Offer has `selected === true` OR `default === true` (strict boolean).
- Its `price` parses cleanly (per #8) and is finite > 0.
- Its `priceCurrency` matches the resolved pricing currency, OR pricing currency is null and the offer carries a non-null currency that becomes the adopted currency.

Zero or multiple flagged → null. No URL/SKU/query-param/ordering/`eligibleQuantity` inference.

## Source/precedence resolution (8.1B layer, after 8.1A base)

1. **Mixed-currency Offer[]** → set `range_conflict: true` and `metadata.pricing.range_conflict: true`. Leave everything else from 8.1A unchanged. STOP.
2. **Selected variant qualifies + range qualifies** → fill both; `price_source = "extractor_jsonld_offers_selected"`; `price_confidence = 0.92`; `has_range = true`.
3. **Selected variant only** → fill `selected_variant_price`; source `extractor_jsonld_offers_selected`; confidence 0.92.
4. **Range only** → fill `price_min`/`price_max`; source/confidence per range rule; `has_range = true`.
5. **None qualify** → 8.1A block untouched.

8.1B never lowers a stronger 8.1A confidence on `sale_price`; the 8.1A `sale_price` is preserved alongside new fields.

## Files

### Modified
- **`extractor.ts`** — Add optional `extractedOffers?: { offers: Array<{ price: number; currency: string | null; selected: boolean; default: boolean }>; aggregate: { low: number; high: number; currency: string | null } | null } | null` to `ExtractResult`. Populated from JSON-LD `Product.offers` and `AggregateOffer`. Existing single-offer price/currency writes unchanged. Uses defensive parser from #8 and `@type` array handling from #9. Strict boolean `selected`/`default`. Never throws.
- **`pricing.ts`**
  - Extend `PriceSource` with the three new values.
  - Extend `PricingBlock` with `range_conflict: boolean` (default false).
  - Extend `MetadataPricingBlock` with `range_conflict: boolean`.
  - Extend `BuildPricingInput` with `offers?: ExtractedOffers | null`.
  - Add `applyOffersToPricing(base8_1A, offers, hintIsDeterministic)` invoked at the end of `buildPricing`. Pure; never mutates input.
  - Update `summarizePricing` to surface `range_conflict` and OR it into `conflict`.
  - Update `pricingBlockHasContent` to return true when `range_conflict` is true.
- **`merge.ts`** — Add `extractedOffers?: ExtractedOffers | null` to `MergeFlags`. Pass through to `buildPricing` via `attachPricing`. Compute `hintIsDeterministic` from the already-resolved hint and pass it in. **Do not** touch `flags.priceConflict`.
- **`index.ts`** — On both success and recovery paths, read `finalExtract?.extractedOffers` and pass via `MergeFlags.extractedOffers`.
- **`schema.ts`** — Add three new strings to `metadata.pricing.source` union; add `range_conflict: boolean` to `additional_data.pricing` and `metadata.pricing`.

### Tests
- **`extractor_test.ts`** — array offers; AggregateOffer node; `@type` as array (`["Offer","Demand"]`); mixed casing (`"offer"`, `"OFFER"`); mixed currency; explicit `selected: true`; `default: true`; multiple flagged; string `"true"` rejected; `eligibleQuantity` ignored; full parser matrix from #8 (each accepted/rejected case); malformed nodes dropped without throw.
- **`pricing_test.ts`** —
  - AggregateOffer happy path.
  - Offer[] same-currency range emits.
  - Ratio > 1.5 suppresses range, no conflict.
  - Collapsed range (`min===max`) suppresses.
  - Mixed-currency Offer[]: `range_conflict: true`, `metadata.pricing.range_conflict: true`, `metadata.pricing.conflict: true`; 8.1A fields byte-identical to no-offers baseline; `flags.priceConflict` unchanged.
  - All-null offer currencies + Phase 8 currency from `jsonld`/`og`/`firecrawl_*` → range adopts.
  - All-null offer currencies + Phase 8 currency from `gemini` → no range, no conflict.
  - All-null offer currencies + no Phase 8 currency → no range.
  - **Partial-null currencies (new)**: `[{1000,INR},{1499,null}]` + Phase 8 deterministic INR → range adopts INR.
  - Partial-null currencies + Phase 8 USD (mismatch) → no range, no conflict.
  - Partial-null currencies + Phase 8 currency from Gemini → no range, no conflict.
  - Non-null currencies disagree (`[{1000,INR},{15,USD}]`) → `range_conflict: true`, no range.
  - Selected variant only → `extractor_jsonld_offers_selected`, confidence 0.92.
  - Selected variant + range → both populated, source `extractor_jsonld_offers_selected`, `has_range: true`.
  - Multiple `selected` flagged → `selected_variant_price` null.
- **`merge_test.ts`** — pricing block receives offers via `MergeFlags`; `additional_data.price` byte-identical to Phase 8 across every existing case (regression); `flags.priceConflict` unchanged across all 8.1B branches; `price_conflict` (legacy) vs `range_conflict` (new) distinct in response.

## Verification

1. Full existing suite green (236 tests).
2. New 8.1B tests cover every branch above.
3. Manual: real Product page with AggregateOffer → emits `price_min`/`price_max`, source `extractor_jsonld_aggregate`.
4. Manual: synthetic mixed-currency Offer[] fixture where Phase 8 has `additional_data.price = 1499` → response shows `additional_data.price: 1499`, `pricing.sale_price: 1499`, `pricing.range_conflict: true`, `pricing.price_conflict: false`, `flags.priceConflict: false`.
5. Manual: partial-null fixture → adopts deterministic currency, emits range.
6. Manual: Nykaa recovery still returns the same 8.1A response (no JSON-LD offers).
7. `additional_data.price` byte-identical on every existing test case (snapshot diff = 0).

## Out of scope (deferred)

- 8.1C: Firecrawl labeled MRP / Sale pair → `list_price` + `sale_price`.
- 8.1D: Admin preview UI for `price_display`.
- DB persistence, currency normalization, per-SKU enumeration, URL/SKU-to-Offer matching, tax/shipping, history.
- Letting Gemini contribute to ranges, variant prices, or range-currency adoption.
- European number format support.
