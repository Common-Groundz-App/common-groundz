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

// ─── 8.1B follow-up: price_display consistency ────────────────────────────

Deno.test("8.1B follow-up: range only → price_display shows en-dash range", () => {
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
  const lo = formatPriceDisplay(1000, "INR");
  const hi = formatPriceDisplay(1300, "INR");
  assertEquals(p.price_display, `${lo} \u2013 ${hi}`);
});

Deno.test("8.1B follow-up: selected only → price_display shows selected price", () => {
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 1250, currency: "INR", selected: true, default: false },
      ],
      aggregate: null,
    },
  });
  assertEquals(p.price_display, formatPriceDisplay(1250, "INR"));
});

Deno.test("8.1B follow-up: selected + range → price_display reflects selected (not range)", () => {
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
  assertEquals(p.price_display, formatPriceDisplay(1000, "INR"));
  // and not the range string
  assert(!String(p.price_display).includes("\u2013"));
});

Deno.test("8.1B follow-up: mixed-currency range_conflict leaves 8.1A price_display untouched", () => {
  const baseline = buildPricing({
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
  assertEquals(p.price_display, baseline.price_display);
});

Deno.test("8.1B follow-up: unsupported-but-present currency for range falls back to <CODE> amount", () => {
  // XYZ is ISO-shaped (3 letters) but not a real currency code; Intl falls back.
  const p = buildPricing({
    legacyPrice: 1000,
    currency: "XYZ",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "jsonld",
    offers: {
      offers: [
        { price: 999, currency: "XYZ", selected: false, default: false },
        { price: 1300, currency: "XYZ", selected: false, default: false },
      ],
      aggregate: null,
    },
  });
  const lo = formatPriceDisplay(999, "XYZ");
  const hi = formatPriceDisplay(1300, "XYZ");
  assert(lo && lo.includes("XYZ"));
  assertEquals(p.price_display, `${lo} \u2013 ${hi}`);
});

// ─── 8.1B follow-up: explicit legacy-price (additional_data.price) regression ───

Deno.test("8.1B follow-up: legacyPrice → sale_price echo invariant across all 8.1B branches", () => {
  const mkInput = (offers: any) => ({
    legacyPrice: 1000,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor" as const,
    priceSourceHint: "jsonld" as const,
    offers,
  });
  // selected only
  const sel = buildPricing(mkInput({
    offers: [{ price: 1250, currency: "INR", selected: true, default: false }],
    aggregate: null,
  }));
  assertEquals(sel.sale_price, 1000);

  // range only
  const rng = buildPricing(mkInput({
    offers: [
      { price: 1000, currency: "INR", selected: false, default: false },
      { price: 1300, currency: "INR", selected: false, default: false },
    ],
    aggregate: null,
  }));
  assertEquals(rng.sale_price, 1000);

  // mixed-currency conflict
  const mix = buildPricing(mkInput({
    offers: [
      { price: 1000, currency: "INR", selected: false, default: false },
      { price: 15, currency: "USD", selected: false, default: false },
    ],
    aggregate: null,
  }));
  assertEquals(mix.sale_price, 1000);
});

// ───── Phase 8.1C: Firecrawl markdown MRP/Sale overlay ─────
import { applyFirecrawlListSalePair } from "./pricing.ts";

const PAIR = {
  list_price: 1999,
  sale_price: 1299,
  currency: "INR" as string | null,
  source: "mrp_sale_labels" as const,
};

function basePricing(overrides: Partial<PricingBlock> = {}): PricingBlock {
  return {
    currency: "INR",
    list_price: null,
    sale_price: 1299,
    selected_variant_price: null,
    price_min: null,
    price_max: null,
    price_display: "₹1,299",
    price_source: "firecrawl_markdown_single",
    price_confidence: 0.65,
    price_conflict: false,
    range_conflict: false,
    ...overrides,
  };
}

Deno.test("8.1C: buildPricing applies pair when hint=firecrawl_markdown, no conflict", () => {
  const p = buildPricing({
    legacyPrice: 1299,
    currency: "INR",
    priceConflict: false,
    priceWinner: "extractor",
    priceSourceHint: "firecrawl_markdown",
    firecrawlListSalePair: PAIR,
  });
  assertEquals(p.list_price, 1999);
  assertEquals(p.sale_price, 1299);
  assertEquals(p.price_source, "firecrawl_markdown_list_sale");
  assertEquals(p.price_confidence, 0.72);
  assert(p.price_display && p.price_display.includes("MRP"), p.price_display ?? "");
  assert(p.price_display!.includes("1,999"));
  assert(p.price_display!.includes("1,299"));
});

Deno.test("8.1C: priceConflict suppresses pair entirely", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_conflict: true, sale_price: null, price_source: "omitted" }), PAIR, "firecrawl_markdown", true);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "omitted");
});

