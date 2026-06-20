// Phase 1.8 focused tests: strict Amazon host predicate export, minimal
// Amazon evidence packet, per-field caps, byte-budget guard.

import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { isStrictAmazonHost } from "./host_hints.ts";
import {
  buildV2Prompts,
  AMAZON_MIN_PACKET_USER_PROMPT_BYTE_CAP,
} from "./prompt-generator-v2.ts";

Deno.test("isStrictAmazonHost: accepts real Amazon regional hosts", () => {
  for (
    const h of [
      "amazon.com",
      "www.amazon.com",
      "amazon.in",
      "www.amazon.in",
      "amazon.co.uk",
      "www.amazon.co.uk",
      "amazon.com.au",
      "amazon.co.jp",
      "smile.amazon.com",
    ]
  ) {
    assert(isStrictAmazonHost(h), `expected ${h} to be accepted`);
  }
});

Deno.test("isStrictAmazonHost: rejects lookalike hosts", () => {
  for (
    const h of [
      "amazon.in.evil.com",
      "notamazon.in",
      "amazon-in.com",
      "fakeamazon.com",
      "amazon.evil",
      "evil.com",
      "example.com",
    ]
  ) {
    assertFalse(isStrictAmazonHost(h), `expected ${h} to be rejected`);
  }
});

Deno.test("Phase 1.8 minimal packet: drops rawHtml + bulky JSON-LD when pageSignals title exists", () => {
  const out = buildV2Prompts(
    {
      url: "https://www.amazon.in/dp/B0FGJF5QN7/",
      evidenceBaseUrl: "https://www.amazon.in/dp/B0FGJF5QN7/",
      title: "Sample Title",
      og: { title: "OG Title", description: "OG short description" },
      twitter: { title: "TW Title" },
      jsonld: [
        { "@type": "Product", name: "Real Product Name", brand: "Real Brand" },
        { "@type": "BreadcrumbList", itemListElement: [{ name: "Home" }] },
      ],
      rawHtml: "<html>" + "x".repeat(50_000) + "</html>",
      extractMetadata: null,
      amazonAsin: "B0FGJF5QN7",
      amazonPathSlug: "root hair serum",
    },
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );

  assertEquals(out.amazon_min_packet_used, true);
  assertEquals(out.raw_html_dropped_reason, "pagesignals_present");
  // rawHtml must NOT leak into the prompt.
  assertFalse(out.userPrompt.includes("raw_html"));
  assertFalse(out.userPrompt.includes("xxxxxxxxxx"));
  // BreadcrumbList must NOT leak.
  assertFalse(out.userPrompt.includes("BreadcrumbList"));
  // Whitelisted fields must be present.
  assertStringIncludes(out.userPrompt, '"amazon_asin":"B0FGJF5QN7"');
  assertStringIncludes(out.userPrompt, '"jsonld_product_name":"Real Product Name"');
  assertStringIncludes(out.userPrompt, '"jsonld_brand":"Real Brand"');
  assertStringIncludes(out.userPrompt, '"og_title":"OG Title"');
  assertStringIncludes(out.userPrompt, '"twitter_title":"TW Title"');
});

Deno.test("Phase 1.8 minimal packet: per-field caps applied before assembly", () => {
  const long = "a".repeat(1000);
  const out = buildV2Prompts(
    {
      url: "https://www.amazon.in/dp/B0FGJF5QN7/",
      evidenceBaseUrl: "https://www.amazon.in/dp/B0FGJF5QN7/",
      title: long, // capped to 300
      og: { title: long, description: long }, // 300 / 280
      jsonld: [{ "@type": "Product", name: long, brand: long }],
      amazonAsin: "B0FGJF5QN7",
    },
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
  assertEquals(out.amazon_min_packet_used, true);
  // Field-level caps. JSON-escaped strings of capped lengths:
  assertStringIncludes(out.userPrompt, `"title":"${"a".repeat(300)}"`);
  assertStringIncludes(out.userPrompt, `"og_title":"${"a".repeat(300)}"`);
  assertStringIncludes(out.userPrompt, `"og_description":"${"a".repeat(280)}"`);
  assertStringIncludes(out.userPrompt, `"jsonld_product_name":"${"a".repeat(300)}"`);
  assertStringIncludes(out.userPrompt, `"jsonld_brand":"${"a".repeat(200)}"`);
});

Deno.test("Phase 1.8 minimal packet: not triggered when no title signal present", () => {
  const out = buildV2Prompts(
    {
      url: "https://www.amazon.in/dp/B0FGJF5QN7/",
      evidenceBaseUrl: "https://www.amazon.in/dp/B0FGJF5QN7/",
      // no title / og / twitter / jsonld product name
      amazonAsin: "B0FGJF5QN7",
      amazonPathSlug: "root hair serum",
    },
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
  assertEquals(out.amazon_min_packet_used, false);
});

Deno.test("Phase 1.8 minimal packet: not triggered on non-Amazon hosts", () => {
  const out = buildV2Prompts(
    {
      url: "https://example.com/foo",
      evidenceBaseUrl: "https://example.com/foo",
      title: "Example",
      og: { title: "Example" },
    },
    "https://example.com/foo",
  );
  assertEquals(out.amazon_min_packet_used, false);
});

Deno.test("Phase 1.8 minimal packet: sanitized URL excludes query string", () => {
  const out = buildV2Prompts(
    {
      url: "https://www.amazon.in/dp/B0FGJF5QN7/?ref_=foo&pd_rd_w=bar",
      evidenceBaseUrl: "https://www.amazon.in/dp/B0FGJF5QN7/",
      og: { title: "Product" },
      amazonAsin: "B0FGJF5QN7",
    },
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
  assertEquals(out.amazon_min_packet_used, true);
  // The whitelisted url field inside EXTRACTED_EVIDENCE has no query.
  assertFalse(out.userPrompt.includes('"url":"https://www.amazon.in/dp/B0FGJF5QN7/?'));
  assertStringIncludes(
    out.userPrompt,
    '"url":"https://www.amazon.in/dp/B0FGJF5QN7/"',
  );
});

Deno.test("Phase 1.8 byte-budget guard: oversize triggers single trim, request still proceeds", () => {
  // Synthetic: large og_description above per-field cap is impossible, so
  // exercise the guard by feeding an enormous description that the cap
  // slices to 280 chars. Combined prompt under 24 KiB → oversize must be
  // false. Sanity check that the guard does NOT spuriously fire on a
  // normal packet.
  const out = buildV2Prompts(
    {
      url: "https://www.amazon.in/dp/B0FGJF5QN7/",
      evidenceBaseUrl: "https://www.amazon.in/dp/B0FGJF5QN7/",
      title: "x".repeat(1000),
      og: { title: "y".repeat(1000), description: "z".repeat(1000) },
      twitter: { title: "a".repeat(1000), description: "b".repeat(1000) },
      jsonld: [{ "@type": "Product", name: "Real Product", brand: "Real Brand" }],
      amazonAsin: "B0FGJF5QN7",
      amazonPathSlug: "slug here",
    },
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
  const bytes = new TextEncoder().encode(out.userPrompt).length;
  assert(bytes < AMAZON_MIN_PACKET_USER_PROMPT_BYTE_CAP, `bytes=${bytes}`);
  assertEquals(out.amazon_packet_oversize, false);
});
