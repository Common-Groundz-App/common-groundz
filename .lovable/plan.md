
# Phase 8.1D — Admin preview UI for `additional_data.pricing` (revised)

Frontend-only. Renders the Phase 8.1A/B/C pricing block in `AutoFillPreviewModal` so admins can read it instead of seeing `[object Object]`. Backend, DB, schema, prompts, extractor, V1, Gemini, and save flow are untouched.

## Scope (only)

File: `src/components/admin/AutoFillPreviewModal.tsx`

1. **Filter `pricing` out of the generic Additional Data loop** — `Object.entries(pred.additional_data).filter(([k]) => k !== 'pricing')`. Legacy `price`, `currency`, `brand`, etc. continue to render unchanged.
2. **Add a `PricingPreview` sub-component** in the same file (outside the main component) and render it above the generic Additional Data block when `pred.additional_data?.pricing` is a non-null object. When pricing is missing/null, nothing renders (no empty card).

## `PricingPreview` contract

Reads `pricing = pred.additional_data.pricing` (typed loosely as `any`).

### Headline — deterministic fallback chain

In order, first non-null wins:

1. `pricing.price_display` (trust backend's formatted string)
2. `fmt(pricing.selected_variant_price, pricing.currency)`
3. `pricing.price_min` and `pricing.price_max` both present → `"<min> – <max>"` via `fmt`
4. `fmt(pricing.sale_price, pricing.currency)`
5. If `pricing.price_conflict === true` → muted text `"Price omitted — conflicting sources"`
6. Muted `"—"`

Rendered large, font-medium.

### Secondary rows (each rendered only when its inputs are present)

- **Pair row** — only when *both* `list_price` and `sale_price` are finite numbers: `"List <list>  •  Sale <sale>"` via `fmt`.
- **Range row** — only when both `price_min` and `price_max` are finite numbers *and* `price_min !== price_max`: `"<min> – <max>"`.
- **Selected variant** — when `selected_variant_price` is a finite number: `"Selected variant: <price>"`.
- **Source badge** — `<Badge variant="secondary">` showing humanized `price_source` from `SOURCE_LABELS` map (unmapped → raw key). Adjacent muted text shows `Math.round(price_confidence*100)%` when `price_confidence` is a finite number.
- **Conflict alerts** (`<Alert variant="destructive">`):
  - `price_conflict` → "Price conflict — `additional_data.price` omitted."
  - `range_conflict` → "Mixed-currency offers — no public range."
- **Gemini diagnostic row** — only when `gemini_observed_price` is a finite number *and* it differs from the **primary numeric** price (see below). Renders muted: `"Gemini observed: <currency-or-''> <price>"`. Never styled as authoritative.

### Primary numeric (for Gemini comparison only)

First non-null wins:

1. `selected_variant_price` (if finite number)
2. `sale_price` (if finite number)
3. `price_min` (if finite number) **only when** `price_min === price_max`
4. Otherwise `null` → if `gemini_observed_price` is present, show the diagnostic row (nothing to compare against).

Compare strictly numerically. Never compare against `price_display` (which may be a range or pair string).

### Source label map

```ts
const SOURCE_LABELS: Record<string, string> = {
  extractor_jsonld_offer: "JSON-LD Offer",
  extractor_jsonld_aggregate: "JSON-LD AggregateOffer",
  extractor_jsonld_offers_merged_range: "JSON-LD Offers (range)",
  extractor_jsonld_offers_selected: "JSON-LD Offer (selected variant)",
  extractor_meta_og: "OpenGraph",
  firecrawl_metadata: "Firecrawl metadata",
  firecrawl_markdown_single: "Firecrawl markdown",
  firecrawl_markdown_list_sale: "Firecrawl markdown (MRP/Sale)",
  gemini: "Gemini",
  unknown: "Unknown",
  omitted: "Omitted",
};
```

### Defensive `fmt` helper (local)

```ts
const fmt = (amount: unknown, currency: unknown): string | null => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  if (typeof currency !== "string" || !currency.trim()) {
    return amount.toLocaleString();
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};
```

Returns `null` on non-finite / non-number amounts; gracefully degrades on unsupported currency codes.

## Invariants

- Only `AutoFillPreviewModal.tsx` is touched.
- No imports from `supabase/functions/...`.
- No new dependencies.
- No edits to legacy `additional_data.price` rendering — `price` still flows through the generic loop.
- `pricing` never renders as `[object Object]`.
- No empty pricing card when `pricing` is missing/null.

## Out of scope

`pricing.ts`, `merge.ts`, `firecrawl_recovery.ts`, `index.ts`, `schema.ts`, extractor, Gemini prompts, DB, V1, `CreateEntityDialog.tsx`, backend tests, save flow.

## Verification

Manual checks against four fixture predictions:

a) **Clean single price** — `price_display: "₹1,499"`, `sale_price: 1499`, `price_source: "extractor_jsonld_offer"`. Headline shows `₹1,499`, source badge "JSON-LD Offer", no pair/range/alerts.

b) **Nykaa-style omitted/conflict** — `price_source: "omitted"`, `price_conflict: true`, `currency: "INR"`, no prices. Headline shows `"Price omitted — conflicting sources"`, destructive alert visible, source badge "Omitted".

c) **Firecrawl MRP/Sale** — `price_display: "₹1,299 (MRP ₹1,999)"`, `list_price: 1999`, `sale_price: 1299`, `price_source: "firecrawl_markdown_list_sale"`. Headline shows pair display, pair row "List ₹1,999 • Sale ₹1,299", source badge "Firecrawl markdown (MRP/Sale)".

d) **JSON-LD range** — `price_min: 999`, `price_max: 1499`, `price_source: "extractor_jsonld_offers_merged_range"`. Headline falls back to range, range row visible.

Confirm: no `[object Object]`; legacy `price` still renders in generic Additional Data; `gemini_observed_price` row only shows when it numerically differs from primary numeric.
