// Phase 1.5: shared last-resort search-only Gemini fallback.
//
// This helper is invoked from both the fetch_recovery branch and the main
// happy/weak_recovery branch in index.ts. It exists for ONE reason: when
// V2 would otherwise return no usable prediction, give Gemini one final
// chance using google_search only (no url_context, no raw HTML, no
// responseMimeType — same Phase 1 shape).
//
// IMPORTANT — raw-HTML guarantee:
//   The helper does NOT accept an `html` parameter. The injected
//   `geminiInvoker` signature also has no `html` field. This makes it
//   structurally impossible for a caller to leak page HTML into the
//   search-only prompt. The sentinel test
//   `search_only_fallback_helper_never_passes_html` in
//   gemini_search_fallback_test.ts guards against future regressions.
//
// Skip-reason precedence (first match wins):
//   1) prior_prediction_valid    — currentMerged !== null
//   2) primary_gemini_succeeded  — primaryGeminiPred !== null
//   3) gemini_not_configured     — !geminiConfigured
//   4) budget_exhausted          — remaining < timeout + buffer
//   5) (null)                    — fallback actually runs
//
// `firecrawl_succeeded` is intentionally NOT a skip reason: a non-null
// extract result may still fail the recovery gate, so we only skip when
// a prior step produced a usable, gate-passing prediction (caught by 1).

import type { GeminiResult } from "./gemini.ts";
import type { ExtractMetadata, V2Predictions } from "./schema.ts";
import type { MergeDiagnostics, MergeFlags } from "./merge.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";
import {
  SEARCH_FALLBACK_TIMEOUT_MS,
  SEARCH_FALLBACK_BUDGET_BUFFER_MS,
} from "./gemini.ts";

export type SearchFallbackSkipReason =
  | "prior_prediction_valid"
  | "primary_gemini_succeeded"
  | "gemini_not_configured"
  | "budget_exhausted";

/**
 * Phase 1.8c.3b — why fallback actually ran. Populated only when
 * `attempted === true`; null otherwise (pair with `skipReason`).
 *
 *   "invalid_shape"    — primary Gemini failed with GEMINI_INVALID_SHAPE
 *   "transport_error"  — primary Gemini failed with any other error code
 *                        (HTTP / timeout / safety / bad response / etc.)
 *   "recovery_gate"    — primary call wasn't made or had no error code
 *                        (i.e. fallback ran purely because merge produced
 *                        no usable prediction)
 */
export type SearchFallbackTriggerReason =
  | "invalid_shape"
  | "transport_error"
  | "recovery_gate";

/**
 * Signature for the Gemini invoker injected into the helper.
 *
 * Intentionally has NO `html` / `rawHtml` field — search-only fallback
 * must rely solely on the URL + sanitized whitelisted metadata.
 */
export type SearchFallbackGeminiInvoker = (args: {
  safeUrl: string;
  evidenceBaseUrl: string;
  extractMetadata: ExtractMetadata;
  usedFirecrawl: boolean;
  timeoutMs?: number;
}) => Promise<GeminiResult>;

export type SearchFallbackMerger = (
  extract: V2Predictions | null,
  geminiPred: GeminiRawPrediction | null,
  flags: MergeFlags,
) => { predictions: V2Predictions | null; mergeDiag: MergeDiagnostics };

export interface SearchFallbackDeps {
  geminiInvoker: SearchFallbackGeminiInvoker;
  applyMerge: SearchFallbackMerger;
  now?: () => number;
  timeoutMs?: number;
  budgetBufferMs?: number;
}

export interface SearchFallbackArgs {
  currentMerged: V2Predictions | null;
  primaryGeminiPred: GeminiRawPrediction | null;
  geminiConfigured: boolean;
  /** Wall-clock elapsed since the request started, in ms. */
  elapsedMs: number;
  /** Total request budget, in ms. */
  totalBudgetMs: number;
  safeUrl: string;
  evidenceBaseUrl: string;
  extractMetadata: ExtractMetadata;
  usedFirecrawl: boolean;
  mergeFlags: MergeFlags;
  /** Extractor/Firecrawl predictions used for the re-merge after fallback. */
  extractPredictions: V2Predictions | null;
  /**
   * Phase 1.8c.3b — error code from the primary Gemini call, when one was
   * made and failed. Drives `triggerReason` telemetry. Null when no primary
   * call was made (e.g. fetch-failed recovery branch) or the call
   * succeeded. NEVER influences eligibility — only labels the reason.
   */
  primaryGeminiErrorCode?: string | null;
}

