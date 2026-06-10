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

// ───── Fix A: H1 between 4 KB and 16 KB of nav noise ─────
Deno.test("H1 within 16KB main region wins; junk H1 after ## ignored", () => {
  const navNoise = ("- Nav link\n").repeat(800); // ~9 KB of nav junk
  const md = `${navNoise}\n# Clean Product Name\n\nSome description body text long enough to qualify as a paragraph.\n\n## Product Description\n\n# Junk H1 After Cutoff\n`;
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "Junk OG Title" },
    markdown: md,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.name, "Clean Product Name");
  assertEquals(r.diagnostics.name_source, "markdown_h1");
  assertEquals(r.diagnostics.markdown_h1_within_main_region, true);
});

// ───── Fix B: label-anchored price matches ─────
const baseProductMeta = { "og:type": "product", "og:title": "X" };

function priceCase(md: string): number | null | undefined {
  const r = extractFromFirecrawl({
    metadata: baseProductMeta,
    markdown: `# X\n\n${md}\n`,
    finalUrl: BASE,
  });
  return r.result.predictions?.additional_data.price as number | null | undefined;
}

Deno.test("price: 'MRP: ₹14,900' → 14900", () => {
  assertEquals(priceCase("MRP: ₹14,900"), 14900);
});
Deno.test("price: 'Price: 2499' → 2499", () => {
  assertEquals(priceCase("Price: 2499"), 2499);
});
Deno.test("price: 'Offer Price ₹10,600' → 10600", () => {
  assertEquals(priceCase("Offer Price ₹10,600"), 10600);
});
Deno.test("price: 'Sale Price: Rs. 7,499' → 7499", () => {
  assertEquals(priceCase("Sale Price: Rs. 7,499"), 7499);
});

// ───── Fix B: currency-anchored matches ─────
Deno.test("price: 'Rs. 14,900' → 14900", () => {
  assertEquals(priceCase("Rs. 14,900"), 14900);
});
Deno.test("price: 'INR 1200' → 1200", () => {
  assertEquals(priceCase("INR 1200"), 1200);
});
Deno.test("price: '$49.99' → 49.99", () => {
  assertEquals(priceCase("$49.99"), 49.99);
});

// ───── Fix B: priority ordering (Offer/Sale > currency-only > MRP) ─────
Deno.test("price: MRP first, Offer Price later → picks Offer Price", () => {
  assertEquals(
    priceCase("MRP: ₹14,900\n\nOffer Price ₹10,600"),
    10600,
  );
});
Deno.test("price: only MRP present → MRP as last resort", () => {
  assertEquals(priceCase("MRP: ₹14,900"), 14900);
});
Deno.test("price: bare currency tokens, no MRP nearby → first wins", () => {
  assertEquals(priceCase("₹14,900\n\n₹10,600"), 14900);
});

// ───── Fix B: multi-SKU conflict with metadata ─────
Deno.test("price: metadata 14900 vs markdown 10600 (Offer Price) → omitted", () => {
  const r = extractFromFirecrawl({
    metadata: { ...baseProductMeta, "product:price:amount": "14900", "product:price:currency": "INR" },
    markdown: `# X\n\nMRP: ₹14,900\n\nOffer Price ₹10,600\n`,
    finalUrl: BASE,
  });
  assert(r.result.predictions);
  assertEquals(r.result.predictions!.additional_data.price, undefined);
  assertEquals(r.result.predictions!.additional_data.currency, "INR");
  assertEquals(r.diagnostics.selected_price_source, "omitted");
  assertEquals(r.diagnostics.price_conflict, true);
});

// ───── Fix B: negative cases — bare numbers must NEVER match ─────
Deno.test("price: '4.3 out of 5' → no match", () => {
  assertEquals(priceCase("4.3 out of 5"), undefined);
});
Deno.test("price: '12,450 reviews' → no match", () => {
  assertEquals(priceCase("12,450 reviews"), undefined);
});
Deno.test("price: '50 ml' / '100 ml' → no match", () => {
  assertEquals(priceCase("50 ml\n100 ml"), undefined);
});
Deno.test("price: 'Delivery by 12 June' → no match", () => {
  assertEquals(priceCase("Delivery by 12 June"), undefined);
});
Deno.test("price: bare '950905' → no match", () => {
  assertEquals(priceCase("950905"), undefined);
});

