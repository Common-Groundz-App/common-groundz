// Phase 8.1A: pricing.ts unit tests (offline).

import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildPricing,
  formatPriceDisplay,
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
  assert(out && out.startsWith("ZZZ "), `got ${out}`);
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
