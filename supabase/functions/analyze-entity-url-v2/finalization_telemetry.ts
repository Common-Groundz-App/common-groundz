// Phase 1.8c.1 — post-merge finalization telemetry.
//
// Pure helpers, no I/O, no model invocations. Booleans, counts, and
// constrained enums only. NEVER raw model output, page titles, brand names,
// product names, full URLs, or PII.
//
// Co-located with index.ts so tests can exercise the helper without
// importing the edge-function entrypoint (which would trigger serve()).

import { createHash } from "node:crypto";
import type { MergeDiagnostics } from "./merge.ts";
import type { V2Predictions } from "./schema.ts";

// ─── Phase 1.8c.2: salted token-hash + overlap bucket helpers ──────────
//
// Hashes are computed from raw tokens (anchor / model-name) ONLY when a
// per-deployment salt of at least 16 chars is configured via the
// ENTITY_DIAG_HASH_SALT env var. Without the salt, hashToken returns null
// and the caller MUST omit the *_hash_sample fields from emitted logs.
//
// Why salt-required: a bare sha256 of a single brand/product token is
// trivially reversible via a small precomputed vocabulary. A 16+ char
// per-deployment salt prevents cross-deployment correlation and rainbow
// attacks while keeping the same-token-equal-hash invariant that lets us
// compute cross-side overlap inside one request.

function getDiagHashSalt(): string | null {
  try {
    const s = Deno.env.get("ENTITY_DIAG_HASH_SALT") ?? "";
    return s.length >= 16 ? s : null;
  } catch {
    return null;
  }
}

export function hashToken(t: string): string | null {
  if (!t) return null;
  const salt = getDiagHashSalt();
  if (!salt) return null;
  return createHash("sha256").update(salt + ":" + t).digest("hex").slice(0, 12);
}

export type OverlapRatioBucket = "none" | "low" | "medium" | "high";

export function bucketRatio(overlap: number, denom: number): OverlapRatioBucket {
  if (denom <= 0 || overlap <= 0) return "none";
  const r = overlap / denom;
  if (r < 0.34) return "low";
  if (r <= 0.66) return "medium";
  return "high";
}

export type AnchorSource =
  | "jsonld_product_name"
  | "og_title"
  | "twitter_title"
  | "html_title"
  | "none";

/**
 * Phase 1.8c.2 — Amazon-only diagnostic snapshot of the guard's internal
 * comparison. Populated by runDualPathVerification, attached to the
 * GuardTracker by index.ts, then mirrored into Finalization.amazon_guard.
 * Hash arrays are present iff a salt is configured.
 */
export interface AmazonGuardExtendedDiagnostics {
  anchor_present: boolean;
  anchor_source: AnchorSource;
  anchor_token_count: number;
  model_name_token_count: number;
  token_overlap_count: number;
  overlap_ratio_bucket: OverlapRatioBucket;
  page_title_anchor_reject_reason: string | null;
  grounding_contains_canonical_dp_url: boolean;
  grounding_chunk_count: number;
  grounding_amazon_chunk_count: number;
  jsonld_brand_present: boolean;
  jsonld_product_name_present: boolean;
  anchor_has_og_title: boolean;
  anchor_has_html_title: boolean;
  anchor_has_jsonld_product_name: boolean;
  anchor_token_hash_sample?: string[];
  model_name_token_hash_sample?: string[];
  overlap_hash_sample?: string[];
}

export type AmazonGuardRejectionReasonEnum =
  | "asin_mismatch"
  | "name_unanchored"
  | "brand_mismatch"
  | "page_signals_missing"
  | "grounding_unavailable"
  | "guard_not_run"
  | "n/a";

export type FinalizationSourceEnum =
  | "merge_output"
  | "extract_only"
  | "gemini_only"
  | "firecrawl_only"
  | "none";

export type ChosenSourceEnum =
  | "extractor"
  | "gemini"
  | "gemini_recovery"
  | "gemini_search_fallback"
  | "firecrawl_recovery"
  | "firecrawl_merge"
  | "extractor_merge"
  | "none";

export type ChosenSourceReasonEnum =
  | "extract_present"
  | "merge_success"
  | "merge_recovery_with_fallback"
  | "merge_recovery_with_firecrawl"
  | "all_null"
  | "discarded_by_amazon_guard"
  | "discarded_by_second_recovery_gate"
  | "discarded_unknown";

export interface Finalization {
  merge_returned_predictions: boolean;
  merge_path: "success" | "recovery" | "none";
  merge_field_winners_gemini_count: number;
  recovery_gate: {
    ran_inside_merge: boolean;
    ran_again_after_merge: boolean;
    second_check_passed: boolean | null;
  };
  amazon_guard: {
    evaluated: boolean;
    passed: boolean;
    rejection_reason: AmazonGuardRejectionReasonEnum;
    raw_reason_code: string | null;
    input_source: FinalizationSourceEnum;
    /**
     * Phase 1.8c.2 — Amazon-only diagnostic snapshot. Present iff guard
     * was evaluated AND the request was on an Amazon host. Omitted for
     * non-Amazon requests so non-Amazon traces stay byte-identical.
     */
    diagnostics?: AmazonGuardExtendedDiagnostics;
  };
  response_builder: {
    predictions_var_truthy: boolean;
    predictions_value_source: FinalizationSourceEnum;
    chosen_source: ChosenSourceEnum;
    chosen_source_reason: ChosenSourceReasonEnum;
  };
}

