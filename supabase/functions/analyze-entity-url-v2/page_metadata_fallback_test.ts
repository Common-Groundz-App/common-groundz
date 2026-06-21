// Phase 1.8c.6-A tests for page_metadata_fallback.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPageMetadataFallback } from "./page_metadata_fallback.ts";
import type { PageSignals } from "./extractor.ts";
import type { ExtractMetadata } from "./schema.ts";

const BASE = "https://example.com/p/abc";

function ps(over: Partial<PageSignals> = {}): PageSignals {
  return {
    title: null,
    og_title: null,
    og_description: null,
    og_site_name: null,
    og_image: null,
    twitter_title: null,
    twitter_description: null,
    canonical: null,
    jsonld_product_name: null,
    jsonld_brand: null,
    ...over,
  };
}

function meta(mapped: ExtractMetadata["mapped_type"]): ExtractMetadata {
  return {
    has_jsonld: false,
    jsonld_blocks: 0,
    has_og: true,
    has_twitter: false,
    sources: [],
    mapped_type: mapped,
    confidence: null,
    weak_signals: true,
  };
}

Deno.test("skips when mapped_type is null (never invents 'others')", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({ og_title: "Some Product", og_description: "Nice." }),
    extractMetadata: meta(null),
    baseUrl: BASE,
  });
  assertEquals(r.predictions, null);
  assertEquals(r.diagnostics.skip_reason, "type_unresolved");
  assertEquals(r.diagnostics.field_source.type, "none");
});

Deno.test("skips when no name signal present", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({ og_description: "desc" }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions, null);
  assertEquals(r.diagnostics.skip_reason, "missing_name");
});

Deno.test("skips when name present but no description and no image", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({ og_title: "Product" }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions, null);
  assertEquals(r.diagnostics.skip_reason, "missing_supporting_field");
});

Deno.test("builds prediction from og:title + og:description + og:image", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "Fancy Shoe",
      og_description: "Comfortable running shoe.",
      og_image: "https://cdn.example.com/img.jpg",
    }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions?.type, "product");
  assertEquals(r.predictions?.name, "Fancy Shoe");
  assertEquals(r.predictions?.description, "Comfortable running shoe.");
  assertEquals(r.predictions?.image_url, "https://cdn.example.com/img.jpg");
  assertEquals(r.predictions?.confidence, 0.3);
  assertEquals(r.predictions?.reasoning, "page_metadata_fallback");
  assertEquals(r.predictions?.tags, []);
  assertEquals(r.diagnostics.used, true);
  assertEquals(r.diagnostics.field_source.name, "og");
  assertEquals(r.diagnostics.field_source.description, "og");
  assertEquals(r.diagnostics.field_source.image_url, "og");
  assertEquals(r.diagnostics.field_source.type, "type_resolver");
});

Deno.test("name precedence: JSON-LD product name beats og:title", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      jsonld_product_name: "Real Product Name",
      og_title: "Generic Site Title",
      og_image: "https://cdn.example.com/img.jpg",
    }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions?.name, "Real Product Name");
  assertEquals(r.diagnostics.field_source.name, "jsonld");
});

Deno.test("description falls back to twitter when og missing", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "X",
      twitter_description: "twitter desc",
    }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions?.description, "twitter desc");
  assertEquals(r.diagnostics.field_source.description, "twitter");
});

Deno.test("relative og:image resolved against baseUrl", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "X",
      og_image: "/static/img.png",
      og_description: "d",
    }),
    extractMetadata: meta("product"),
    baseUrl: "https://shop.example.com/path",
  });
  assertEquals(r.predictions?.image_url, "https://shop.example.com/static/img.png");
});

Deno.test("rejects javascript:/data: image URLs and reports image_invalid when sole signal", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "X",
      og_image: "data:image/png;base64,AAAA",
    }),
    extractMetadata: meta("product"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions, null);
  assertEquals(r.diagnostics.skip_reason, "image_invalid");
  assertEquals(r.diagnostics.image_candidate_count, 1);
});

Deno.test("description-only (no image) still emits prediction", () => {
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "Book Title",
      og_description: "A great read.",
    }),
    extractMetadata: meta("book"),
    baseUrl: BASE,
  });
  assertEquals(r.predictions?.type, "book");
  assertEquals(r.predictions?.name, "Book Title");
  assertEquals(r.predictions?.image_url, null);
  assertEquals(r.predictions?.images, []);
});

Deno.test("never emits type: 'others' even when other fields are strong", () => {
  // Caller would never pass mapped_type='others' from the deterministic
  // resolver, but assert defensive behavior: the fallback faithfully passes
  // through whatever mapped_type the resolver produced — it does NOT
  // synthesize 'others' on its own.
  const r = buildPageMetadataFallback({
    pageSignals: ps({
      og_title: "Thing",
      og_description: "Desc",
      og_image: "https://cdn.example.com/i.jpg",
    }),
    extractMetadata: meta(null),
    baseUrl: BASE,
  });
  assertEquals(r.predictions, null);
  assertEquals(r.diagnostics.skip_reason, "type_unresolved");
});
