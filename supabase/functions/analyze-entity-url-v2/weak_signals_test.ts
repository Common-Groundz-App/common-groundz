import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { detectWeakSignals } from "./weak_signals.ts";
import type { ExtractResult, V2Predictions } from "./extractor.ts";

function strong(overrides: Partial<V2Predictions> = {}): ExtractResult {
  return {
    predictions: {
      type: "product",
      name: "X",
      description: "desc",
      category_id: null,
      suggested_category_path: "Product",
      matched_category_name: null,
      tags: [],
      confidence: 0.9,
      reasoning: "test",
      image_url: "https://example.com/i.jpg",
      images: [{ url: "https://example.com/i.jpg" }],
      additional_data: { brand: "ACME", price: 10 },
      ...overrides,
    },
    metadata: {
      has_jsonld: true,
      jsonld_blocks: 1,
      has_og: true,
      has_twitter: false,
      sources: ["jsonld:Product"],
      mapped_type: "product",
      confidence: 0.9,
      weak_signals: false,
    },
    warnings: [],
  };
}

Deno.test("predictions === null is weak", () => {
  const r: ExtractResult = {
    predictions: null,
    metadata: {
      has_jsonld: false,
      jsonld_blocks: 0,
      has_og: false,
      has_twitter: false,
      sources: [],
      mapped_type: null,
      confidence: null,
      weak_signals: true,
    },
    warnings: ["weak_signals"],
  };
  const ws = detectWeakSignals(r);
  assertEquals(ws.weak, true);
});

Deno.test("weak_signals flag is weak", () => {
  const r = strong();
  r.metadata.weak_signals = true;
  assertEquals(detectWeakSignals(r).weak, true);
});

Deno.test("strong product is not weak", () => {
  assertEquals(detectWeakSignals(strong()).weak, false);
});

Deno.test("Phase 6: product missing image_url alone is NOT weak (criticalFieldsMissing deferred)", () => {
  const r = strong({ image_url: null, images: [] });
  assertEquals(detectWeakSignals(r).weak, false);
});

Deno.test("Phase 6: movie missing description alone is NOT weak", () => {
  const r = strong({ type: "movie", description: null });
  assertEquals(detectWeakSignals(r).weak, false);
});

Deno.test("Phase 6: product missing brand alone is NOT weak", () => {
  const r = strong({ additional_data: {} });
  assertEquals(detectWeakSignals(r).weak, false);
});
