// Phase 8: merge.ts unit tests (offline).

import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  mergePredictions,
  passesRecoveryGate,
  geminiToV2Predictions,
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

Deno.test("geminiToV2Predictions price gate honored", () => {
  const gem = makeGemini({ field_confidence: { price: 0.4 } });
  const p = geminiToV2Predictions(gem, noFlags);
  assertEquals(p.additional_data.price, undefined);
});