Deno.test("8.1C: JSON-LD list_price already set → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ list_price: 2500 }), PAIR, "firecrawl_markdown", false);
  assertEquals(r.list_price, 2500);
  assertEquals(r.price_source, "firecrawl_markdown_single");
});

Deno.test("8.1C: JSON-LD selected_variant_price set → pair ignored", () => {
  const r = applyFirecrawlListSalePair(
    basePricing({ selected_variant_price: 1599, price_source: "extractor_jsonld_offers_selected" }),
    PAIR, "firecrawl_markdown", false,
  );
  assertEquals(r.price_source, "extractor_jsonld_offers_selected");
  assertEquals(r.list_price, null);
});

Deno.test("8.1C: JSON-LD price_min/price_max range set → pair ignored", () => {
  const r = applyFirecrawlListSalePair(
    basePricing({ price_min: 1000, price_max: 1500, price_source: "extractor_jsonld_offers_merged_range" }),
    PAIR, "firecrawl_markdown", false,
  );
  assertEquals(r.price_source, "extractor_jsonld_offers_merged_range");
  assertEquals(r.list_price, null);
  assertEquals(r.price_min, 1000);
});

Deno.test("8.1C: hint=jsonld → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_source: "extractor_jsonld_offer" }), PAIR, "jsonld", false);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "extractor_jsonld_offer");
});

Deno.test("8.1C: hint=og → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_source: "extractor_meta_og" }), PAIR, "og", false);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "extractor_meta_og");
});

Deno.test("8.1C: hint=firecrawl_metadata → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_source: "firecrawl_metadata" }), PAIR, "firecrawl_metadata", false);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "firecrawl_metadata");
});

Deno.test("8.1C: hint=gemini → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_source: "gemini" }), PAIR, "gemini", false);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "gemini");
});

Deno.test("8.1C: hint=null → pair ignored", () => {
  const r = applyFirecrawlListSalePair(basePricing({ price_source: "unknown" }), PAIR, null, false);
  assertEquals(r.list_price, null);
  assertEquals(r.price_source, "unknown");
});

Deno.test("8.1C: pair null → block untouched", () => {
  const b = basePricing();
  const r = applyFirecrawlListSalePair(b, null, "firecrawl_markdown", false);
  assertEquals(r, b);
});

Deno.test("8.1C: unsupported-but-valid ISO code 'XYZ' → both sides format via fallback", () => {
  const b = basePricing({ currency: null, price_display: "1,299" });
  const r = applyFirecrawlListSalePair(
    b,
    { ...PAIR, currency: "XYZ" },
    "firecrawl_markdown",
    false,
  );
  assertEquals(r.list_price, 1999);
  assertEquals(r.sale_price, 1299);
  assertEquals(r.price_source, "firecrawl_markdown_list_sale");
  // formatPriceDisplay falls back to "<CODE> <amount>" for unknown ISO shape.
  // Use substring matching to tolerate NBSP vs space from Intl.NumberFormat.
  const d = r.price_display!;
  assert(d.includes("XYZ") && d.includes("1,299") && d.includes("MRP") && d.includes("1,999"), d);
});

Deno.test("8.1C: genuine format failure (NaN sale) → falls back to pre-pair display", () => {
  const b = basePricing({ price_display: "PREEXISTING" });
  const r = applyFirecrawlListSalePair(
    b,
    { list_price: 1999, sale_price: NaN, currency: "INR", source: "mrp_sale_labels" },
    "firecrawl_markdown",
    false,
  );
  // Pair fields still applied:
  assertEquals(r.list_price, 1999);
  assert(Number.isNaN(r.sale_price as number));
  assertEquals(r.price_source, "firecrawl_markdown_list_sale");
  assertEquals(r.price_confidence, 0.72);
  // But display falls back because sale side cannot format.
  assertEquals(r.price_display, "PREEXISTING");
});


Deno.test("8.1C: summarizePricing handles firecrawl_markdown_list_sale source", () => {
  const b = basePricing();
  const r = applyFirecrawlListSalePair(b, PAIR, "firecrawl_markdown", false);
  const s = summarizePricing(r);
  assertEquals(s.source, "firecrawl_markdown_list_sale");
  assertEquals(s.has_list_sale, true);
});
