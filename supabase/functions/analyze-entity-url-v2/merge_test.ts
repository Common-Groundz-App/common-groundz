// Phase 8: merge.ts unit tests (offline).

import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  mergePredictions,
  passesRecoveryGate,
  geminiToV2Predictions,
  geminiPriceTrusted,
} from "./merge.ts";
import type { V2Predictions } from "./schema.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";

function makeExtract(over: Partial<V2Predictions> = {}): V2Predictions {
  return {
    type: "product",
    name: "Acme Widget",
    description: "A solid widget for everyday use that does many things well.",
    category_id: null,
    suggested_category_path: "Product",
    matched_category_name: null,
    tags: ["widget"],
    confidence: 0.8,
    reasoning: "ext",
    image_url: "https://example.com/a.jpg",
    images: [{ url: "https://example.com/a.jpg" }],
    additional_data: {},
    ...over,
  };
}

function makeGemini(over: Partial<GeminiRawPrediction> = {}): GeminiRawPrediction {
  return {
    type: "product",
    name: "Acme Widget Pro",
    description: "Detailed enriched description from grounding sources, with concrete features.",
    tags: ["widget", "tool"],
    confidence: 0.85,
    reasoning: "gem",
    image_url: "https://example.com/b.jpg",
    images: [{ url: "https://example.com/b.jpg" }],
    additional_data: { brand: "Acme", price: 99, currency: "USD" },
    field_confidence: { name: 0.9, description: 0.9, price: 0.9, brand: 0.9 },
    ...over,
  };
}

const noFlags = { priceConflict: false, firecrawlCurrency: null, firecrawlImageUrl: null };

Deno.test("success path: extractor wins for name/image; gemini fills brand/desc", () => {
  const { predictions, diagnostics } = mergePredictions({
    extract: makeExtract(),
    gemini: makeGemini(),
    flags: noFlags,
  });
  assert(predictions);
  assertEquals(predictions!.name, "Acme Widget");
  assertEquals(predictions!.image_url, "https://example.com/a.jpg");
  assertEquals(predictions!.additional_data.brand, "Acme");
  assertEquals(diagnostics.field_winners.name, "extractor");
  assertEquals(diagnostics.field_winners.brand, "gemini");
  assertEquals(diagnostics.field_winners.description, "gemini");
  assertEquals(diagnostics.path, "success");
  assertEquals(diagnostics.name_junk_override_applied, false);
});

Deno.test("junk-name override: extractor name junky + gemini conf high → gemini wins", () => {
  const ext = makeExtract({ name: "Buy Acme Widget Online" });
  const gem = makeGemini({ name: "Acme Widget", field_confidence: { name: 0.95 } });
  const { predictions, diagnostics } = mergePredictions({ extract: ext, gemini: gem, flags: noFlags });
  assertEquals(predictions!.name, "Acme Widget");
  assertEquals(diagnostics.name_junk_override_applied, true);
  assertEquals(diagnostics.field_winners.name, "gemini");
});

Deno.test("junk-name override blocked when gemini name confidence < 0.7", () => {
  const ext = makeExtract({ name: "Buy Acme Widget Online" });
  const gem = makeGemini({ name: "Real Name", field_confidence: { name: 0.5 } });
  const { predictions, diagnostics } = mergePredictions({ extract: ext, gemini: gem, flags: noFlags });
  assertEquals(predictions!.name, "Buy Acme Widget Online");
  assertEquals(diagnostics.name_junk_override_applied, false);
});

Deno.test("priceConflict blocks gemini price on success path", () => {
  const ext = makeExtract({ additional_data: {} });
  const { predictions, diagnostics } = mergePredictions({
    extract: ext,
    gemini: makeGemini(),
    flags: { priceConflict: true, firecrawlCurrency: "INR", firecrawlImageUrl: null },
  });
  assertEquals(predictions!.additional_data.price, undefined);
  assertEquals(predictions!.additional_data.currency, "INR");
  assertEquals(diagnostics.price_conflict_blocked_gemini, true);
});

Deno.test("gemini price requires field_confidence.price >= 0.7", () => {
  const gem = makeGemini({
    additional_data: { price: 50, currency: "USD" },
    field_confidence: { price: 0.5 },
  });
  const { predictions } = mergePredictions({ extract: makeExtract(), gemini: gem, flags: noFlags });
  assertEquals(predictions!.additional_data.price, undefined);
});

Deno.test("tags merged when both contribute", () => {
  const { diagnostics } = mergePredictions({
    extract: makeExtract({ tags: ["a"] }),
    gemini: makeGemini({ tags: ["b"] }),
    flags: noFlags,
  });
  assertEquals(diagnostics.field_winners.tags, "merged");
});

Deno.test("returned predictions is a fresh object (no input mutation)", () => {
  const ext = makeExtract();
  const snapshot = JSON.stringify(ext);
  const { predictions } = mergePredictions({ extract: ext, gemini: makeGemini(), flags: noFlags });
  predictions!.additional_data.foo = "bar";
  predictions!.tags.push("z");
  predictions!.category_id = "abc";
  assertEquals(JSON.stringify(ext), snapshot);
});