export interface SearchFallbackResult {
  attempted: boolean;
  ok: boolean;
  /** ok AND the post-fallback re-merge produced a gate-passing prediction. */
  used: boolean;
  skipReason: SearchFallbackSkipReason | null;
  /**
   * Phase 1.8c.3b — populated iff `attempted === true`. Distinguishes the
   * three reasons the fallback fired. Null otherwise (pair with `skipReason`).
   */
  triggerReason: SearchFallbackTriggerReason | null;
  /** Set on attempted && !used. Either a Gemini error code or RECOVERY_GATE_FAILED. */
  error?: string;
  durationMs?: number;
  /** Present iff `used`. */
  mergedPredictions?: V2Predictions;
  mergeDiag?: MergeDiagnostics;
  geminiPred?: GeminiRawPrediction;
  /** Raw Gemini result on attempted calls (used for refreshed gemini block). */
  geminiResult?: GeminiResult;
}

function computeTriggerReason(
  primaryGeminiErrorCode: string | null | undefined,
): SearchFallbackTriggerReason {
  if (primaryGeminiErrorCode === "GEMINI_INVALID_SHAPE") return "invalid_shape";
  if (primaryGeminiErrorCode && primaryGeminiErrorCode.length > 0) return "transport_error";
  return "recovery_gate";
}

export async function maybeRunGeminiSearchFallback(
  args: SearchFallbackArgs,
  deps: SearchFallbackDeps,
): Promise<SearchFallbackResult> {
  const now = deps.now ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? SEARCH_FALLBACK_TIMEOUT_MS;
  const bufferMs = deps.budgetBufferMs ?? SEARCH_FALLBACK_BUDGET_BUFFER_MS;

  // ─── Skip-reason precedence ────────────────────────────────────────────
  if (args.currentMerged !== null) {
    return { attempted: false, ok: false, used: false, skipReason: "prior_prediction_valid", triggerReason: null };
  }
  if (args.primaryGeminiPred !== null) {
    return { attempted: false, ok: false, used: false, skipReason: "primary_gemini_succeeded", triggerReason: null };
  }
  if (!args.geminiConfigured) {
    return { attempted: false, ok: false, used: false, skipReason: "gemini_not_configured", triggerReason: null };
  }
  const remainingMs = args.totalBudgetMs - args.elapsedMs;
  if (remainingMs < timeoutMs + bufferMs) {
    return { attempted: false, ok: false, used: false, skipReason: "budget_exhausted", triggerReason: null };
  }

  const triggerReason = computeTriggerReason(args.primaryGeminiErrorCode);

  // ─── Run the fallback ──────────────────────────────────────────────────
  const start = now();
  const gem = await deps.geminiInvoker({
    safeUrl: args.safeUrl,
    evidenceBaseUrl: args.evidenceBaseUrl,
    extractMetadata: args.extractMetadata,
    usedFirecrawl: args.usedFirecrawl,
    timeoutMs,
  });
  const durationMs = now() - start;

  if (!gem.ok) {
    // Either not-configured (shouldn't happen — guarded above) or a Gemini
    // error. Surface the code; caller preserves original failure context.
    const code = (gem as { configured?: boolean; code?: string }).configured
      ? (gem as { code: string }).code
      : "GEMINI_NOT_CONFIGURED";
    return {
      attempted: true,
      ok: false,
      used: false,
      skipReason: null,
      triggerReason,
      error: code,
      durationMs,
      geminiResult: gem,
    };
  }

  // Fallback returned a parsed prediction; re-merge with the existing
  // extractor predictions (which may be null or weak).
  const reMerge = deps.applyMerge(
    args.extractPredictions,
    gem.prediction,
    args.mergeFlags,
  );
  if (!reMerge.predictions) {
    return {
      attempted: true,
      ok: true,
      used: false,
      skipReason: null,
      triggerReason,
      error: "RECOVERY_GATE_FAILED",
      durationMs,
      geminiResult: gem,
      geminiPred: gem.prediction,
    };
  }

  return {
    attempted: true,
    ok: true,
    used: true,
    skipReason: null,
    triggerReason,
    durationMs,
    mergedPredictions: reMerge.predictions,
    mergeDiag: reMerge.mergeDiag,
    geminiPred: gem.prediction,
    geminiResult: gem,
  };
}
