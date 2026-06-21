// Phase 2 scaffold contract for analyze-entity-url-v2.
//
// This module is the single source of truth for the V2 request/response
// envelope. Phase 3+ should import from here rather than redefining shapes.
//
// NOTE: `metadata.phase` and `metadata.stage` are DIAGNOSTIC-ONLY fields.
// They are useful in logs/responses during rollout, but downstream code
// (routing, UI, future extraction phases) MUST NOT branch on them.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { CanonicalEntityType } from "../_shared/entityTypes.ts";
import type { GeminiErrorCode } from "./gemini.ts";

export const EXTRACTION_VERSION = "v2" as const;
export const EDGE_FUNCTION_NAME = "analyze-entity-url-v2" as const;

/** V1-compatible prediction shape. Phase 5 always emits a Phase-5
 *  ExactPageExtractableType in `type`. `category_id` and
 *  `matched_category_name` stay null until Phase-6 category resolution. */
export interface V2Predictions {
  type: CanonicalEntityType;
  name: string;
  description: string | null;
  /** Phase 8+: resolved root-level category UUID, or null when unresolved. */
  category_id: string | null;
  /** RAW schema.org @type or og:type verbatim (e.g. "Product", "TVSeries",
   *  "video.movie"). Never a fabricated taxonomy path. */
  suggested_category_path: string | null;
  /** Phase 8+: human-readable root category name, or null when unresolved. */
  matched_category_name: string | null;
  tags: string[];
  confidence: number;
  reasoning: string;
  image_url: string | null;
  images: Array<{ url: string }>;
  additional_data: Record<string, unknown>;
}

export interface ExtractMetadata {
  has_jsonld: boolean;
  jsonld_blocks: number;
  has_og: boolean;
  has_twitter: boolean;
  sources: string[];
  mapped_type: CanonicalEntityType | null;
  confidence: number | null;
  weak_signals: boolean;
}


export const MAX_URL_LENGTH = 2048;

