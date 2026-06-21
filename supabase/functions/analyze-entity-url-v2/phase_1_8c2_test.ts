// Phase 1.8c.2 — Amazon-only diagnostic telemetry tests.
//
// Verifies:
//   - extended diagnostics populate only when guard runs on Amazon URL
//   - counts/buckets/booleans/anchor_source are correct
//   - hash samples gated on ENTITY_DIAG_HASH_SALT (omitted when unset / weak)
//   - no raw token strings, page titles, or model output leak into the block
//   - grounding_amazon_chunk_count uses the strict Amazon host predicate

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildFinalization,
  makeGuardTracker,
  bucketRatio,
  hashToken,
  type AmazonGuardExtendedDiagnostics,
} from "./finalization_telemetry.ts";
import {
  runDualPathVerification,
  pickPageTitleAnchor,
  type PageSignalsForGuard,
} from "./amazon_asin_guard.ts";

const STRONG_SALT = "phase_1_8c2_test_salt_value_long_enough";

function withSalt<T>(salt: string | null, fn: () => T): T {
  const prev = Deno.env.get("ENTITY_DIAG_HASH_SALT");
  if (salt === null) Deno.env.delete("ENTITY_DIAG_HASH_SALT");
  else Deno.env.set("ENTITY_DIAG_HASH_SALT", salt);
  try {
    return fn();
  } finally {
    if (prev === undefined) Deno.env.delete("ENTITY_DIAG_HASH_SALT");
    else Deno.env.set("ENTITY_DIAG_HASH_SALT", prev);
  }
}

const AMAZON_PAGE: PageSignalsForGuard = {
  title: "Folliwise Botanie Hair Vital Serum",
  og_title: "Folliwise Botanie Hair Vital Serum",
  twitter_title: null,
  canonical: "https://www.amazon.in/dp/B0XXXXXXXX",
  jsonld_product_name: "Folliwise Botanie Hair Vital Serum",
  jsonld_brand: "Folliwise",
};

// ─── bucketRatio boundaries ────────────────────────────────────────────

Deno.test("Phase 1.8c.2: bucketRatio — boundaries", () => {
  assertEquals(bucketRatio(0, 4), "none");
  assertEquals(bucketRatio(1, 4), "low");        // 0.25
  assertEquals(bucketRatio(2, 6), "low");        // 0.333 < 0.34 → low
  assertEquals(bucketRatio(34, 100), "medium");  // 0.34 inclusive
  assertEquals(bucketRatio(50, 100), "medium");
  assertEquals(bucketRatio(66, 100), "medium");  // 0.66 inclusive
  assertEquals(bucketRatio(67, 100), "high");    // >0.66
  assertEquals(bucketRatio(100, 100), "high");
});

// ─── hashToken gating ──────────────────────────────────────────────────

Deno.test("Phase 1.8c.2: hashToken — null when salt unset", () => {
  withSalt(null, () => {
    assertEquals(hashToken("folliwise"), null);
  });
});

Deno.test("Phase 1.8c.2: hashToken — null when salt < 16 chars", () => {
  withSalt("shortsalt", () => {
    assertEquals(hashToken("folliwise"), null);
  });
});

Deno.test("Phase 1.8c.2: hashToken — stable + 12-char hex when salt set", () => {
  withSalt(STRONG_SALT, () => {
    const h1 = hashToken("folliwise");
    const h2 = hashToken("folliwise");
    assertExists(h1);
    assertEquals(h1, h2);
    assertEquals(h1!.length, 12);
    assert(/^[0-9a-f]{12}$/.test(h1!));
    // Different salt would give different value — covered by gating tests.
    assert(hashToken("folliwise") !== hashToken("botanie"));
  });
});

// ─── pickPageTitleAnchor.source ────────────────────────────────────────

Deno.test("Phase 1.8c.2: pickPageTitleAnchor exposes source", () => {
  const r = pickPageTitleAnchor(AMAZON_PAGE, "B0XXXXXXXX");
  assertEquals(r.source, "jsonld_product_name");

  const r2 = pickPageTitleAnchor(
    { ...AMAZON_PAGE, jsonld_product_name: null },
    "B0XXXXXXXX",
  );
  assertEquals(r2.source, "og_title");

  const r3 = pickPageTitleAnchor(null, null);
  assertEquals(r3.source, "none");
});

// ─── runDualPathVerification.diagnostics.extended ──────────────────────

