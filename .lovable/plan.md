
# Phase 8.1C — Firecrawl markdown MRP/Sale pairing (final v2, with all guardrails)

## Verdict on reviewer feedback

Adopt all prior 7 guardrails **plus three new tightenings**:
1. **Codex #1** — JSON-LD `price_min`/`price_max` also blocks Firecrawl list/sale override.
2. **Codex #2** — `price_display` for an accepted pair renders **both** values: `"<sale> (MRP <list>)"`.
3. **ChatGPT** — when multiple MRP/List candidates exist, prefer the **nearest valid MRP/List candidate to the selected sale candidate** (by character distance in the main region), not the first MRP on the page.

Keep `MIN_SALE_TO_MRP_RATIO = 0.4`. Backend-only, additive, deterministic. No UI, DB, V1, Gemini, prompt, or extractor changes.

## Goal

When Firecrawl markdown clearly exposes both an MRP/List Price and a separately-labeled current price, surface them as `list_price` + `sale_price` and render `price_display` as `"₹1,299 (MRP ₹1,999)"`. `additional_data.price` byte-identical to Phase 8 in every branch.

## Files touched

- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery.ts`
- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery_test.ts`
- `supabase/functions/analyze-entity-url-v2/pricing.ts`
- `supabase/functions/analyze-entity-url-v2/pricing_test.ts`
- `supabase/functions/analyze-entity-url-v2/merge.ts`
- `supabase/functions/analyze-entity-url-v2/index.ts`
- `supabase/functions/analyze-entity-url-v2/schema.ts`

## `firecrawl_recovery.ts` — label-aware candidates + nearest-MRP pairing

1. Refactor `firstMarkdownPrice` internals so each candidate carries metadata:
   ```ts
   type PriceCandidate = {
     value: number;
     index: number; // char offset in main region
     label: "MRP" | "List Price" | "Offer Price" | "Sale Price" | "Price" | null; // null = currency-only
     currency: string | null; // ISO from matched token (₹→INR, $→USD, €→EUR, £→GBP, Rs/INR→INR, USD/EUR/GBP→self)
     tier: 1 | 2 | 3;
   };
   ```
   Existing single-price selection (`additional_data.price`) keeps current tier ordering — **byte-identical**.

2. Export `MIN_SALE_TO_MRP_RATIO = 0.4` as a named constant.

3. Add `detectListSalePair(region, metadataCurrency)`:
   - **Sale candidates:** label ∈ `{"Offer Price","Sale Price","Price"}`. Currency-only excluded. Priority: `Offer Price > Sale Price > Price`. Generic `Price` only acceptable when at least one MRP/List candidate exists with a strictly higher value.
   - **List candidates:** label ∈ `{"MRP","List Price"}`. Currency-only excluded.
   - **Pairing rule (nearest-MRP):** Select the highest-priority sale candidate first. Among list candidates that pass sanity (`list > sale`, `sale >= 0.4 * list`, currency compatible), pick the one with **minimum `|list.index - sale.index|`**. If none pass → reject.
   - **Currency precedence (markdown-first):**
     1. Both sides have `currency` and match → use that.
     2. Currencies conflict → **reject**.
     3. One/both missing → metadata currency fallback if present; else reject.
   - Returns:
     ```ts
     markdown_list_sale_pair: {
       list_price: number;
       sale_price: number;
       currency: string | null;
       source: "mrp_sale_labels";
     } | null
     ```

4. Add `markdown_list_sale_pair` to `FirecrawlRecoveryDiagnostics`. No flat fields.

5. `additional_data.price` selection **unchanged**.

## `pricing.ts` — additive list/sale branch + dual-value display

1. Extend `BuildPricingInput`:
   ```ts
   firecrawlListSalePair?: {
     list_price: number;
     sale_price: number;
     currency: string | null;
     source: "mrp_sale_labels";
   } | null;
   ```

