// Phase 6: analyze-entity-url-v2
//
// Adds a narrow Firecrawl fallback after Phase 5:
//   - direct safe-fetch failed with an eligible non-SSRF code, OR
//   - extractor returned predictions === null, OR
//   - extractor returned metadata.weak_signals === true.
//
// Strict fetch-failure contract: a failed direct fetch only becomes 200
// success when Firecrawl extraction yields predictions !== null. Otherwise
// the original fetch error is returned unchanged.
//
// SSRF rejects (BLOCKED_HOST / INVALID_URL / DNS_RESOLUTION_FAILED) NEVER
// call Firecrawl. V1 (`analyze-entity-url`) is untouched.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EDGE_FUNCTION_NAME,
  EXTRACTION_VERSION,
  V2RequestSchema,
  type V2ErrorCode,
  type V2ErrorResponse,
  type V2SuccessResponse,
} from "./schema.ts";
import { assertSafeUrl, SsrfError } from "./ssrf.ts";
import { FetchError, type FetchResult, validateAndFetchUrl } from "./fetcher.ts";
import { extractFromHtml, type ExtractResult } from "./extractor.ts";
import { detectWeakSignals } from "./weak_signals.ts";
import { isKnownJsHeavyHost } from "./host_hints.ts";
import { runFirecrawlScrape, safeBaseUrl } from "./firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const FETCH_FAILED_ELIGIBLE = new Set([
  "FETCH_BAD_STATUS",
  "FETCH_TIMEOUT",
  "FETCH_NETWORK_ERROR",
  "FETCH_BAD_CONTENT_TYPE",
  "FETCH_TOO_LARGE",
  "FETCH_TOO_MANY_REDIRECTS",
]);

