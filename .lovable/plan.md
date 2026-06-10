
# Phase 8.1B follow-up — `price_display` consistency + regression guard

Small additive backend-only fix. Incorporates Codex's two notes.

## Problem

`applyOffersToPricing` adds `price_min`/`price_max`/`selected_variant_price` but leaves `price_display` set from 8.1A's `sale_price`. Result hides the range from any downstream consumer (e.g. future 8.1D admin preview):

```
sale_price: 1499, price_min: 999, price_max: 1499, price_display: "₹1,499"
```

## Rule

`price_display` is recomputed inside `applyOffersToPricing` *after* the precedence table runs:

1. `selected_variant_price` set → format that price via `formatPriceDisplay(selected, currency)`.
2. Else both `price_min` and `price_max` set → render `"<low> – <high>"` (en-dash `\u2013`, space-padded) using `formatPriceDisplay` on each side with the resolved `currency`.
3. Else → leave 8.1A `price_display` untouched.
4. Mixed-currency `range_conflict` STOP branch → leave 8.1A `price_display` untouched (already the case).

Invariants preserved: `additional_data.price`, `sale_price`, `price_source`, `price_confidence`, `price_conflict`, `range_conflict`, `currency` unchanged by this fix. No schema change.

## Files

- **`pricing.ts`** — Inside `applyOffersToPricing`, recompute `price_display` per the rule in the `selected+range`, `selected only`, and `range only` return branches. Pure function (no input mutation).

## Tests (additions to `pricing_test.ts`)

- Selected variant only → `price_display` matches `formatPriceDisplay(selected, currency)`.
- Range only → `price_display` equals `"<formatted low> – <formatted high>"` with en-dash.
- Selected + range both present → `price_display` reflects selected price (not range).
- Mixed-currency `range_conflict` → `price_display` byte-equal to 8.1A baseline.
- **Unsupported-but-present currency for range** (Codex note 1): use ISO-shaped code `"XYZ"` that `Intl.NumberFormat` can't resolve a symbol for → assert fallback `"XYZ 999 – XYZ 1,499"` (mirrors existing `formatPriceDisplay` fallback). Do not test `currency: null` here — null currency cannot produce a public range under our adoption rules.

## Regression test (Codex note 2) — `pricing_test.ts`

- Single explicit test asserting Phase 8 `additional_data.price` invariant: for the same `BuildPricingInput`, the value passed in as `legacyPrice` is not transformed by `buildPricing` regardless of which 8.1B branch runs (selected only, range only, mixed-currency conflict). Verified by asserting `sale_price === input.legacyPrice` (when no `price_conflict`) across all three branches — this is the contract `index.ts` relies on when writing `additional_data.price`.

## Verification

- Full Deno suite green (currently 258; +~6 new).
- All existing 8.1A and 8.1B tests unchanged.

## Out of scope

- 8.1C (Firecrawl MRP/Sale), 8.1D (admin preview), DB, UI, V1, prompts, extractor, Gemini.