2. **Application rule (after all 8.1A/8.1B branches resolve):**
   - Apply only when `priceSourceHint === "firecrawl_markdown"`.
   - Apply only when `priceConflict === false`.
   - **JSON-LD precedence (expanded):** Skip if JSON-LD already populated **any** of: `list_price`, `selected_variant_price`, `price_min`, `price_max`. Code comment: *"JSON-LD structured offers (selected, list, or range) take precedence; Firecrawl list/sale only fills when JSON-LD did not provide structured pricing."*
   - When applied:
     - `list_price = pair.list_price`
     - `sale_price = pair.sale_price`
     - `price_source = "firecrawl_markdown_list_sale"`
     - `price_confidence = 0.72`
     - **`price_display`:** build via helper `renderListSaleDisplay(sale, list, currency)`:
       - `saleStr = formatPriceDisplay(sale, currency)`
       - `listStr = formatPriceDisplay(list, currency)`
       - If both non-null → `` `${saleStr} (MRP ${listStr})` ``
       - If either null → leave `price_display` as the pre-pair value (no regression).
   - **`additional_data.price` never recomputed here.**

## `merge.ts` + `index.ts`

- `merge.ts`: forward `firecrawlRecovery.diagnostics.markdown_list_sale_pair` into `buildPricing` as `firecrawlListSalePair`.
- `index.ts`: pass-through only.

## `schema.ts`

- Extend public `price_source` union to include `"firecrawl_markdown_list_sale"`.

## Tests

### `firecrawl_recovery_test.ts` (new)

1. `MRP: ₹1999\n\n₹1299` (sale currency-only) → **no pair**.
2. `MRP: ₹1999\nOffer Price: ₹1299` → pair, `currency="INR"` from markdown.
3. `MRP: ₹1999\nPrice: 1299` + metadata `INR` → pair via metadata fallback.
4. `MRP: ₹1999\nPrice: $1299` → currency conflict → reject.
5. Label priority: `MRP ₹1999\nOffer Price ₹1299\nSale Price ₹1399\nPrice 1499` → sale resolves to `1299`.
6. Ratio gate: `MRP ₹1999\nOffer Price ₹399` → reject.
7. **Nearest-MRP:** `MRP ₹999 (other product)\n... long content ...\nMRP ₹1999\nOffer Price ₹1299` → pair uses `MRP 1999` (nearer), not `MRP 999`.
8. `additional_data.price` byte-identical across pair-accept and pair-reject vs. pre-8.1C baseline.

### `pricing_test.ts` (new)

9. Pair accepted, no conflict → `list_price=1999`, `sale_price=1299`, `price_source="firecrawl_markdown_list_sale"`, `price_confidence=0.72`, `price_display="₹1,299 (MRP ₹1,999)"`.
10. Pair + `priceConflict === true` → list/sale suppressed; Phase 8 conflict path preserved; 8.1A `price_display` untouched.
11. Pair + JSON-LD `list_price` present → Firecrawl pair ignored.
12. Pair + JSON-LD `selected_variant_price` present → Firecrawl pair ignored.
13. **Pair + JSON-LD `price_min`/`price_max` present (range) → Firecrawl pair ignored**; `price_source`, `price_confidence`, `price_display` unchanged from 8.1B range output.
14. Pair rejected upstream (`null`) → `additional_data.price` byte-identical, 8.1A `price_display` untouched.
15. Pair accepted but `formatPriceDisplay` returns null for one side (e.g., currency `"XYZ"`) → `price_display` falls back to pre-pair value; `list_price`/`sale_price`/`price_source`/`confidence` still set.
16. Schema serialization: `price_source: "firecrawl_markdown_list_sale"` round-trips through `schema.ts`.

## Invariants

- `additional_data.price` byte-identical to Phase 8 across every path.
- 8.1A `price_display` untouched on reject/suppress/format-failure.
- `price_conflict` semantics unchanged; conflict fully suppresses pair.
- JSON-LD always wins (selected, list, **or range**).
- Currency-only candidates never participate in list/sale pairing.
- Generic `Price` accepted only with explicit higher MRP/List Price candidate.
- Accepted pair `price_display` always renders both values when formattable.
- No changes to extractor, Gemini, Firecrawl single-price selection, UI, DB, V1, prompts.

## Out of scope

8.1D admin preview, metadata-only invented MRP, multi-currency markdown, Gemini MRP extraction, URL/SKU matching.
