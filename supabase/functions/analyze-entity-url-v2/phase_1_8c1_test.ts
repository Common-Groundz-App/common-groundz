// Phase 1.8c.1 — post-merge finalization telemetry tests.
//
// Validates that the finalization block correctly distinguishes:
//   - happy success/recovery paths
//   - legitimate Amazon-guard rejection (raw_reason_code preserved)
//   - the "discarded_unknown" signal that means the Phase 1.8c.1 bug is
//     still unresolved (merge produced a prediction but it vanished without
//     any guard rejecting it)
//
// No prediction values, no raw model text, no PII appear in any field.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildFinalization,
  createDefaultFinalization,
  makeGuardTracker,
  simplifyGuardReason,
  type Finalization,
} from "./finalization_telemetry.ts";
import type { MergeDiagnostics } from "./merge.ts";
import type { V2Predictions } from "./schema.ts";

function makeMergeDiag(
  path: "success" | "recovery",
  geminiWinners: number,
): MergeDiagnostics {
  const winners = ["type", "name", "description", "image_url", "brand", "price", "currency", "tags"];
  // deno-lint-ignore no-explicit-any
  const field_winners: any = {};
  for (let i = 0; i < winners.length; i++) {
    field_winners[winners[i]] = i < geminiWinners ? "gemini" : "none";
  }
  return {
    path,
    gemini_used: geminiWinners > 0,
    gemini_fields_used: geminiWinners,
    field_winners,
    name_junk_override_applied: false,
    price_conflict_blocked_gemini: false,
    page_owned_image_override_applied: false,
    description_source_correction: "none",
    ...(path === "recovery" ? { recovery_gate_passed: true } : {}),
  };
}

function makePredictions(): V2Predictions {
  return {
    type: "product",
    name: "x",
    description: "x",
    image_url: null,
    additional_data: {},
  } as unknown as V2Predictions;
}

// ── Test 1: default shape — every field present with correct enum values ──
Deno.test("1.8c.1 default Finalization has every required field with correct enum", () => {
  const f = createDefaultFinalization();
  assertEquals(f.merge_returned_predictions, false);
  assertEquals(f.merge_path, "none");
  assertEquals(f.merge_field_winners_gemini_count, 0);
  assertEquals(f.recovery_gate.ran_inside_merge, false);
  assertEquals(f.recovery_gate.ran_again_after_merge, false);
  assertEquals(f.recovery_gate.second_check_passed, null);
  assertEquals(f.amazon_guard.evaluated, false);
  assertEquals(f.amazon_guard.passed, true);
  assertEquals(f.amazon_guard.rejection_reason, "n/a");
  assertEquals(f.amazon_guard.raw_reason_code, null);
  assertEquals(f.amazon_guard.input_source, "none");
  assertEquals(f.response_builder.predictions_var_truthy, false);
  assertEquals(f.response_builder.predictions_value_source, "none");
  assertEquals(f.response_builder.chosen_source, "none");
  assertEquals(f.response_builder.chosen_source_reason, "all_null");
});

// ── Test 2: simplifyGuardReason preserves the actual constant family ──────
Deno.test("1.8c.1 simplifyGuardReason maps all known guard constants", () => {
  assertEquals(simplifyGuardReason("AMAZON_ASIN_GROUNDING_UNAVAILABLE"), "grounding_unavailable");
  assertEquals(simplifyGuardReason("AMAZON_ASIN_GROUNDING_MISMATCH"), "asin_mismatch");
  assertEquals(simplifyGuardReason("AMAZON_CANONICAL_ASIN_MISMATCH"), "asin_mismatch");
  assertEquals(simplifyGuardReason("AMAZON_NAME_PAGE_TITLE_MISMATCH"), "name_unanchored");
  assertEquals(simplifyGuardReason(null), "n/a");
  assertEquals(simplifyGuardReason("UNKNOWN_FUTURE_CODE"), "guard_not_run");
});