function errorResponse(
  status: number,
  code: V2ErrorCode,
  error: string,
  details?: unknown,
): Response {
  const body: V2ErrorResponse = { success: false, error, code };
  if (details !== undefined) body.details = details;
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function httpStatusFor(code: V2ErrorCode): number {
  switch (code) {
    case "FETCH_TIMEOUT": return 504;
    case "FETCH_TOO_LARGE": return 413;
    case "FETCH_BAD_CONTENT_TYPE": return 415;
    case "FETCH_TOO_MANY_REDIRECTS": return 400;
    case "FETCH_BAD_STATUS": return 502;
    case "FETCH_NETWORK_ERROR": return 502;
    case "BLOCKED_HOST": return 400;
    case "INVALID_URL": return 400;
    case "DNS_RESOLUTION_FAILED": return 503;
    default: return 500;
  }
}

function humanMessageFor(code: V2ErrorCode): string {
  switch (code) {
    case "FETCH_TIMEOUT": return "Request timed out";
    case "FETCH_TOO_LARGE": return "Response too large";
    case "FETCH_BAD_CONTENT_TYPE": return "Unsupported content type";
    case "FETCH_TOO_MANY_REDIRECTS": return "Too many redirects";
    case "FETCH_BAD_STATUS": return "Upstream returned an error status";
    case "FETCH_NETWORK_ERROR": return "Network error fetching URL";
    case "BLOCKED_HOST": return "URL is not allowed";
    case "INVALID_URL": return "Invalid URL";
    case "DNS_RESOLUTION_FAILED": return "Could not resolve host";
    default: return "Internal error";
  }
}

/**
 * Phase-6 narrow improvement check: only counts as improvement when Firecrawl
 * turns a null prediction into a real one, or clears the weak_signals flag.
 */
function isStrictlyBetter(b: ExtractResult, a: ExtractResult): boolean {
  if (a.predictions === null && b.predictions !== null) return true;
  if (a.metadata.weak_signals === true && b.metadata.weak_signals === false) {
    return true;
  }
  return false;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // Method gate
    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }

    // === Auth gate (mirrors V1) ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "MISSING_AUTH", "Unauthorized");
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse(401, "INVALID_TOKEN", "Unauthorized");
    }

    const userId = claimsData.claims.sub;

    // === Admin check via service_role ===
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: isAdmin, error: roleError } = await supabaseService.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return errorResponse(403, "NOT_ADMIN", "Forbidden");
    }

    // === Body parse ===
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Invalid JSON body");
    }

    // === Zod validation ===
    const parsed = V2RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(
        400,
        "INVALID_URL",
        "Invalid request",
        parsed.error.flatten(),
      );
    }

    const { url } = parsed.data;

    // === Phase 4B: mandatory DNS gate ===
    // deno-lint-ignore no-explicit-any
    const resolveDns = (Deno as any).resolveDns?.bind(Deno);
    if (typeof resolveDns !== "function") {
      return errorResponse(503, "DNS_RESOLUTION_FAILED", "Could not resolve host");
    }

    // === SSRF preflight + normalization (early reject) ===
    let safe;
    try {
      safe = await assertSafeUrl(url, { resolveDns });
    } catch (e) {
      if (e instanceof SsrfError) {
        const msg = e.code === "BLOCKED_HOST"
          ? "URL is not allowed"
          : e.code === "DNS_RESOLUTION_FAILED"
            ? "Could not resolve host"
            : "Invalid URL";
        return errorResponse(400, e.code as V2ErrorCode, msg);
      }
      throw e;
    }

    const firecrawlConfigured = !!Deno.env.get("FIRECRAWL_API_KEY");
    const priority: "high" | "normal" = isKnownJsHeavyHost(safe.url) ? "high" : "normal";

    // === Safe fetch ===
    let fetchResult: FetchResult;
    try {
      fetchResult = await validateAndFetchUrl(safe.url, { resolveDns });
    } catch (e) {
      if (!(e instanceof FetchError)) throw e;

      // Log code only — never URL, headers, body, or internal reason.
      console.warn("[analyze-entity-url-v2] fetch failed", { code: e.code });

      // Phase 6: eligible fetch failures may be recovered by Firecrawl.
      if (FETCH_FAILED_ELIGIBLE.has(e.code) && firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, { fallbackBaseUrl: safe.url });
        if (fc.ok) {
          const base = safeBaseUrl(fc.finalUrl, safe.url);
          const extract = extractFromHtml(fc.html, base);
          if (extract.predictions !== null) {
            const response: V2SuccessResponse = {
              success: true,
              predictions: extract.predictions,
              metadata: {
                analyzed_url: safe.url,
                normalized_url: safe.url,
                extraction_version: EXTRACTION_VERSION,
                edge_function: EDGE_FUNCTION_NAME,
                method: "exact-page",
                timestamp: new Date().toISOString(),
                used_url_context: false,
                used_google_search: false,
                used_firecrawl: true,
                phase: 6,
                stage: "firecrawl-recovered",
                // metadata.fetch OMITTED — no successful direct safe-fetch.
                extract: extract.metadata,
                firecrawl: {
                  used: true,
                  priority,
                  duration_ms: fc.durationMs,
                  improved: true,
                },
              },
              warnings: extract.warnings.length > 0 ? extract.warnings : undefined,
            };
            return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
          }
          // Firecrawl returned HTML but extraction still null → fall through.
          console.warn("[analyze-entity-url-v2] firecrawl recovery failed: weak extraction", {
            code: e.code,
            durationMs: fc.durationMs,
          });
        } else {
          console.warn("[analyze-entity-url-v2] firecrawl call failed on fetch recovery", {
            code: fc.code,
            status: fc.status,
            durationMs: fc.durationMs,
          });
        }
      }

      // Strict contract: return the ORIGINAL fetch error unchanged.
      return errorResponse(
        httpStatusFor(e.code as V2ErrorCode),
        e.code as V2ErrorCode,
        humanMessageFor(e.code as V2ErrorCode),
      );
    }

    // === Phase 5 deterministic extraction on the direct-fetched HTML ===
    let extract = extractFromHtml(fetchResult.bodyText, fetchResult.finalUrl);
    const warnings: string[] = [...extract.warnings];
    let usedFirecrawl = false;
    let firecrawlBlock: V2SuccessResponse["metadata"]["firecrawl"] | undefined;

    const ws = detectWeakSignals(extract);
    if (ws.weak) {
      if (firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, { fallbackBaseUrl: safe.url });
        if (fc.ok) {
          const base = safeBaseUrl(fc.finalUrl, safe.url);
          const extract2 = extractFromHtml(fc.html, base);
          if (isStrictlyBetter(extract2, extract)) {
            extract = extract2;
            usedFirecrawl = true;
            firecrawlBlock = {
              used: true,
              priority,
              duration_ms: fc.durationMs,
              improved: true,
            };
            for (const w of extract2.warnings) {
              if (!warnings.includes(w)) warnings.push(w);
            }
          } else {
            firecrawlBlock = {
              used: true,
              priority,
              duration_ms: fc.durationMs,
              improved: false,
            };
            warnings.push("firecrawl_no_improvement");
          }
        } else {
          firecrawlBlock = {
            used: false,
            priority,
            duration_ms: fc.durationMs,
            error_code: fc.code,
          };
          warnings.push(fc.code);
          console.warn("[analyze-entity-url-v2] firecrawl call failed on weak recovery", {
            code: fc.code,
            status: fc.status,
            durationMs: fc.durationMs,
          });
        }
      } else {
        warnings.push("FIRECRAWL_NOT_CONFIGURED");
      }
    }

    const response: V2SuccessResponse = {
      success: true,
      predictions: extract.predictions,
      metadata: {
        analyzed_url: safe.url,
        normalized_url: safe.url,
        extraction_version: EXTRACTION_VERSION,
        edge_function: EDGE_FUNCTION_NAME,
        method: extract.predictions ? "exact-page" : "stub",
        timestamp: new Date().toISOString(),
        used_url_context: false,
        used_google_search: false,
        used_firecrawl: usedFirecrawl,
        phase: 6,
        stage: usedFirecrawl
          ? "firecrawl-improved"
          : extract.predictions
            ? "exact-page"
            : "weak-signals",
        fetch: {
          final_url: fetchResult.finalUrl,
          status: fetchResult.status,
          content_type: fetchResult.contentType,
          bytes: fetchResult.bytes,
          redirect_count: fetchResult.redirectChain.length - 1,
          duration_ms: fetchResult.durationMs,
        },
        extract: extract.metadata,
        ...(firecrawlBlock ? { firecrawl: firecrawlBlock } : {}),
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("[analyze-entity-url-v2] unhandled error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Internal error");
  }
});
