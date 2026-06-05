// Phase 2 scaffold contract for analyze-entity-url-v2.
//
// This module is the single source of truth for the V2 request/response
// envelope. Phase 3+ should import from here rather than redefining shapes.
//
// NOTE: `metadata.phase` and `metadata.stage` are DIAGNOSTIC-ONLY fields.
// They are useful in logs/responses during rollout, but downstream code
// (routing, UI, future extraction phases) MUST NOT branch on them.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const EXTRACTION_VERSION = "v2" as const;
export const EDGE_FUNCTION_NAME = "analyze-entity-url-v2" as const;

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
  predictions: null | Record<string, unknown>;
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
