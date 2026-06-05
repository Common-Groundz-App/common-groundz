// Phase 5 — extractor unit tests. No network.

import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EXACT_PAGE_EXTRACTABLE_TYPES,
  extractFromHtml,
  safeAbsoluteUrl,
} from "./extractor.ts";
import { CANONICAL_ENTITY_TYPES } from "../_shared/entityTypes.ts";

const BASE = "https://example.com/page";

function jsonLdHtml(obj: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;
}

// ─── Taxonomy invariants ───────────────────────────────────────────────────

Deno.test("taxonomy: canonical has 15 types", () => {
  assertEquals(CANONICAL_ENTITY_TYPES.length, 15);
});

Deno.test("taxonomy: Phase-5 subset has exactly 9 types", () => {
  assertEquals(EXACT_PAGE_EXTRACTABLE_TYPES.length, 9);
  for (const t of EXACT_PAGE_EXTRACTABLE_TYPES) {
    assert((CANONICAL_ENTITY_TYPES as readonly string[]).includes(t), `${t} not canonical`);
  }
});

// ─── Structured-type happy paths ───────────────────────────────────────────

Deno.test("JSON-LD Product → product with brand text + rating", () => {
  const html = jsonLdHtml({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Acme Widget",
    description: "A widget",
    image: "https://cdn.example.com/w.jpg",
    brand: { "@type": "Brand", name: "Acme" },
    offers: { "@type": "Offer", price: "19.99", priceCurrency: "USD", availability: "InStock" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: 4.5, ratingCount: 120 },
    sku: "ACM-1",
  });
  const r = extractFromHtml(html, BASE);
  assert(r.predictions);
  assertEquals(r.predictions!.type, "product");
  assertEquals(r.predictions!.name, "Acme Widget");
  assertEquals(r.predictions!.suggested_category_path, "Product");
  assertEquals(r.predictions!.confidence, 0.9);
  assertEquals(r.predictions!.additional_data.brand, "Acme");
  assertEquals(r.predictions!.additional_data.price, 19.99);
  assertEquals(r.predictions!.additional_data.currency, "USD");
  assertEquals(r.predictions!.additional_data.rating, 4.5);
  assertEquals(r.predictions!.additional_data.rating_count, 120);
});

Deno.test("JSON-LD Movie → movie", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Movie", name: "Inception", datePublished: "2010-07-16" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "movie");
  assertEquals(r.predictions!.suggested_category_path, "Movie");
  assertEquals(r.predictions!.additional_data.release_date, "2010-07-16");
});

Deno.test("JSON-LD TVSeries → tv_show (raw PascalCase preserved)", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "TVSeries", name: "Breaking Bad" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "tv_show");
  assertEquals(r.predictions!.suggested_category_path, "TVSeries");
});

Deno.test("JSON-LD Recipe → food", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Recipe", name: "Pasta", recipeCuisine: "Italian", totalTime: "PT30M" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "food");
  assertEquals(r.predictions!.additional_data.cuisine, "Italian");
  assertEquals(r.predictions!.additional_data.total_time, "PT30M");
});

Deno.test("JSON-LD Restaurant with geo → place + lat/lng", () => {
  const r = extractFromHtml(
    jsonLdHtml({
      "@type": "Restaurant",
      name: "Joe's",
      telephone: "+1-555-0100",
      geo: { "@type": "GeoCoordinates", latitude: 40.7, longitude: -74.0 },
      address: { streetAddress: "1 Main", addressLocality: "NYC" },
    }),
    BASE,
  );
  assertEquals(r.predictions!.type, "place");
  assertEquals(r.predictions!.suggested_category_path, "Restaurant");
  assertEquals(r.predictions!.additional_data.latitude, 40.7);
  assertEquals(r.predictions!.additional_data.longitude, -74.0);
  assertEquals(r.predictions!.additional_data.phone, "+1-555-0100");
});

Deno.test("JSON-LD SoftwareApplication → app", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "SoftwareApplication", name: "App", operatingSystem: "iOS", applicationCategory: "Game" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "app");
  assertEquals(r.predictions!.additional_data.operating_system, "iOS");
});

Deno.test("JSON-LD VideoGame → game", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "VideoGame", name: "Tetris", gamePlatform: "Switch", genre: "Puzzle" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "game");
  assertEquals(r.predictions!.additional_data.platform, "Switch");
});

Deno.test("JSON-LD Book with ISBN → book", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Book", name: "Dune", isbn: "9780441013593", author: "Frank Herbert", numberOfPages: 412 }),
    BASE,
  );
  assertEquals(r.predictions!.type, "book");
  assertEquals(r.predictions!.additional_data.isbn, "9780441013593");
  assertEquals(r.predictions!.additional_data.author, "Frank Herbert");
  assertEquals(r.predictions!.additional_data.page_count, 412);
});

Deno.test("JSON-LD Course → course", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Course", name: "CS101", provider: { "@type": "Org", name: "Stanford" } }),
    BASE,
  );
  assertEquals(r.predictions!.type, "course");
  assertEquals(r.predictions!.additional_data.provider, "Stanford");
});

Deno.test("OG-only og:type=video.movie → movie at 0.8", () => {
  const html = `<html><head>
    <meta property="og:type" content="video.movie">
    <meta property="og:title" content="The Matrix">
    <meta property="og:image" content="https://cdn.example.com/m.jpg">
  </head></html>`;
  const r = extractFromHtml(html, BASE);
  assertEquals(r.predictions!.type, "movie");
  assertEquals(r.predictions!.confidence, 0.8);
  assertEquals(r.predictions!.suggested_category_path, "video.movie");
  assertEquals(r.predictions!.image_url, "https://cdn.example.com/m.jpg");
});