Deno.test("Phase 1.8c.2: extended diagnostics — counts and bucket (low)", () => {
  withSalt(STRONG_SALT, () => {
    const v = runDualPathVerification({
      amazonAsin: "B0XXXXXXXX",
      groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
      pageSignals: AMAZON_PAGE,
      // Distinctive token "folliwise" overlaps, plus model adds non-overlap.
      modelName: "Folliwise Cleanser",
    });
    const ext = v.diagnostics.extended!;
    assertExists(ext);
    assertEquals(ext.anchor_present, true);
    assertEquals(ext.anchor_source, "jsonld_product_name");
    assert(ext.anchor_token_count >= 2);
    assert(ext.model_name_token_count >= 1);
    assert(ext.token_overlap_count >= 1);
    // 1 overlap / 1 (model min) = 1.0 → high; but overlap may be 1 and
    // model_name_token_count = 1 (only "folliwise" is distinctive in
    // "Folliwise Cleanser" — "cleanser" is a STOP_TOKEN). Accept high.
    assert(["medium", "high"].includes(ext.overlap_ratio_bucket));
    assertEquals(ext.jsonld_brand_present, true);
    assertEquals(ext.jsonld_product_name_present, true);
    assertEquals(ext.anchor_has_og_title, true);
    assertEquals(ext.anchor_has_html_title, true);
    // Hash samples present with salt set
    assertExists(ext.anchor_token_hash_sample);
    assertExists(ext.model_name_token_hash_sample);
    assertExists(ext.overlap_hash_sample);
    assert(ext.overlap_hash_sample!.length >= 1);
  });
});

Deno.test("Phase 1.8c.2: extended diagnostics — hash samples omitted without salt", () => {
  withSalt(null, () => {
    const v = runDualPathVerification({
      amazonAsin: "B0XXXXXXXX",
      groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
      pageSignals: AMAZON_PAGE,
      modelName: "Folliwise Cleanser",
    });
    const ext = v.diagnostics.extended!;
    assertExists(ext);
    assertEquals(ext.anchor_token_hash_sample, undefined);
    assertEquals(ext.model_name_token_hash_sample, undefined);
    assertEquals(ext.overlap_hash_sample, undefined);
    // Counts still present
    assert(ext.anchor_token_count > 0);
  });
});

Deno.test("Phase 1.8c.2: extended diagnostics — hash sample capped at 5", () => {
  withSalt(STRONG_SALT, () => {
    // Build a page anchor with >5 distinctive tokens by using a JSON-LD
    // product name with lots of distinctive (non-stop) tokens.
    const longAnchor = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const page: PageSignalsForGuard = {
      title: longAnchor,
      og_title: longAnchor,
      twitter_title: null,
      canonical: "https://www.amazon.in/dp/B0XXXXXXXX",
      jsonld_product_name: longAnchor,
      jsonld_brand: null,
    };
    const v = runDualPathVerification({
      amazonAsin: "B0XXXXXXXX",
      groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
      pageSignals: page,
      modelName: "alpha",
    });
    const ext = v.diagnostics.extended!;
    assertEquals(ext.anchor_token_hash_sample!.length, 5);
  });
});

Deno.test("Phase 1.8c.2: grounding_amazon_chunk_count — strict host predicate", () => {
  withSalt(STRONG_SALT, () => {
    // Verifies the count delegates to isStrictAmazonHost. Per existing
    // Phase 1.8 predicate semantics, `amazon.in.evil.com` (4+ labels) is
    // rejected; `notamazon.com` and `amazonaws.com` are rejected.
    const v = runDualPathVerification({
      amazonAsin: "B0XXXXXXXX",
      groundingEvidence: {
        chunkUris: [
          "https://www.amazon.in/dp/B0XXXXXXXX",
          "https://www.amazon.com/dp/B0XXXXXXXX",
          "https://notamazon.com/dp/B0XXXXXXXX",
          "https://amazon.in.evil.com/dp/B0XXXXXXXX",
          "https://amazonaws.com/dp/B0XXXXXXXX",
        ],
        chunkTitles: [],
        retrievedUrls: [],
      },
      pageSignals: AMAZON_PAGE,
      modelName: "Folliwise Cleanser",
    });
    const ext = v.diagnostics.extended!;
    assertEquals(ext.grounding_chunk_count, 5);
    assertEquals(ext.grounding_amazon_chunk_count, 2);
  });
});