// ── Test 3: happy recovery (search-fallback) — chosen_source is the existing
// production label, predictions_value_source is merge_output ──────────────
Deno.test("1.8c.1 happy recovery via search fallback → gemini_search_fallback", () => {
  const guard = makeGuardTracker();
  guard.evaluated = true;
  guard.passed = true;
  guard.input_source = "gemini_only";
  const f = buildFinalization({
    mergedPredictions: makePredictions(),
    mergeDiag: makeMergeDiag("recovery", 8),
    mergeReturnedPredictionsBeforeGuard: true,
    guard,
    fallbackUsed: true,
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.merge_returned_predictions, true);
  assertEquals(f.merge_path, "recovery");
  assertEquals(f.merge_field_winners_gemini_count, 8);
  assertEquals(f.recovery_gate.ran_inside_merge, true);
  assertEquals(f.amazon_guard.evaluated, true);
  assertEquals(f.amazon_guard.passed, true);
  assertEquals(f.amazon_guard.rejection_reason, "n/a");
  assertEquals(f.amazon_guard.raw_reason_code, null);
  assertEquals(f.response_builder.predictions_var_truthy, true);
  assertEquals(f.response_builder.predictions_value_source, "merge_output");
  assertEquals(f.response_builder.chosen_source, "gemini_search_fallback");
  assertEquals(f.response_builder.chosen_source_reason, "merge_recovery_with_fallback");
});

// ── Test 4: legitimate guard rejection (post-fallback) — raw constant
// preserved, simplified enum is correct ───────────────────────────────────
Deno.test("1.8c.1 guard rejects via page-title anchor → discarded_by_amazon_guard with raw constant", () => {
  const guard = makeGuardTracker();
  guard.evaluated = true;
  guard.passed = false;
  guard.raw_reason_code = "AMAZON_NAME_PAGE_TITLE_MISMATCH";
  guard.input_source = "gemini_only";
  const f = buildFinalization({
    mergedPredictions: null, // discarded by guard
    mergeDiag: makeMergeDiag("recovery", 8),
    mergeReturnedPredictionsBeforeGuard: true,
    guard,
    fallbackUsed: false, // cleared by guard rejection path in index.ts
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.amazon_guard.evaluated, true);
  assertEquals(f.amazon_guard.passed, false);
  assertEquals(f.amazon_guard.rejection_reason, "name_unanchored");
  assertEquals(f.amazon_guard.raw_reason_code, "AMAZON_NAME_PAGE_TITLE_MISMATCH");
  assertEquals(f.response_builder.chosen_source, "none");
  assertEquals(f.response_builder.chosen_source_reason, "discarded_by_amazon_guard");
  assertEquals(f.response_builder.predictions_value_source, "none");
  assertEquals(f.merge_returned_predictions, true);
});

// ── Test 5: ASIN grounding mismatch surfaces correct raw constant ─────────
Deno.test("1.8c.1 guard rejects via ASIN mismatch → asin_mismatch with raw constant", () => {
  const guard = makeGuardTracker();
  guard.evaluated = true;
  guard.passed = false;
  guard.raw_reason_code = "AMAZON_ASIN_GROUNDING_MISMATCH";
  guard.input_source = "gemini_only";
  const f = buildFinalization({
    mergedPredictions: null,
    mergeDiag: makeMergeDiag("recovery", 8),
    mergeReturnedPredictionsBeforeGuard: true,
    guard,
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.amazon_guard.rejection_reason, "asin_mismatch");
  assertEquals(f.amazon_guard.raw_reason_code, "AMAZON_ASIN_GROUNDING_MISMATCH");
  assertEquals(f.response_builder.chosen_source_reason, "discarded_by_amazon_guard");
});

// ── Test 6: extract-wins regression — no behavior change in happy path ────
Deno.test("1.8c.1 happy extract path → extractor_merge, no guard, merge_output", () => {
  const f = buildFinalization({
    mergedPredictions: makePredictions(),
    mergeDiag: makeMergeDiag("success", 0),
    mergeReturnedPredictionsBeforeGuard: true,
    guard: makeGuardTracker(),
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: true,
  });
  assertEquals(f.merge_path, "success");
  assertEquals(f.recovery_gate.ran_inside_merge, false);
  assertEquals(f.amazon_guard.evaluated, false);
  assertEquals(f.amazon_guard.passed, true); // default; not evaluated
  assertEquals(f.amazon_guard.rejection_reason, "guard_not_run");
  assertEquals(f.response_builder.chosen_source, "extractor_merge");
  assertEquals(f.response_builder.chosen_source_reason, "extract_present");
  assertEquals(f.response_builder.predictions_value_source, "merge_output");
});

// ── Test 7: the smoking-gun "discarded_unknown" combination — this is the
// signal that the Phase 1.8c.1 bug is still present ───────────────────────
Deno.test("1.8c.1 mergeReturnedPredictionsBeforeGuard=true + null merged + guard.passed → discarded_unknown (BUG SIGNAL)", () => {
  const f = buildFinalization({
    mergedPredictions: null,
    mergeDiag: makeMergeDiag("recovery", 8),
    mergeReturnedPredictionsBeforeGuard: true,
    guard: makeGuardTracker(), // guard never evaluated (or passed)
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: false,
  });
  assertEquals(f.merge_returned_predictions, true);
  assertEquals(f.response_builder.predictions_var_truthy, false);
  assertEquals(f.response_builder.chosen_source, "none");
  assertEquals(f.response_builder.chosen_source_reason, "discarded_unknown");
});

// ── Test 8: no prediction values / no raw text in finalization fields ─────
Deno.test("1.8c.1 finalization fields contain only enums/booleans/counts", () => {
  const guard = makeGuardTracker();
  guard.evaluated = true;
  guard.passed = false;
  guard.raw_reason_code = "AMAZON_NAME_PAGE_TITLE_MISMATCH";
  guard.input_source = "gemini_only";
  const f = buildFinalization({
    mergedPredictions: null,
    mergeDiag: makeMergeDiag("recovery", 8),
    mergeReturnedPredictionsBeforeGuard: true,
    guard,
    fallbackUsed: false,
    usedFirecrawl: false,
    extractPresent: false,
  });
  const allowedKeys = new Set([
    "merge_returned_predictions",
    "merge_path",
    "merge_field_winners_gemini_count",
    "recovery_gate",
    "amazon_guard",
    "response_builder",
  ]);
  for (const k of Object.keys(f)) assert(allowedKeys.has(k), `unexpected key: ${k}`);

  const allString = JSON.stringify(f);
  // Spot-check: no obviously-leaked fields from any model. The only string
  // values allowed are constrained enums (snake_case) and the raw guard
  // constant (UPPER_SNAKE_CASE). No spaces, no URLs, no model text.
  assert(!/https?:\/\//.test(allString), "must not contain URLs");
  assert(!allString.includes(" "), "must not contain free-form strings (which would have spaces)");
  // raw_reason_code is the only ALL_CAPS_WITH_UNDERSCORES value allowed.
  assertExists(f.amazon_guard.raw_reason_code);
});

// ── Test 9: enum values for every chosen_source_reason path ───────────────
Deno.test("1.8c.1 all reason enums emitted by buildFinalization belong to the contract", () => {
  const validReasons = new Set([
    "extract_present",
    "merge_success",
    "merge_recovery_with_fallback",
    "merge_recovery_with_firecrawl",
    "all_null",
    "discarded_by_amazon_guard",
    "discarded_by_second_recovery_gate",
    "discarded_unknown",
  ]);
  const cases: Array<Parameters<typeof buildFinalization>[0]> = [
    { mergedPredictions: makePredictions(), mergeDiag: makeMergeDiag("success", 0), mergeReturnedPredictionsBeforeGuard: true, guard: makeGuardTracker(), fallbackUsed: false, usedFirecrawl: false, extractPresent: true },
    { mergedPredictions: makePredictions(), mergeDiag: makeMergeDiag("success", 4), mergeReturnedPredictionsBeforeGuard: true, guard: makeGuardTracker(), fallbackUsed: false, usedFirecrawl: true, extractPresent: true },
    { mergedPredictions: makePredictions(), mergeDiag: makeMergeDiag("recovery", 8), mergeReturnedPredictionsBeforeGuard: true, guard: makeGuardTracker(), fallbackUsed: false, usedFirecrawl: true, extractPresent: false },
    { mergedPredictions: makePredictions(), mergeDiag: makeMergeDiag("recovery", 8), mergeReturnedPredictionsBeforeGuard: true, guard: makeGuardTracker(), fallbackUsed: true, usedFirecrawl: false, extractPresent: false },
    { mergedPredictions: null, mergeDiag: null, mergeReturnedPredictionsBeforeGuard: false, guard: makeGuardTracker(), fallbackUsed: false, usedFirecrawl: false, extractPresent: false },
  ];
  for (const c of cases) {
    const f = buildFinalization(c);
    assert(validReasons.has(f.response_builder.chosen_source_reason), `bad reason: ${f.response_builder.chosen_source_reason}`);
  }
});
