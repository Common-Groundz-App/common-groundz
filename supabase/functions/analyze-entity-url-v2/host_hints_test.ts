// ============= Full file contents =============

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  isKnownJsHeavyHost,
  canonicalizeAmazonUrl,
  extractAmazonPathSlug,
} from "./host_hints.ts";

Deno.test("amazon variants are JS-heavy", () => {
  for (const u of [
    "https://www.amazon.com/dp/B0",
    "https://amazon.in/dp/B0",
    "https://www.amazon.co.uk/dp/B0",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), true, u);
  }
});

Deno.test("flipkart/myntra/nykaa/ajio/meesho are JS-heavy", () => {
  for (const u of [
    "https://www.flipkart.com/x",
    "https://myntra.com/x",
    "https://m.nykaa.com/x",
    "https://www.ajio.com/x",
    "https://meesho.com/x",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), true, u);
  }
});

Deno.test("benign hosts are not flagged", () => {
  for (const u of [
    "https://wikipedia.org/wiki/X",
    "https://example.com/x",
    "https://www.imdb.com/title/tt1",
  ]) {
    assertEquals(isKnownJsHeavyHost(u), false, u);
  }
});

Deno.test("malformed URL returns false without throwing", () => {
  assertEquals(isKnownJsHeavyHost("not a url"), false);
  assertEquals(isKnownJsHeavyHost(""), false);
});

// ---------- canonicalizeAmazonUrl ----------

Deno.test("canonicalize: /dp/<ASIN>/ with query+fragment → clean", () => {
  assertEquals(
    canonicalizeAmazonUrl(
      "https://www.amazon.in/dp/B0FGJF5QN7/?_encoding=UTF8&pd_rd_w=9dqEK&ref_=foo#x",
    ),
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
});

Deno.test("canonicalize: /gp/product/<ASIN>/ → /dp/<ASIN>/", () => {
  assertEquals(
    canonicalizeAmazonUrl("https://www.amazon.in/gp/product/B0FGJF5QN7/?ref_=x"),
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
});

Deno.test("canonicalize: already-clean URL unchanged in shape", () => {
  assertEquals(
    canonicalizeAmazonUrl("https://www.amazon.in/dp/B0FGJF5QN7/"),
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
});

Deno.test("canonicalize: messy slug+dp URL → clean", () => {
  assertEquals(
    canonicalizeAmazonUrl(
      "https://www.amazon.in/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/?_encoding=UTF8&pd_rd_w=9dqEK&ref_=pd_hp",
    ),
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
});

Deno.test("canonicalize: Amazon URL without ASIN passes through", () => {
  const u = "https://www.amazon.in/gp/bestsellers";
  assertEquals(canonicalizeAmazonUrl(u), u);
});

Deno.test("canonicalize: non-Amazon URL passes through", () => {
  const u = "https://www.flipkart.com/foo/dp/B0FGJF5QN7/";
  assertEquals(canonicalizeAmazonUrl(u), u);
});

Deno.test("canonicalize: lookalike host (amazon.in.evil.com) passes through unchanged", () => {
  const u = "https://amazon.in.evil.com/dp/B0FGJF5QN7/";
  assertEquals(canonicalizeAmazonUrl(u), u);
});

Deno.test("canonicalize: lowercase ASIN is normalized to uppercase", () => {
  assertEquals(
    canonicalizeAmazonUrl("https://www.amazon.in/dp/b0fgjf5qn7/?x=1"),
    "https://www.amazon.in/dp/B0FGJF5QN7/",
  );
});

Deno.test("canonicalize: malformed input returns as-is, no throw", () => {
  assertEquals(canonicalizeAmazonUrl("not a url"), "not a url");
  assertEquals(canonicalizeAmazonUrl(""), "");
});

// ---------- extractAmazonPathSlug ----------

Deno.test("slug: extracts and sanitizes Root-Hair-... slug, no query bleed", () => {
  assertEquals(
    extractAmazonPathSlug(
      "https://www.amazon.in/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/?_encoding=UTF8&pd_rd_w=foo",
    ),
    "Root Hair Serum Dandruff Cleanser",
  );
});

Deno.test("slug: /gp/product/ with no slug segment → null", () => {
  assertEquals(
    extractAmazonPathSlug("https://www.amazon.in/gp/product/B0FGJF5QN7/"),
    null,
  );
});

Deno.test("slug: already-clean /dp/<ASIN>/ → null", () => {
  assertEquals(
    extractAmazonPathSlug("https://www.amazon.in/dp/B0FGJF5QN7/"),
    null,
  );
});

Deno.test("slug: non-Amazon host → null", () => {
  assertEquals(
    extractAmazonPathSlug("https://www.flipkart.com/foo/dp/B0FGJF5QN7/"),
    null,
  );
});

Deno.test("slug: lookalike host → null", () => {
  assertEquals(
    extractAmazonPathSlug("https://amazon.in.evil.com/Foo-Bar/dp/B0FGJF5QN7/"),
    null,
  );
});

Deno.test("slug: percent-escaped slug is decoded and sanitized", () => {
  assertEquals(
    extractAmazonPathSlug(
      "https://www.amazon.com/L%27Oreal-Paris-Serum/dp/B01ABCDEFG/",
    ),
    "L Oreal Paris Serum",
  );
});

Deno.test("slug: pure-numeric or punctuation-only slug → null", () => {
  assertEquals(
    extractAmazonPathSlug("https://www.amazon.in/12345/dp/B0FGJF5QN7/"),
    null,
  );
  assertEquals(
    extractAmazonPathSlug("https://www.amazon.in/---/dp/B0FGJF5QN7/"),
    null,
  );
});