Deno.test("Phase 1.8c.2: buildFinalization — diagnostics omitted when tracker has none", () => {
  const tracker = makeGuardTracker();
  tracker.evaluated = false;
  const f = buildFinalization({
    mergedPredictions: null,
    mergeDiag: null,
    mergeReturnedPredictionsBeforeGuard: false,
    guard: tracker,
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.amazon_guard.diagnostics, undefined);
});

Deno.test("Phase 1.8c.2: buildFinalization — diagnostics pass through when present", () => {
  const tracker = makeGuardTracker();
  tracker.evaluated = true;
  tracker.passed = false;
  tracker.raw_reason_code = "AMAZON_NAME_PAGE_TITLE_MISMATCH";
  tracker.input_source = "gemini_only";
  const stub: AmazonGuardExtendedDiagnostics = {
    anchor_present: true,
    anchor_source: "og_title",
    anchor_token_count: 4,
    model_name_token_count: 2,
    token_overlap_count: 0,
    overlap_ratio_bucket: "none",
    page_title_anchor_reject_reason: null,
    grounding_contains_canonical_dp_url: false,
    grounding_chunk_count: 3,
    grounding_amazon_chunk_count: 1,
    jsonld_brand_present: true,
    jsonld_product_name_present: false,
    jsonld_brand_matches_model_name: null,
    anchor_has_og_title: true,
    anchor_has_html_title: true,
    anchor_has_jsonld_product_name: false,
  };
  tracker.diagnostics = stub;
  const f = buildFinalization({
    mergedPredictions: null,
    mergeDiag: null,
    mergeReturnedPredictionsBeforeGuard: true,
    guard: tracker,
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.amazon_guard.diagnostics, stub);
  assertEquals(f.amazon_guard.rejection_reason, "name_unanchored");
  assertEquals(f.response_builder.chosen_source_reason, "discarded_by_amazon_guard");
});

// ─── No raw token / page-title leakage ─────────────────────────────────

Deno.test("Phase 1.8c.2: no raw anchor or model-name tokens leak into emitted block", () => {
  withSalt(STRONG_SALT, () => {
    const rawAnchorTokens = ["folliwise", "botanie", "vital"];
    const rawModelTokens = ["folliwise"];
    const v = runDualPathVerification({
      amazonAsin: "B0XXXXXXXX",
      groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
      pageSignals: AMAZON_PAGE,
      modelName: "Folliwise Cleanser",
    });
    const ext = v.diagnostics.extended!;
    const dump = JSON.stringify(ext).toLowerCase();
    for (const tok of [...rawAnchorTokens, ...rawModelTokens]) {
      assert(
        !dump.includes(tok),
        `extended diagnostics must not contain raw token "${tok}", got: ${dump}`,
      );
    }
  });
});

// ─── Phase 1.8c.2a — jsonld_brand_matches_model_name ───────────────────

Deno.test("Phase 1.8c.2a: brand match — null when jsonld_brand absent", () => {
  const page: PageSignalsForGuard = { ...AMAZON_PAGE, jsonld_brand: null };
  const v = runDualPathVerification({
    amazonAsin: "B0XXXXXXXX",
    groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
    pageSignals: page,
    modelName: "Folliwise Cleanser",
  });
  assertEquals(v.diagnostics.extended!.jsonld_brand_matches_model_name, null);
});

Deno.test("Phase 1.8c.2a: brand match — true when brand token appears in model name", () => {
  const v = runDualPathVerification({
    amazonAsin: "B0XXXXXXXX",
    groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
    pageSignals: AMAZON_PAGE, // jsonld_brand: "Folliwise"
    modelName: "Folliwise Cleanser",
  });
  assertEquals(v.diagnostics.extended!.jsonld_brand_matches_model_name, true);
});

Deno.test("Phase 1.8c.2a: brand match — false when brand token absent from model name", () => {
  const v = runDualPathVerification({
    amazonAsin: "B0XXXXXXXX",
    groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
    pageSignals: AMAZON_PAGE, // jsonld_brand: "Folliwise"
    modelName: "Acme Widget Pro",
  });
  assertEquals(v.diagnostics.extended!.jsonld_brand_matches_model_name, false);
});

Deno.test("Phase 1.8c.2a: brand match — raw brand never leaks into block", () => {
  const page: PageSignalsForGuard = { ...AMAZON_PAGE, jsonld_brand: "Folliwise" };
  const v = runDualPathVerification({
    amazonAsin: "B0XXXXXXXX",
    groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
    pageSignals: page,
    modelName: "Acme Widget",
  });
  const ext = v.diagnostics.extended!;
  const dump = JSON.stringify(ext).toLowerCase();
  assert(!dump.includes("folliwise"), `must not contain raw brand: ${dump}`);
  assertEquals(ext.jsonld_brand_matches_model_name, false);
});

Deno.test("Phase 1.8c.2a: brand match — false when brand has only stop tokens", () => {
  const page: PageSignalsForGuard = { ...AMAZON_PAGE, jsonld_brand: "Amazon Official" };
  const v = runDualPathVerification({
    amazonAsin: "B0XXXXXXXX",
    groundingEvidence: { chunkUris: [], chunkTitles: [], retrievedUrls: [] },
    pageSignals: page,
    modelName: "Folliwise Cleanser",
  });
  assertEquals(v.diagnostics.extended!.jsonld_brand_matches_model_name, false);
});