Deno.test("brand never sourced from sources array (only additional_data.brand)", () => {
  const ext = makeExtract();
  const gem = makeGemini({ additional_data: { brand: undefined as unknown as null } });
  const { predictions, diagnostics } = mergePredictions({ extract: ext, gemini: gem, flags: noFlags });
  assertEquals(predictions!.additional_data.brand, undefined);
  assertEquals(diagnostics.field_winners.brand, "none");
});

Deno.test("description rejected when contains < (junk HTML)", () => {
  const gem = makeGemini({ description: "<p>Buy now <script>alert()</script></p>".padEnd(60, "x") });
  const { predictions } = mergePredictions({ extract: makeExtract({ description: "Original desc that is long enough for validation." }), gemini: gem, flags: noFlags });
  assertEquals(predictions!.description, "Original desc that is long enough for validation.");
});

Deno.test("recovery gate accepts strong gemini and recovery path returns predictions", () => {
  const gem = makeGemini();
  assert(passesRecoveryGate(gem));
  const { predictions, diagnostics } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: { priceConflict: false, firecrawlCurrency: "USD", firecrawlImageUrl: null },
  });
  assert(predictions);
  assertEquals(diagnostics.path, "recovery");
  assertEquals(diagnostics.recovery_gate_passed, true);
  assertEquals(diagnostics.gemini_used, true);
  assert(diagnostics.gemini_fields_used >= 2);
});

Deno.test("recovery gate rejects weak gemini", () => {
  const gem = makeGemini({ confidence: 0.3 });
  assertEquals(passesRecoveryGate(gem), false);
  const { predictions, diagnostics } = mergePredictions({ extract: null, gemini: gem, flags: noFlags });
  assertEquals(predictions, null);
  assertEquals(diagnostics.recovery_gate_passed, false);
});

Deno.test("recovery: firecrawl image preferred over gemini image", () => {
  const gem = makeGemini({ image_url: "https://example.com/gem.jpg" });
  const { predictions, diagnostics } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: { priceConflict: false, firecrawlCurrency: null, firecrawlImageUrl: "https://example.com/fc.jpg" },
  });
  assertEquals(predictions!.image_url, "https://example.com/fc.jpg");
  assertEquals(diagnostics.field_winners.image_url, "firecrawl");
});

Deno.test("recovery: firecrawl currency preserved when gemini lacks one", () => {
  const gem = makeGemini({ additional_data: { brand: "Acme" } });
  const { predictions, diagnostics } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: { priceConflict: false, firecrawlCurrency: "INR", firecrawlImageUrl: null },
  });
  assertEquals(predictions!.additional_data.currency, "INR");
  assertEquals(diagnostics.field_winners.currency, "firecrawl");
});

Deno.test("recovery: priceConflict blocks gemini price", () => {
  const gem = makeGemini({
    additional_data: { brand: "Acme", price: 99 },  // no currency from gemini
  });
  const { predictions, diagnostics } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: { priceConflict: true, firecrawlCurrency: "INR", firecrawlImageUrl: null },
  });
  assertEquals(predictions!.additional_data.price, undefined);
  assertEquals(predictions!.additional_data.currency, "INR");
  assertEquals(diagnostics.price_conflict_blocked_gemini, true);
});

Deno.test("geminiToV2Predictions is policy-free: never writes price (even high confidence)", () => {
  // High confidence + no conflict — converter STILL must omit price.
  const gem = makeGemini({ field_confidence: { price: 0.95 } });
  const p = geminiToV2Predictions(gem, noFlags);
  assertEquals(p.additional_data.price, undefined);
  // Brand and currency still copied through.
  assertEquals(p.additional_data.brand, "Acme");
  assertEquals(p.additional_data.currency, "USD");
});

Deno.test("geminiToV2Predictions omits price under low confidence too", () => {
  const gem = makeGemini({ field_confidence: { price: 0.4 } });
  const p = geminiToV2Predictions(gem, noFlags);
  assertEquals(p.additional_data.price, undefined);
});

Deno.test("geminiPriceTrusted: true only when no conflict + finite price + conf >= 0.7", () => {
  const gem = makeGemini();
  assertEquals(geminiPriceTrusted(gem, noFlags), true);
  assertEquals(
    geminiPriceTrusted(gem, { ...noFlags, priceConflict: true }),
    false,
  );
  assertEquals(
    geminiPriceTrusted(makeGemini({ field_confidence: { price: 0.5 } }), noFlags),
    false,
  );
  assertEquals(
    geminiPriceTrusted(
      makeGemini({ additional_data: { brand: "Acme", currency: "USD" } }),
      noFlags,
    ),
    false,
  );
  assertEquals(geminiPriceTrusted(null, noFlags), false);
});