// ─── @type array handling ──────────────────────────────────────────────────

Deno.test("@type array picks first recognized", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": ["Thing", "Product"], name: "X" }),
    BASE,
  );
  assertEquals(r.predictions!.type, "product");
});

Deno.test("@type array with no recognized → weak_signals", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": ["Foo", "Bar"], name: "X" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
  assertEquals(r.metadata.weak_signals, true);
});

// ─── Wrapper unwrap ────────────────────────────────────────────────────────

Deno.test("WebPage with mainEntity Product → product, source recorded", () => {
  const r = extractFromHtml(
    jsonLdHtml({
      "@type": "WebPage",
      mainEntity: { "@type": "Product", name: "Wrapped" },
    }),
    BASE,
  );
  assertEquals(r.predictions!.type, "product");
  assert(r.metadata.sources.includes("jsonld:WebPage→Product"));
});

Deno.test("Article with about Movie → movie", () => {
  const r = extractFromHtml(
    jsonLdHtml({
      "@type": "Article",
      about: { "@type": "Movie", name: "Wrapped Movie" },
    }),
    BASE,
  );
  assertEquals(r.predictions!.type, "movie");
});

Deno.test("WebPage with no mainEntity → weak_signals", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "WebPage", name: "Page Title" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

Deno.test("WebPage→WebPage→Product → weak_signals (one level only)", () => {
  const r = extractFromHtml(
    jsonLdHtml({
      "@type": "WebPage",
      mainEntity: { "@type": "WebPage", mainEntity: { "@type": "Product", name: "Deep" } },
    }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

// ─── Weak-signal guards ────────────────────────────────────────────────────

Deno.test("Organization → weak_signals (not brand)", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Organization", name: "Acme Inc" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

Deno.test("Person → weak_signals (not professional)", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Person", name: "Jane" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

Deno.test("Event → weak_signals (deferred)", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Event", name: "Concert" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

Deno.test("Service → weak_signals", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Service", name: "Cleaning" }),
    BASE,
  );
  assertStrictEquals(r.predictions, null);
});

Deno.test("Title-only 'Buy iPhone 15' → weak_signals (no keyword inference)", () => {
  const html = `<html><head><title>Buy iPhone 15 Pro</title><meta name="description" content="Best phone"></head></html>`;
  const r = extractFromHtml(html, BASE);
  assertStrictEquals(r.predictions, null);
});

Deno.test("Minimal example.com HTML → weak_signals", () => {
  const r = extractFromHtml(`<html><head><title>Example</title></head><body></body></html>`, BASE);
  assertStrictEquals(r.predictions, null);
});

Deno.test("Malformed JSON-LD block is skipped, OG fallback used", () => {
  const html = `<html><head>
    <script type="application/ld+json">{not json</script>
    <meta property="og:type" content="product">
    <meta property="og:title" content="OG Product">
  </head></html>`;
  const r = extractFromHtml(html, BASE);
  assertEquals(r.predictions!.type, "product");
  assertEquals(r.predictions!.confidence, 0.8);
});

Deno.test("@graph picks first supported node", () => {
  const r = extractFromHtml(
    jsonLdHtml({
      "@graph": [
        { "@type": "Organization", name: "Acme" },
        { "@type": "Product", name: "First Product" },
        { "@type": "Movie", name: "Second" },
      ],
    }),
    BASE,
  );
  assertEquals(r.predictions!.type, "product");
  assertEquals(r.predictions!.name, "First Product");
});

// ─── URL safety ────────────────────────────────────────────────────────────

Deno.test("safeAbsoluteUrl drops javascript:", () => {
  assertStrictEquals(safeAbsoluteUrl("javascript:alert(1)", BASE), null);
});

Deno.test("safeAbsoluteUrl drops data:", () => {
  assertStrictEquals(safeAbsoluteUrl("data:image/png;base64,xxxx", BASE), null);
});

Deno.test("safeAbsoluteUrl drops mailto:", () => {
  assertStrictEquals(safeAbsoluteUrl("mailto:x@y.com", BASE), null);
});

Deno.test("safeAbsoluteUrl resolves relative path", () => {
  assertEquals(safeAbsoluteUrl("/img/a.png", "https://x.com/p"), "https://x.com/img/a.png");
});

Deno.test("og:image=javascript: dropped → image_url null", () => {
  const html = `<html><head>
    <meta property="og:type" content="product">
    <meta property="og:title" content="X">
    <meta property="og:image" content="javascript:alert(1)">
  </head></html>`;
  const r = extractFromHtml(html, BASE);
  assertStrictEquals(r.predictions!.image_url, null);
  assertEquals(r.predictions!.images, []);
});

Deno.test("canonical link with mailto: dropped", () => {
  const html = `<html><head>
    <link rel="canonical" href="mailto:x@y.com">
    <script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "X" })}</script>
  </head></html>`;
  const r = extractFromHtml(html, BASE);
  assertEquals(r.predictions!.additional_data.canonical_url, undefined);
});

// ─── Shape contract ────────────────────────────────────────────────────────

Deno.test("Prediction shape has all V1-compatible keys and no fabricated path", () => {
  const r = extractFromHtml(
    jsonLdHtml({ "@type": "Product", name: "X" }),
    BASE,
  );
  const p = r.predictions!;
  assertStrictEquals(p.category_id, null);
  assertStrictEquals(p.matched_category_name, null);
  assertEquals(p.tags, []);
  assert("images" in p);
  assert("image_url" in p);
  assert("additional_data" in p);
  assert(!("suggested_category" in p), "no top-level suggested_category key");
  assert(p.suggested_category_path && !p.suggested_category_path.includes(">"), "no fabricated path");
  assertEquals(p.suggested_category_path, "Product", "raw PascalCase preserved");
});
