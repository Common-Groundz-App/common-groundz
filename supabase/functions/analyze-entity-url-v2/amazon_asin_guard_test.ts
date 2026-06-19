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

// ─── Phase 1.7 — dual-path identity verification ─────────────────────────

import {
  runDualPathVerification,
  pickPageTitleAnchor,
} from "./amazon_asin_guard.ts";

const ASIN = "B0FGJF5QN7";
const ANCHOR_OK = "Root Botanie FOLLIWISE Men Hair Vital Serum + Anti-Pollution Dandruff Protect Scalp Cleanser";
const GROUNDING_OK = {
  chunkUris: ["https://www.amazon.in/dp/B0FGJF5QN7/"],
  chunkTitles: [],
  retrievedUrls: [],
};
const GROUNDING_NONE = { chunkUris: [], chunkTitles: [], retrievedUrls: [] };

Deno.test("dual: Path A only (grounding ok, no anchor) → external_grounding", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_OK,
    pageSignals: null,
    modelName: "Whatever Product",
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.amazon_identity_verified_via, "external_grounding");
  assertEquals(r.diagnostics.amazon_exact_match_verified, true);
});

Deno.test("dual: Path B only (anchor verifies, grounding empty) → page_title_anchor", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_NONE,
    pageSignals: {
      title: null, og_title: ANCHOR_OK, twitter_title: null, canonical: null,
      jsonld_product_name: null,
    },
    modelName: "FOLLIWISE Men Hair Vital Serum",
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.amazon_identity_verified_via, "page_title_anchor");
  assertEquals(r.diagnostics.amazon_exact_match_verified, false);
  assertEquals(r.diagnostics.page_title_match_verified, true);
});

Deno.test("dual: both pass → both", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_OK,
    pageSignals: {
      title: null, og_title: ANCHOR_OK, twitter_title: null, canonical: null,
      jsonld_product_name: null,
    },
    modelName: "FOLLIWISE Men Hair Vital Serum",
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.amazon_identity_verified_via, "both");
});

Deno.test("dual: anchor mismatch overrides grounding pass → MISMATCH", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_OK,
    pageSignals: {
      title: null, og_title: ANCHOR_OK, twitter_title: null, canonical: null,
      jsonld_product_name: null,
    },
    // Slug-derived neighbor: only "root" overlaps and root is in stop-list
    modelName: "Root Hair Serum Dandruff Cleanser",
  });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "AMAZON_NAME_PAGE_TITLE_MISMATCH");
  assertEquals(r.diagnostics.page_title_match_verified, false);
});

Deno.test("dual: model name with only stop-tokens+digits → reject MISMATCH (no overlap)", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_NONE,
    pageSignals: {
      title: null, og_title: ANCHOR_OK, twitter_title: null, canonical: null,
      jsonld_product_name: null,
    },
    modelName: "Hair Serum 100ml",
  });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "AMAZON_NAME_PAGE_TITLE_MISMATCH");
});

Deno.test("dual: both fail → preserves Phase 1.6 reason", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: { chunkUris: ["https://plantmade.in/x"], chunkTitles: [], retrievedUrls: [] },
    pageSignals: null,
    modelName: "Whatever",
  });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "AMAZON_ASIN_GROUNDING_MISMATCH");
});

Deno.test("dual: anchor with no distinctive tokens → NO_DISTINCTIVE_TOKENS skip, falls back to Path A", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_OK,
    pageSignals: {
      title: "Hair Serum Cleanser", og_title: null, twitter_title: null, canonical: null,
      jsonld_product_name: null,
    },
    modelName: "Folliwise Hair Vital",
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.page_title_match_skip_reason, "NO_DISTINCTIVE_TOKENS");
  assertEquals(r.diagnostics.amazon_identity_verified_via, "external_grounding");
});

// ─── Phase 1.7 — pickPageTitleAnchor: bot-wall + canonical ASIN ──────────

Deno.test("anchor: jsonld_product_name chosen over og/twitter/title", () => {
  const r = pickPageTitleAnchor({
    title: "T", og_title: "O", twitter_title: "W", canonical: null,
    jsonld_product_name: "J",
  }, null);
  assertEquals(r.anchor, "J");
});

Deno.test("anchor: bot-wall <title> skipped, og_title used", () => {
  const r = pickPageTitleAnchor({
    title: "Robot Check", og_title: ANCHOR_OK, twitter_title: null, canonical: null,
    jsonld_product_name: null,
  }, null);
  assertEquals(r.anchor, ANCHOR_OK);
});

Deno.test("anchor: all bot-wall → BOT_WALL_OR_GENERIC", () => {
  const r = pickPageTitleAnchor({
    title: "Robot Check", og_title: "Amazon Sign-In", twitter_title: "Page Not Found",
    canonical: null, jsonld_product_name: null,
  }, null);
  assertEquals(r.anchor, null);
  assertEquals(r.reject_reason, "BOT_WALL_OR_GENERIC");
});

Deno.test("anchor: bare site name Amazon.in rejected", () => {
  const r = pickPageTitleAnchor({
    title: "Amazon.in", og_title: null, twitter_title: null, canonical: null,
    jsonld_product_name: null,
  }, null);
  assertEquals(r.anchor, null);
  assertEquals(r.reject_reason, "BOT_WALL_OR_GENERIC");
});

Deno.test("anchor: canonical ASIN matches → anchor used", () => {
  const r = pickPageTitleAnchor({
    title: ANCHOR_OK, og_title: null, twitter_title: null,
    canonical: "https://www.amazon.in/dp/B0FGJF5QN7/", jsonld_product_name: null,
  }, ASIN);
  assertEquals(r.anchor, ANCHOR_OK);
  assertEquals(r.canonical_asin_mismatch, false);
});

Deno.test("anchor: canonical ASIN mismatch → null + AMAZON_CANONICAL_ASIN_MISMATCH", () => {
  const r = pickPageTitleAnchor({
    title: ANCHOR_OK, og_title: null, twitter_title: null,
    canonical: "https://www.amazon.in/dp/B0XXXXX111/", jsonld_product_name: null,
  }, ASIN);
  assertEquals(r.anchor, null);
  assertEquals(r.canonical_asin_mismatch, true);
  assertEquals(r.reject_reason, "AMAZON_CANONICAL_ASIN_MISMATCH");
});

Deno.test("anchor: canonical without ASIN → anchor used normally", () => {
  const r = pickPageTitleAnchor({
    title: ANCHOR_OK, og_title: null, twitter_title: null,
    canonical: "https://www.amazon.in/some-other-page/", jsonld_product_name: null,
  }, ASIN);
  assertEquals(r.anchor, ANCHOR_OK);
});

Deno.test("dual: canonical ASIN mismatch + Path A pass → external_grounding only", () => {
  const r = runDualPathVerification({
    amazonAsin: ASIN,
    groundingEvidence: GROUNDING_OK,
    pageSignals: {
      title: ANCHOR_OK, og_title: null, twitter_title: null,
      canonical: "https://www.amazon.in/dp/B0XXXXX111/", jsonld_product_name: null,
    },
    modelName: "Something Else",
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.amazon_canonical_asin_mismatch, true);
  assertEquals(r.diagnostics.amazon_identity_verified_via, "external_grounding");
});

Deno.test("dual: null ASIN passes regardless", () => {
  const r = runDualPathVerification({
    amazonAsin: null, groundingEvidence: null, pageSignals: null, modelName: null,
  });
  assertEquals(r.ok, true);
  assertEquals(r.diagnostics.amazon_exact_match_verified, true);
});
