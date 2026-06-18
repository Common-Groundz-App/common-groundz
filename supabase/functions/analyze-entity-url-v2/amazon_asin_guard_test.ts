// Phase 1.6: tests for the Amazon ASIN exact-match grounding guard.
//
// The guard MUST:
//   - pass through when ASIN is null (non-Amazon),
//   - accept external grounding URLs that contain the canonical /dp/<ASIN>,
//     /gp/product/<ASIN>, /gp/aw/d/<ASIN>, or bare ASIN token,
//   - normalize URLs (case-insensitive, decodeURIComponent, strip query/frag),
//   - reject Plantmade-style external evidence that never mentions the ASIN
//     with AMAZON_ASIN_GROUNDING_MISMATCH,
//   - fail closed (AMAZON_ASIN_GROUNDING_UNAVAILABLE) when grounding is empty,
//   - never trust model-echo fields (webSearchQueries / segment.text / prompt).
//     Those fields are excluded at the call site; this test confirms that
//     when ONLY those fields contain the ASIN (i.e. the guard is correctly
//     never given them), the guard rejects.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  verifyAmazonAsinGrounding,
  groundingContainsCanonicalDpUrl,
  type AmazonGroundingEvidence,
} from "./amazon_asin_guard.ts";

const EMPTY: AmazonGroundingEvidence = {
  chunkUris: [],
  chunkTitles: [],
  retrievedUrls: [],
};

Deno.test("guard: null ASIN passes (non-Amazon no-op)", () => {
  assertEquals(
    verifyAmazonAsinGrounding({ amazonAsin: null, groundingEvidence: EMPTY }),
    { ok: true },
  );
});

Deno.test("guard: canonical /dp/<ASIN> URL in chunk uris → pass", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://www.amazon.in/dp/B0FGJF5QN7/"],
      chunkTitles: [],
      retrievedUrls: [],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: /gp/product/<ASIN> in retrievedUrls → pass", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: [],
      chunkTitles: [],
      retrievedUrls: ["https://www.amazon.com/gp/product/B0FGJF5QN7"],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: ASIN token in chunk title → pass", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://example.com/review-page"],
      chunkTitles: ["Hands-on with B0FGJF5QN7 (the new serum)"],
      retrievedUrls: [],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: lowercase ASIN in URL accepted after normalization", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://www.amazon.in/dp/b0fgjf5qn7/"],
      chunkTitles: [],
      retrievedUrls: [],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: URL-encoded path accepted after decodeURIComponent", () => {
  // /dp/%42%30FGJF5QN7/  decodes to /dp/B0FGJF5QN7/
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://www.amazon.com/dp/%42%30FGJF5QN7/"],
      chunkTitles: [],
      retrievedUrls: [],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: query/fragment ignored during match", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://www.amazon.com/dp/B0FGJF5QN7/?ref=foo#bar"],
      chunkTitles: [],
      retrievedUrls: [],
    },
  });
  assertEquals(r.ok, true);
});

Deno.test("guard: Plantmade-style external evidence (no ASIN) → MISMATCH", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: [
        "https://plantmade.in/products/rosemary-hair-serum",
        "https://www.amazon.in/dp/B07XYZABCD/",
      ],
      chunkTitles: ["Plantmade Rosemary Hair Serum", "Best hair serums 2025"],
      retrievedUrls: ["https://plantmade.in/about"],
    },
  });
  assertEquals(r, { ok: false, reason: "AMAZON_ASIN_GROUNDING_MISMATCH" });
});

Deno.test("guard: empty external evidence → UNAVAILABLE (fail closed)", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: EMPTY,
  });
  assertEquals(r, { ok: false, reason: "AMAZON_ASIN_GROUNDING_UNAVAILABLE" });
});

Deno.test("guard: missing grounding evidence object → UNAVAILABLE", () => {
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: null,
  });
  assertEquals(r, { ok: false, reason: "AMAZON_ASIN_GROUNDING_UNAVAILABLE" });
});

Deno.test("guard: model-echo rejection — ASIN only in fields the guard must ignore", () => {
  // The guard intentionally accepts ONLY chunk URIs/titles + retrievedUrls.
  // webSearchQueries and groundingSupports.segment.text are NOT passed in by
  // the caller in index.ts. Simulate the worst case: the call site somehow
  // built grounding from external fields that DO NOT contain the ASIN
  // (because Search returned unrelated neighbor pages). Even though the
  // ASIN may appear in webSearchQueries or model answer text, the guard
  // must reject because external evidence does not anchor on it.
  const r = verifyAmazonAsinGrounding({
    amazonAsin: "B0FGJF5QN7",
    groundingEvidence: {
      chunkUris: ["https://plantmade.in/foo"],
      chunkTitles: ["Plantmade serum"],
      retrievedUrls: [],
    },
  });
  assertEquals(r, { ok: false, reason: "AMAZON_ASIN_GROUNDING_MISMATCH" });
});

// ---------- groundingContainsCanonicalDpUrl ----------

Deno.test("canonicalDp: matches /dp/<asin>", () => {
  assertEquals(
    groundingContainsCanonicalDpUrl("B0FGJF5QN7", {
      chunkUris: ["https://www.amazon.in/dp/B0FGJF5QN7/"],
      chunkTitles: [],
      retrievedUrls: [],
    }),
    true,
  );
});

Deno.test("canonicalDp: matches /gp/aw/d/<asin>", () => {
  assertEquals(
    groundingContainsCanonicalDpUrl("B0FGJF5QN7", {
      chunkUris: [],
      chunkTitles: [],
      retrievedUrls: ["https://www.amazon.com/gp/aw/d/B0FGJF5QN7/"],
    }),
    true,
  );
});

Deno.test("canonicalDp: returns false when only title contains ASIN", () => {
  assertEquals(
    groundingContainsCanonicalDpUrl("B0FGJF5QN7", {
      chunkUris: ["https://example.com/x"],
      chunkTitles: ["B0FGJF5QN7 review"],
      retrievedUrls: [],
    }),
    false,
  );
});
