
# Phase 8.1C — test-only follow-ups from reviewer feedback

Production code is already correct for both reviewer points. Only the test file needs tightening.

## Findings vs. current code

**Codex #1 — strict hint enforcement:** Already done. `applyFirecrawlListSalePair` in `pricing.ts` returns `base` immediately unless `hint === "firecrawl_markdown"`. Since `base.price_source` is itself derived from the same hint, a JSON-LD / OG / Firecrawl-metadata / Gemini / unknown / null price can never be overwritten by the Firecrawl list/sale pair. One test exists (`hint=jsonld`); we'll add explicit coverage for the other hints.

**Codex #2 + ChatGPT — XYZ fallback test:** Real issue. `formatPriceDisplay(1999, "XYZ")` returns `"XYZ 1,999"` (valid ISO shape → fallback string). The current test asserts `assert(r.price_display)` which passes for the *wrong* reason. It does not exercise the "either side cannot format → keep pre-pair display" branch.

## Changes (tests only, `supabase/functions/analyze-entity-url-v2/pricing_test.ts`)

1. **Replace the misleading XYZ test** with two precise tests:
   - **a. Unsupported-but-valid code "XYZ" → both sides format via fallback:** assert `price_display === "XYZ 1,299 (MRP XYZ 1,999)"`, `list_price === 1999`, `sale_price === 1299`, `price_source === "firecrawl_markdown_list_sale"`.
   - **b. Genuine format failure → falls back to pre-pair display:** call `applyFirecrawlListSalePair` directly with a pair whose `sale_price` is `NaN` (or `-1`) so `formatPriceDisplay` returns `null` for the sale side. Assert `price_display` equals the original `base.price_display`, while `list_price`/`sale_price`/`price_source`/`price_confidence` are still set.

2. **Add explicit hint-gating tests** to lock the contract:
   - `hint="og"` + valid pair → pair ignored, `price_source` unchanged.
   - `hint="firecrawl_metadata"` + valid pair → pair ignored.
   - `hint="gemini"` + valid pair → pair ignored.
   - `hint=null` + valid pair → pair ignored.
   (We already cover `hint="jsonld"`.)

## Out of scope

No changes to `firecrawl_recovery.ts`, `pricing.ts` (production code), `merge.ts`, `index.ts`, `schema.ts`, prompts, DB, UI, or Gemini. Pure test hardening.

## Verification

Re-run the full Deno test suite — expect 284 → ~289 passing (replace 1 misleading test, add 4 new hint tests + 1 split format test).
