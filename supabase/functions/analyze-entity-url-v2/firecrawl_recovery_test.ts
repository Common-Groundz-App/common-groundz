import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { extractFromFirecrawl } from "./firecrawl_recovery.ts";

const BASE = "https://www.nykaa.com/dior-homme-intense-eau-de-parfum-intense/p/950905";

const NYKAA_MD = `# DIOR Homme Intense Eau De Parfum Intense

₹10,600

A woody-floral fragrance for men with notes of lavender, iris, and amber that captures masculine elegance and modern sophistication in a refined olfactory composition.

## Customers also viewed

# Sauvage

₹8,400
`;

function nykaaMeta(): Record<string, unknown> {
  return {
    "og:type": "product",
    "og:title": "DIOR Homme Intense Eau De Parfum Intense",
    "og:description": "DIOR Homme Intense — a woody-floral fragrance for men.",
    "og:image": "https://images.nykaa.com/dior-homme.jpg",
    "product:price:amount": "14900",
    "product:price:currency": "INR",
  };
}

Deno.test("Nykaa-shaped: product, casing preserved, price omitted on conflict", () => {
  const r = extractFromFirecrawl({
    metadata: nykaaMeta(),
    markdown: NYKAA_MD,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  const p = r.result.predictions!;
  assertEquals(p.type, "product");
  assertEquals(p.name, "DIOR Homme Intense Eau De Parfum Intense");
  assertEquals(p.suggested_category_path, "product");
  assertEquals(p.image_url, "https://images.nykaa.com/dior-homme.jpg");
  assertEquals(p.additional_data.currency, "INR");
  assertEquals(p.additional_data.price, undefined); // 14900 vs 10600 >5%
});

Deno.test("camelCase ogTitle/ogImage works; casing preserved", () => {
  const r = extractFromFirecrawl({
    metadata: {
      ogType: "product",
      ogTitle: "DIOR Sauvage",
      ogImage: "https://x/y.jpg",
    },
    markdown: null,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.name, "DIOR Sauvage");
  assertEquals(r.result.predictions!.image_url, "https://x/y.jpg");
});

Deno.test("no og:type but product:* present → type=product, path=Product", () => {
  const r = extractFromFirecrawl({
    metadata: {
      "og:title": "Some Item",
      "product:price:amount": "99",
      "product:price:currency": "USD",
    },
    markdown: null,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.type, "product");
  assertEquals(r.result.predictions!.suggested_category_path, "Product");
  assertEquals(r.result.predictions!.additional_data.price, 99);
});

Deno.test("metadata price accepted when no markdown price", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "X", "product:price:amount": "14900" },
    markdown: "# X\n\nNo price visible here at all in main region body content.",
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.additional_data.price, 14900);
});

Deno.test("og:type article → weak/null", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "article", "og:title": "x" },
    markdown: "# x",
    finalUrl: BASE,
  });
  assertEquals(r.result.predictions, null);
});

for (const t of ["website", "profile", "music.song", "restaurant.restaurant", "business.business", "place"]) {
  Deno.test(`og:type ${t} → weak in this hotfix`, () => {
    const r = extractFromFirecrawl({
      metadata: { "og:type": t, "og:title": "x" },
      markdown: "# x",
      finalUrl: BASE,
    });
    assertEquals(r.result.predictions, null);
  });
}

Deno.test("og:type video.movie → movie", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "video.movie", "og:title": "Inception" },
    markdown: null,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.type, "movie");
  assertEquals(r.result.predictions!.suggested_category_path, "video.movie");
});

Deno.test("javascript: image → image_url null", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "x", "og:image": "javascript:alert(1)" },
    markdown: null,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.image_url, null);
});

Deno.test("no H1 but og:title → name from og:title, casing preserved", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "DIOR Homme" },
    markdown: "Some body text without any heading at all in this region.",
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.name, "DIOR Homme");
});

Deno.test("'Customers also viewed' after ## not used for name/price", () => {
  const md = `# Real Product Name

Some description body text here that is reasonably long for paragraph match.

## Customers also viewed

# Other Product

₹1
`;
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "product:price:amount": "500" },
    markdown: md,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.name, "Real Product Name");
  // markdown price ₹1 is in the "also viewed" section → ignored; metadata 500 kept.
  assertEquals(r.result.predictions!.additional_data.price, 500);
});
