// Phase 8.1A: pricing.ts unit tests (offline).

import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  applyOffersToPricing,
  buildPricing,
  formatPriceDisplay,
  isDeterministicHint,
  type PricingBlock,
  pricingBlockHasContent,
  resolvePriceSourceHint,
  summarizePricing,
} from "./pricing.ts";

// ─── resolvePriceSourceHint ───────────────────────────────────────────────

Deno.test("resolvePriceSourceHint: jsonld wins over og", () => {
  const h = resolvePriceSourceHint({
    extractSources: ["jsonld:Product", "og:image"],
  });
  assertEquals(h, "jsonld");
});

Deno.test("resolvePriceSourceHint: firecrawl recovery metadata overrides extract sources", () => {
  const h = resolvePriceSourceHint({
    extractSources: ["firecrawl:markdown:h1"],
    firecrawlRecoveryPriceSource: "metadata",
  });
  assertEquals(h, "firecrawl_metadata");
});

Deno.test("resolvePriceSourceHint: gemini-came-from-gemini short-circuits", () => {
  const h = resolvePriceSourceHint({
    extractSources: ["jsonld:Product"],
    priceCameFromGemini: true,
  });
  assertEquals(h, "gemini");
});

Deno.test("resolvePriceSourceHint: og only", () => {
  const h = resolvePriceSourceHint({ extractSources: ["og:type:product"] });
  assertEquals(h, "og");
});

Deno.test("resolvePriceSourceHint: nothing useful → null", () => {
  assertEquals(resolvePriceSourceHint({ extractSources: [] }), null);
  assertEquals(resolvePriceSourceHint({}), null);
});

// ─── formatPriceDisplay (fail-safe) ───────────────────────────────────────

Deno.test("formatPriceDisplay: INR formats", () => {
  const out = formatPriceDisplay(1499, "INR");
  assert(out && out.includes("1,499"), `got ${out}`);
});

Deno.test("formatPriceDisplay: null amount → null", () => {
  assertEquals(formatPriceDisplay(null, "USD"), null);
});

Deno.test("formatPriceDisplay: garbage never throws", () => {
  assertEquals(formatPriceDisplay(NaN, "USD"), null);
  assertEquals(formatPriceDisplay(-5, "USD"), null);
  // unknown currency code → fallback "<CODE> <amount>"
  const out = formatPriceDisplay(1500, "ZZZ");
  assert(out && out.startsWith("ZZZ"), `got ${out}`);
});

Deno.test("formatPriceDisplay: no currency → plain number", () => {
  assertEquals(formatPriceDisplay(1500, null), "1,500");
});

// ─── buildPricing ─────────────────────────────────────────────────────────

Deno.test("buildPricing: extractor jsonld → sale_price + 0.90 confidence", () => {
  const p = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
  });
  assertEquals(p.sale_price, 1499);
  assertEquals(p.currency, "INR");
  assertEquals(p.price_source, "extractor_jsonld_offer");
  assertEquals(p.price_confidence, 0.90);
  assertEquals(p.price_conflict, false);
  assert(p.price_display && p.price_display.includes("1,499"));
});

Deno.test("buildPricing: conflict → omitted + currency preserved + no sale_price", () => {
  const p = buildPricing({
    legacyPrice: undefined,
    currency: "INR",
    priceConflict: true,
    priceWinner: "none",
    priceSourceHint: null,
  });
  assertEquals(p.price_source, "omitted");
  assertEquals(p.price_conflict, true);
  assertEquals(p.currency, "INR");
  assertEquals(p.sale_price, null);
  assertEquals(p.price_confidence, 0);
  assert(pricingBlockHasContent(p));
});

Deno.test("buildPricing: nothing at all → block has no content", () => {
  const p = buildPricing({
    legacyPrice: undefined,
    currency: null,
    priceConflict: false,
    priceWinner: "none",
    priceSourceHint: null,
  });
  assertEquals(pricingBlockHasContent(p), false);
});

Deno.test("buildPricing: gemini won → source=gemini, capped at 0.70", () => {
  const p = buildPricing({
    legacyPrice: 99,
    currency: "USD",
    priceConflict: false,
    priceWinner: "gemini",
    priceSourceHint: "gemini",
    geminiPrice: 99,
    geminiPriceConfidence: 0.95,
  });
  assertEquals(p.price_source, "gemini");
  assertEquals(p.price_confidence, 0.70);
});

Deno.test("buildPricing: ambiguous hint → unknown / 0.50", () => {
  const p = buildPricing({
    legacyPrice: 50,
    currency: "USD",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: null,
  });
  assertEquals(p.price_source, "unknown");
  assertEquals(p.price_confidence, 0.50);
});

Deno.test("buildPricing: gemini observed price recorded when extractor won and they differ", () => {
  const p = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    geminiPrice: 1799,
    geminiPriceConfidence: 0.9,
  });
  assertEquals(p.gemini_observed_price, 1799);
  assertEquals(p.sale_price, 1499); // legacy untouched
  assertEquals(p.price_source, "extractor_jsonld_offer");
});

Deno.test("buildPricing: low-confidence gemini disagreement not recorded", () => {
  const p = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    geminiPrice: 1799,
    geminiPriceConfidence: 0.5,
  });
  assertEquals(p.gemini_observed_price, undefined);
});

// ─── summarizePricing ─────────────────────────────────────────────────────