// ───── Phase 8.1C: labeled MRP/Sale pair detection ─────
import { detectListSalePair, MIN_SALE_TO_MRP_RATIO } from "./firecrawl_recovery.ts";

Deno.test("8.1C: MRP labeled + sale currency-only → no pair", () => {
  const p = detectListSalePair("MRP: ₹1999\n\n₹1299", null);
  assertEquals(p, null);
});

Deno.test("8.1C: MRP ₹ + Offer Price ₹ → pair with markdown currency INR", () => {
  const p = detectListSalePair("MRP: ₹1999\nOffer Price: ₹1299", null);
  assert(p);
  assertEquals(p!.list_price, 1999);
  assertEquals(p!.sale_price, 1299);
  assertEquals(p!.currency, "INR");
});

Deno.test("8.1C: MRP ₹ + Price (no currency) + metadata INR → pair via fallback", () => {
  const p = detectListSalePair("MRP: ₹1999\nPrice: 1299", "INR");
  assert(p);
  assertEquals(p!.currency, "INR");
  assertEquals(p!.sale_price, 1299);
});

Deno.test("8.1C: MRP ₹ + Price $ → currency conflict → reject", () => {
  const p = detectListSalePair("MRP: ₹1999\nPrice: $1299", "INR");
  assertEquals(p, null);
});

Deno.test("8.1C: label priority Offer > Sale > Price", () => {
  const p = detectListSalePair(
    "MRP ₹1999\nOffer Price ₹1299\nSale Price ₹1399\nPrice ₹1499",
    null,
  );
  assert(p);
  assertEquals(p!.sale_price, 1299);
});

Deno.test("8.1C: ratio gate rejects sale < 0.4 * list", () => {
  assert(MIN_SALE_TO_MRP_RATIO === 0.4);
  const p = detectListSalePair("MRP ₹1999\nOffer Price ₹399", null);
  assertEquals(p, null);
});

Deno.test("8.1C: nearest MRP wins over far-away unrelated MRP", () => {
  const filler = "x ".repeat(400);
  const md = `MRP ₹999\n${filler}\nMRP ₹1999\nOffer Price ₹1299`;
  const p = detectListSalePair(md, null);
  assert(p);
  assertEquals(p!.list_price, 1999);
});

Deno.test("8.1C: List Price label accepted as list candidate", () => {
  const p = detectListSalePair("List Price ₹1999\nOffer Price ₹1299", null);
  assert(p);
  assertEquals(p!.list_price, 1999);
});

Deno.test("8.1C: extractor diagnostics carry pair when present", () => {
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "X", "product:price:currency": "INR" },
    markdown: `# X\n\nMRP ₹1999\nOffer Price ₹1299\n`,
    finalUrl: BASE,
  });
  assert(r.diagnostics.markdown_list_sale_pair);
  assertEquals(r.diagnostics.markdown_list_sale_pair!.list_price, 1999);
  assertEquals(r.diagnostics.markdown_list_sale_pair!.sale_price, 1299);
  assertEquals(r.diagnostics.markdown_list_sale_pair!.currency, "INR");
});

Deno.test("8.1C: additional_data.price unchanged by pair detection (byte-identical)", () => {
  // Same fixture as the priority test above: Offer Price 10600 still wins as single price.
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "X" },
    markdown: `# X\n\nMRP: ₹14,900\n\nOffer Price ₹10,600\n`,
    finalUrl: BASE,
  });
  assertEquals(r.result.predictions!.additional_data.price, 10600);
  // And pair is now also surfaced separately:
  assert(r.diagnostics.markdown_list_sale_pair);
  assertEquals(r.diagnostics.markdown_list_sale_pair!.sale_price, 10600);
});

Deno.test("8.1C: pair rejected → additional_data.price still set from single selector", () => {
  // Sale is currency-only ⇒ no pair, but single-price selector still returns it.
  const r = extractFromFirecrawl({
    metadata: { "og:type": "product", "og:title": "X" },
    markdown: `# X\n\nMRP: ₹1999\n\n₹1299\n`,
    finalUrl: BASE,
  });
  assertEquals(r.diagnostics.markdown_list_sale_pair, null);
  // ₹1299 is currency-only tier-2; MRP is tier-3; tier-2 wins.
  assertEquals(r.result.predictions!.additional_data.price, 1299);
});