Deno.test("recovery merge writes Gemini price when confidence >= 0.7 and no conflict", () => {
  const gem = makeGemini(); // price 99, conf 0.9
  const { predictions } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: noFlags,
  });
  assertEquals(predictions!.additional_data.price, 99);
});

Deno.test("recovery merge blocks Gemini price when confidence < 0.7", () => {
  const gem = makeGemini({ field_confidence: { price: 0.5 } });
  const { predictions } = mergePredictions({
    extract: null,
    gemini: gem,
    flags: noFlags,
  });
  assertEquals(predictions!.additional_data.price, undefined);
});

// ─── Phase 8.1A regression: additional_data.price never altered ───────────

Deno.test("8.1A: success path attaches pricing block without touching legacy price", () => {
  const ext = makeExtract({ additional_data: { price: 1499, currency: "INR" } });
  const { predictions, diagnostics } = mergePredictions({
    extract: ext,
    gemini: makeGemini({ additional_data: { price: 1799, currency: "INR" }, field_confidence: { price: 0.9 } }),
    flags: { ...noFlags, priceSourceHint: "jsonld" },
  });
  // Invariant #1: legacy price unchanged.
  assertEquals(predictions!.additional_data.price, 1499);
  // Pricing block attached.
  const pricing = predictions!.additional_data.pricing as Record<string, unknown> | undefined;
  assert(pricing);
  assertEquals(pricing!.sale_price, 1499);
  assertEquals(pricing!.price_source, "extractor_jsonld_offer");
  assertEquals(pricing!.gemini_observed_price, 1799);
  // Diagnostic honesty signal.
  assertEquals(diagnostics.price_source_used, "exact");
});

Deno.test("8.1A: priceConflict → no legacy price, pricing block attached as omitted+conflict", () => {
  const ext = makeExtract({ additional_data: { price: 1499, currency: "INR" } });
  const { predictions } = mergePredictions({
    extract: ext,
    gemini: makeGemini({ additional_data: { price: 9999, currency: "INR" } }),
    flags: { ...noFlags, priceConflict: true, priceSourceHint: "jsonld" },
  });
  // Phase 8 invariant: conflict drops legacy price.
  assertEquals(predictions!.additional_data.price, undefined);
  const pricing = predictions!.additional_data.pricing as Record<string, unknown>;
  assert(pricing);
  assertEquals(pricing.price_source, "omitted");
  assertEquals(pricing.price_conflict, true);
  assertEquals(pricing.currency, "INR");
  assertEquals(pricing.sale_price, null);
});

Deno.test("8.1A: ambiguous hint → unknown source, price_source_used=inferred", () => {
  const ext = makeExtract({ additional_data: { price: 50, currency: "USD" } });
  const { predictions, diagnostics } = mergePredictions({
    extract: ext,
    gemini: null,
    flags: noFlags, // no priceSourceHint
  });
  assertEquals(predictions!.additional_data.price, 50);
  const pricing = predictions!.additional_data.pricing as Record<string, unknown>;
  assertEquals(pricing.price_source, "unknown");
  assertEquals(diagnostics.price_source_used, "inferred");
});

Deno.test("8.1A: no price and no currency → pricing block not attached", () => {
  const ext = makeExtract({ additional_data: {} });
  const { predictions } = mergePredictions({ extract: ext, gemini: null, flags: noFlags });
  assertEquals(predictions!.additional_data.pricing, undefined);
});

Deno.test("8.1A: Nykaa-class recovery (currency+conflict, no price) attaches omitted pricing", () => {
  // recovery: extract null, gemini fails confidence, conflict true, firecrawl currency known
  const { predictions } = mergePredictions({
    extract: null,
    gemini: makeGemini({
      additional_data: { brand: "X", price: 9999 },
      field_confidence: { price: 0.4 }, // gated out
    }),
    flags: {
      priceConflict: true,
      firecrawlCurrency: "INR",
      firecrawlImageUrl: null,
    },
  });
  assert(predictions);
  assertEquals(predictions!.additional_data.price, undefined);
  const pricing = predictions!.additional_data.pricing as Record<string, unknown>;
  assert(pricing);
  assertEquals(pricing.price_source, "omitted");
  assertEquals(pricing.price_conflict, true);
  assertEquals(pricing.currency, "INR");
});

Deno.test("8.1A: recovery with trusted Gemini price → source=gemini, legacy price set by Phase 8", () => {
  const { predictions } = mergePredictions({
    extract: null,
    gemini: makeGemini({
      additional_data: { brand: "X", price: 99, currency: "USD" },
      field_confidence: { price: 0.9 },
    }),
    flags: noFlags,
  });
  assertEquals(predictions!.additional_data.price, 99); // Phase 8 behavior unchanged
  const pricing = predictions!.additional_data.pricing as Record<string, unknown>;
  assertEquals(pricing.price_source, "gemini");
  assertEquals(pricing.sale_price, 99);
});