Deno.test("summarizePricing: gemini_diagnostic_only when extractor won and gemini observed", () => {
  const p = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    geminiPrice: 1799,
    geminiPriceConfidence: 0.9,
  });
  const m = summarizePricing(p, "exact");
  assertEquals(m.gemini_diagnostic_only, true);
  assertEquals(m.source, "extractor_jsonld_offer");
  assertEquals(m.has_range, false);
  assertEquals(m.has_list_sale, false);
  assertEquals(m.price_source_used, "exact");
});

// ─── Phase 8.1B: Offer[] / AggregateOffer overlay ─────────────────────────



Deno.test("8.1B isDeterministicHint", () => {
  assertEquals(isDeterministicHint("jsonld"), true);
  assertEquals(isDeterministicHint("og"), true);
  assertEquals(isDeterministicHint("firecrawl_metadata"), true);
  assertEquals(isDeterministicHint("firecrawl_markdown"), true);
  assertEquals(isDeterministicHint("gemini"), false);
  assertEquals(isDeterministicHint("unknown"), false);
  assertEquals(isDeterministicHint(null), false);
});

Deno.test("8.1B AggregateOffer happy path", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [],
      aggregate: { low: 1000, high: 1400, currency: "INR" },
    },
  });
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1400);
  assertEquals(p.price_source, "extractor_jsonld_aggregate");
  assertEquals(p.price_confidence, 0.95);
  assertEquals(p.sale_price, 1000); // 8.1A preserved
});

Deno.test("8.1B AggregateOffer ratio > 1.5 → no range, no conflict", () => {
  const p = buildPricing({
    legacyPrice: 100,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [],
      aggregate: { low: 100, high: 500, currency: "INR" },
    },
  });
  assertEquals(p.price_min, null);
  assertEquals(p.price_max, null);
  assertEquals(p.range_conflict, false);
  assertEquals(p.price_source, "extractor_jsonld_offer"); // 8.1A untouched
});

Deno.test("8.1B Offer[] same currency emits range", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: false, default: false },
        { price: 1300, currency: "INR", selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1300);
  assertEquals(p.price_source, "extractor_jsonld_offers_merged_range");
  assertEquals(p.price_confidence, 0.90);
});

Deno.test("8.1B Offer[] mixed currency → range_conflict only, 8.1A untouched", () => {
  const base = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
  });
  const p = buildPricing({
    legacyPrice: 1499,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: false, default: false },
        { price: 15, currency: "USD", selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.range_conflict, true);
  assertEquals(p.price_min, null);
  assertEquals(p.price_max, null);
  // 8.1A fields byte-identical to baseline
  assertEquals(p.sale_price, base.sale_price);
  assertEquals(p.price_source, base.price_source);
  assertEquals(p.price_confidence, base.price_confidence);
  assertEquals(p.currency, base.currency);
  assertEquals(p.price_display, base.price_display);
  assertEquals(p.price_conflict, false); // distinct from range_conflict
  // metadata mirrors
  const m = summarizePricing(p);
  assertEquals(m.range_conflict, true);
  assertEquals(m.conflict, true);
});

Deno.test("8.1B Offer[] partial-null currencies adopt deterministic Phase 8 currency", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld", // deterministic
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: false, default: false },
        { price: 1300, currency: null, selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1300);
});

Deno.test("8.1B partial-null + mismatched Phase 8 currency → no range, no conflict", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "USD",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: false, default: false },
        { price: 1300, currency: null, selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_min, null);
  assertEquals(p.range_conflict, false);
});

Deno.test("8.1B all-null currencies + gemini hint → no range", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "gemini",
    priceSourceHint: "gemini",
    geminiPriceConfidence: 0.9,
    offers: {
      offers: [
        { price: 1000, currency: null, selected: false, default: false },
        { price: 1300, currency: null, selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_min, null);
  assertEquals(p.range_conflict, false);
});

Deno.test("8.1B all-null currencies + deterministic Phase 8 → adopts", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "firecrawl_metadata",
    offers: {
      offers: [
        { price: 1000, currency: null, selected: false, default: false },
        { price: 1300, currency: null, selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1300);
});

Deno.test("8.1B selected variant only", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: true, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.selected_variant_price, 1000);
  assertEquals(p.price_source, "extractor_jsonld_offers_selected");
  assertEquals(p.price_confidence, 0.92);
});

Deno.test("8.1B selected variant + range both populated", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: true, default: false },
        { price: 1300, currency: "INR", selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.selected_variant_price, 1000);
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1300);
  assertEquals(p.price_source, "extractor_jsonld_offers_selected");
  const m = summarizePricing(p);
  assertEquals(m.has_range, true);
});

Deno.test("8.1B multiple selected → selected_variant_price null", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1000, currency: "INR", selected: true, default: false },
        { price: 1300, currency: "INR", selected: true, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.selected_variant_price, null);
  // range still emits
  assertEquals(p.price_min, 1000);
  assertEquals(p.price_max, 1300);
});

Deno.test("8.1B applyOffersToPricing is pure (no input mutation)", () => {
  const base: PricingBlock = {
    currency: "INR",
    list_price: null,
    sale_price: 1000,
    selected_variant_price: null,
    price_min: null,
    price_max: null,
    price_display: "₹1,000",
    price_source: "extractor_jsonld_offer",
    price_confidence: 0.9,
    price_conflict: false,
    range_conflict: false,
  };
  const snapshot = JSON.stringify(base);
  applyOffersToPricing(base, {
    offers: [
      { price: 1000, currency: "INR", selected: false, default: false },
      { price: 1300, currency: "INR", selected: false, default: false },
    ],
    aggregate: null,
  }, true);
  assertEquals(JSON.stringify(base), snapshot);
});