/** Zod schema for the V2 request body. */
export const V2RequestSchema = z.object({
  url: z
    .string()
    .min(1, "url is required")
    .max(MAX_URL_LENGTH, `url must be at most ${MAX_URL_LENGTH} characters`)
    .refine((s) => {
      try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "url must be a valid http(s) URL"),
});

export type V2Request = z.infer<typeof V2RequestSchema>;

export type V2ErrorCode =
  | "MISSING_AUTH"
  | "INVALID_TOKEN"
  | "NOT_ADMIN"
  | "METHOD_NOT_ALLOWED"
  | "INVALID_JSON"
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "DNS_RESOLUTION_FAILED"
  | "INTERNAL_ERROR"
  // Phase 4B safe-fetch error codes
  | "FETCH_TIMEOUT"
  | "FETCH_TOO_LARGE"
  | "FETCH_TOO_MANY_REDIRECTS"
  | "FETCH_BAD_CONTENT_TYPE"
  | "FETCH_BAD_STATUS"
  | "FETCH_NETWORK_ERROR";

export interface V2SuccessResponse {
  success: true;
  predictions: V2Predictions | null;
  metadata: {
    /** Per-invocation correlation id; matches server-side analysis_trace log. */
    request_id: string;
    analyzed_url: string;
    /** Phase 4A+: normalized form of analyzed_url. Additive. */
    normalized_url?: string;
    extraction_version: typeof EXTRACTION_VERSION;
    edge_function: typeof EDGE_FUNCTION_NAME;
    method: string;
    timestamp: string;
    used_url_context: boolean;
    used_google_search: boolean;
    used_firecrawl: boolean;
    /** Diagnostic-only. Do not branch on this. */
    phase?: number;
    /** Diagnostic-only. Do not branch on this. */
    stage?: string;
    /**
     * Phase 4B+: minimal fetch summary. Additive. INTERNAL fields
     * (bodyText, redirectChain) are deliberately excluded.
     *
     * Presence rule (Phase 6): present only when direct safe-fetch completed
     * successfully. Omitted when Firecrawl recovered the entity after a
     * direct-fetch failure — see metadata.firecrawl for that case.
     */
    fetch?: {
      final_url: string;
      status: number;
      content_type: string;
      bytes: number;
      redirect_count: number;
      duration_ms: number;
    };
    /**
     * Phase 5+: deterministic exact-page extract metadata. Additive.
     * Always reflects the FINAL extraction source (may be Firecrawl-based
     * when metadata.firecrawl.improved === true).
     */
    extract?: ExtractMetadata;
    /**
     * Phase 6+: Firecrawl fallback diagnostics. Additive.
     * `used` is true iff Firecrawl HTML supplied the final extraction.
     * `improved` is true iff Firecrawl replaced a weaker direct result or
     * recovered a failed direct fetch. `error_code` is set only when the
     * Firecrawl call failed; warning codes also surface in `warnings[]`.
     */
    firecrawl?: {
      used: boolean;
      priority: "high" | "normal";
      duration_ms?: number;
      error_code?: string;
      improved?: boolean;
    };
    /**
     * Phase 7+: Gemini URL Context + Google Search diagnostics. Additive.
     * Present only when Gemini was eligible and called on a success path.
     * NEVER emitted on V2ErrorResponse. Raw Gemini predictions are NOT
     * exposed on the wire in Phase 7 (Phase 8 will merge into predictions).
     */
    gemini?: {
      used: boolean;
      model?: string;
      duration_ms?: number;
      used_url_context?: boolean;
      used_google_search?: boolean;
      url_context_failed?: boolean;
      url_retrieval_statuses?: string[];
      error_code?: GeminiErrorCode;
      produced_fields?: number;
      field_confidence_present?: boolean;
      /**
       * Search-only fallback diagnostics. Additive; populated only when
       * the recovery path evaluated the last-resort fallback (whether or
       * not it actually ran). `skip_reason` is one of:
       *   "prior_prediction_valid" | "not_recovery_path" |
       *   "firecrawl_succeeded" | "primary_gemini_succeeded" |
       *   "budget_exhausted" | null
       * Precedence is top-down (first match wins). `null` means the
       * fallback actually ran. Never branch on these fields.
       */
      search_fallback_attempted?: boolean;
      search_fallback_ok?: boolean;
      search_fallback_skip_reason?: string | null;
      /**
       * Phase 1.8c.3b — populated iff `search_fallback_attempted === true`.
       * One of: "invalid_shape" | "transport_error" | "recovery_gate" | null.
       * Never branch on this field; diagnostic only.
       */
      search_fallback_trigger_reason?: string | null;
      search_fallback_error?: GeminiErrorCode;
      search_fallback_duration_ms?: number;
      /**
       * Phase 1.6: Amazon ASIN exact-match guard diagnostics. Additive;
       * present only when the analyzed URL is an Amazon product URL whose
       * ASIN could be extracted. Booleans + reason string only — never the
       * raw ASIN, prompt, response, HTML, image URLs, or any secret.
       */
      amazon_asin_present?: boolean;
      grounding_contains_target_asin?: boolean;
      grounding_contains_canonical_dp_url?: boolean;
      amazon_exact_match_verified?: boolean;
      amazon_exact_match_reject_reason?: string | null;
      /**
       * Phase 1.7: page-signal identity anchor diagnostics. Booleans and
       * reason codes only — never raw page text, URLs, or HTML.
       */
      page_title_anchor_present?: boolean;
      page_title_match_verified?: boolean | null;
      page_title_match_skip_reason?: string | null;
      page_title_anchor_reject_reason?: string | null;
      amazon_canonical_asin_mismatch?: boolean;
      amazon_identity_verified_via?: "external_grounding" | "page_title_anchor" | "both" | null;
    };
    /**
     * Final source of the returned predictions. Free-form string for
     * observability only. Examples: "extractor_merge", "firecrawl_merge",
     * "firecrawl_recovery", "gemini_recovery", "gemini_search_fallback",
     * "none". Diagnostic-only; do not branch on it.
     */
    final_prediction_source?: string;

    /**
     * Phase 8+: merge diagnostics. Present when mergePredictions ran.
     * Additive; downstream code MUST NOT branch on it.
     */
    merge?: {
      path: "success" | "recovery";
      gemini_used: boolean;
      gemini_fields_used: number;
      field_winners: {
        type: "extractor" | "gemini" | "none";
        name: "extractor" | "gemini" | "none";
        description: "extractor" | "gemini" | "none";
        image_url: "extractor" | "gemini" | "firecrawl" | "none";
        brand: "extractor" | "gemini" | "none";
        price: "extractor" | "gemini" | "none";
        currency: "extractor" | "gemini" | "firecrawl" | "none";
        tags: "extractor" | "gemini" | "merged" | "none";
      };
      name_junk_override_applied: boolean;
      price_conflict_blocked_gemini: boolean;
      recovery_gate_passed?: boolean;
      /** Phase 8.1A: internal honesty signal for pricing.price_source. */
      price_source_used?: "exact" | "inferred" | "unknown";
    };
    /**
     * Phase 8.1A+: additive pricing summary. Mirrors the
     * additional_data.pricing block. Diagnostic-only; never branch on it.
     */
    pricing?: {
      source:
        | "extractor_jsonld_offer"
        | "extractor_meta_og"
        | "firecrawl_metadata"
        | "firecrawl_markdown_single"
        | "gemini"
        | "unknown"
        | "omitted"
        | "extractor_jsonld_aggregate"
        | "extractor_jsonld_offers_merged_range"
        | "extractor_jsonld_offers_selected"
        | "firecrawl_markdown_list_sale";
      confidence: number;
      conflict: boolean;
      has_range: boolean;
      has_list_sale: boolean;
      gemini_diagnostic_only: boolean;
      /** Phase 8.1B: mixed-currency Offer[] diagnostic. */
      range_conflict: boolean;
      price_source_used?: "exact" | "inferred" | "unknown";
    };
  };
  warnings?: string[];
}

export interface V2ErrorResponse {
  success: false;
  /** Always a human-readable string. Use `details` for structured info. */
  error: string;
  code: V2ErrorCode;
  details?: unknown;
  /** Per-invocation correlation id; matches server-side analysis_trace log. */
  request_id?: string;
}
