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

export const EXTRACTION_VERSION = "v2" as const;
export const EDGE_FUNCTION_NAME = "analyze-entity-url-v2" as const;

/** V1-compatible prediction shape. Phase 5 always emits a Phase-5
 *  ExactPageExtractableType in `type`. `category_id` and
 *  `matched_category_name` stay null until Phase-6 category resolution. */
export interface V2Predictions {
  type: CanonicalEntityType;
  name: string;
  description: string | null;
  category_id: null;
  /** RAW schema.org @type or og:type verbatim (e.g. "Product", "TVSeries",
   *  "video.movie"). Never a fabricated taxonomy path. */
  suggested_category_path: string | null;
  matched_category_name: null;
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
     */
    fetch?: {
      final_url: string;
      status: number;
      content_type: string;
      bytes: number;
      redirect_count: number;
      duration_ms: number;
    };
    /** Phase 5+: deterministic exact-page extract metadata. Additive. */
    extract?: ExtractMetadata;
  };
  warnings?: string[];
}

export interface V2ErrorResponse {
  success: false;
  /** Always a human-readable string. Use `details` for structured info. */
  error: string;
  code: V2ErrorCode;
  details?: unknown;
}