export interface GuardTracker {
  evaluated: boolean;
  passed: boolean;
  raw_reason_code: string | null;
  input_source: FinalizationSourceEnum;
  /** Phase 1.8c.2 — populated by index.ts from runDualPathVerification. */
  diagnostics: AmazonGuardExtendedDiagnostics | null;
}

export function makeGuardTracker(): GuardTracker {
  return {
    evaluated: false,
    passed: true,
    raw_reason_code: null,
    input_source: "none",
    diagnostics: null,
  };
}

export function simplifyGuardReason(
  raw: string | null,
): AmazonGuardRejectionReasonEnum {
  if (!raw) return "n/a";
  switch (raw) {
    case "AMAZON_ASIN_GROUNDING_UNAVAILABLE":
      return "grounding_unavailable";
    case "AMAZON_ASIN_GROUNDING_MISMATCH":
    case "AMAZON_CANONICAL_ASIN_MISMATCH":
      return "asin_mismatch";
    case "AMAZON_NAME_PAGE_TITLE_MISMATCH":
      return "name_unanchored";
    default:
      return "guard_not_run";
  }
}

export function createDefaultFinalization(): Finalization {
  return {
    merge_returned_predictions: false,
    merge_path: "none",
    merge_field_winners_gemini_count: 0,
    recovery_gate: {
      ran_inside_merge: false,
      ran_again_after_merge: false,
      second_check_passed: null,
    },
    amazon_guard: {
      evaluated: false,
      passed: true,
      rejection_reason: "n/a",
      raw_reason_code: null,
      input_source: "none",
    },
    response_builder: {
      predictions_var_truthy: false,
      predictions_value_source: "none",
      chosen_source: "none",
      chosen_source_reason: "all_null",
    },
  };
}

export interface BuildFinalizationArgs {
  mergedPredictions: V2Predictions | null;
  mergeDiag: MergeDiagnostics | null;
  /** Was merge's own recovery-gate satisfied (merge.ts returned non-null)? */
  mergeReturnedPredictionsBeforeGuard: boolean;
  /** Last guard call outcome on this branch. */
  guard: GuardTracker;
  /** Did the search-only fallback path produce the prediction? */
  fallbackUsed: boolean;
  /** Did firecrawl produce/improve the prediction on this branch? */
  usedFirecrawl: boolean;
  /** Did the deterministic extractor produce predictions? */
  extractPresent: boolean;
}

/**
 * Build the Finalization block.
 *
 * Diagnoses post-merge discards:
 *   - mergeReturnedPredictionsBeforeGuard=true + mergedPredictions=null +
 *     guard.passed=false  → discarded_by_amazon_guard (legitimate)
 *   - mergeReturnedPredictionsBeforeGuard=true + mergedPredictions=null +
 *     guard.passed=true   → discarded_unknown (bug — Phase 1.8c.1 unresolved)
 */
export function buildFinalization(args: BuildFinalizationArgs): Finalization {
  const f = createDefaultFinalization();
  const {
    mergedPredictions,
    mergeDiag,
    mergeReturnedPredictionsBeforeGuard,
    guard,
    fallbackUsed,
    usedFirecrawl,
    extractPresent,
  } = args;

  f.merge_returned_predictions = mergeReturnedPredictionsBeforeGuard;
  f.merge_path = (mergeDiag?.path as Finalization["merge_path"]) ?? "none";

  let geminiCount = 0;
  if (mergeDiag?.field_winners) {
    for (const v of Object.values(mergeDiag.field_winners)) {
      if (v === "gemini") geminiCount++;
    }
  }
  f.merge_field_winners_gemini_count = geminiCount;

  f.recovery_gate.ran_inside_merge = mergeDiag?.path === "recovery";
  f.recovery_gate.ran_again_after_merge = false;
  f.recovery_gate.second_check_passed = null;

  f.amazon_guard.evaluated = guard.evaluated;
  f.amazon_guard.passed = guard.evaluated ? guard.passed : true;
  f.amazon_guard.raw_reason_code = guard.raw_reason_code;
  f.amazon_guard.rejection_reason = guard.evaluated && !guard.passed
    ? simplifyGuardReason(guard.raw_reason_code)
    : (guard.evaluated ? "n/a" : "guard_not_run");
  f.amazon_guard.input_source = guard.input_source;

  f.response_builder.predictions_var_truthy = mergedPredictions !== null;
  f.response_builder.predictions_value_source = mergedPredictions !== null
    ? "merge_output"
    : "none";

  let chosen: ChosenSourceEnum = "none";
  let reason: ChosenSourceReasonEnum = "all_null";
  if (mergedPredictions !== null) {
    if (fallbackUsed) {
      chosen = "gemini_search_fallback";
      reason = "merge_recovery_with_fallback";
    } else if (extractPresent && usedFirecrawl) {
      chosen = "firecrawl_merge";
      reason = "merge_success";
    } else if (!extractPresent && usedFirecrawl) {
      chosen = "firecrawl_recovery";
      reason = "merge_recovery_with_firecrawl";
    } else if (!extractPresent) {
      chosen = "gemini_recovery";
      reason = "merge_recovery_with_fallback";
    } else {
      chosen = "extractor_merge";
      reason = "extract_present";
    }
  } else if (mergeReturnedPredictionsBeforeGuard && guard.evaluated && !guard.passed) {
    chosen = "none";
    reason = "discarded_by_amazon_guard";
  } else if (mergeReturnedPredictionsBeforeGuard) {
    chosen = "none";
    reason = "discarded_unknown";
  } else {
    chosen = "none";
    reason = "all_null";
  }
  f.response_builder.chosen_source = chosen;
  f.response_builder.chosen_source_reason = reason;

  return f;
}
