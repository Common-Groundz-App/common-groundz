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
import {
  runFirecrawlScrape,
  safeBaseUrl,
  HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS,
  HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS,
} from "./firecrawl.ts";
import { extractFromFirecrawl } from "./firecrawl_recovery.ts";
import {
  chooseEvidenceBaseUrl,
  runGeminiJsonMode,
  type GeminiResult,
  type GeminiWarningCode,
} from "./gemini.ts";
import { buildV2Prompts } from "./prompt-generator-v2.ts";
import {
  mergePredictions,
  passesRecoveryGate,
  type MergeDiagnostics,
  type MergeFlags,
} from "./merge.ts";
import { resolveCategory } from "./category_resolver.ts";
import { safeAbsoluteUrl } from "./extractor.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";
import type { ExtractMetadata, V2Predictions } from "./schema.ts";

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

/**
 * Phase 7: run Gemini and produce the metadata.gemini block + any warning
 * code to push on success responses. On error-path callers, only the result
 * is needed (for logs) — they discard the metadata block.
 */
async function invokeGemini(args: {
  url: string;
  html: string;
  evidenceBaseUrl: string;
  extractMetadata: ExtractResult["metadata"];
}): Promise<GeminiResult> {
  const { systemPrompt, userPrompt } = buildV2Prompts(
    {
      url: args.url,
      evidenceBaseUrl: args.evidenceBaseUrl,
      rawHtml: args.html ?? null,
      extractMetadata: args.extractMetadata,
    },
    args.evidenceBaseUrl,
  );
  return await runGeminiJsonMode({
    systemPrompt,
    userPrompt,
    evidenceBaseUrl: args.evidenceBaseUrl,
  });
}

type GeminiMetadataBlock = NonNullable<V2SuccessResponse["metadata"]["gemini"]>;

function geminiSuccessBlock(gem: Extract<GeminiResult, { ok: true }>): GeminiMetadataBlock {
  const fc = gem.prediction.field_confidence ?? {};
  const fcKeys = Object.keys(fc);
  let produced = 0;
  if (gem.prediction.name) produced++;
  if (gem.prediction.description) produced++;
  if (gem.prediction.image_url) produced++;
  if (gem.prediction.images.length > 0) produced++;
  if (gem.prediction.additional_data?.brand) produced++;
  if (gem.prediction.additional_data?.price != null) produced++;
  return {
    used: true,
    model: gem.model,
    duration_ms: gem.durationMs,
    used_url_context: gem.grounding.used_url_context,
    used_google_search: gem.grounding.used_google_search,
    url_context_failed: gem.grounding.url_context_failed,
    url_retrieval_statuses: gem.grounding.url_retrieval_statuses,
    produced_fields: produced,
    field_confidence_present: fcKeys.length > 0,
  };
}

function geminiFailureBlock(
  gem: Extract<GeminiResult, { ok: false; configured: true }>,
): GeminiMetadataBlock {
  return {
    used: false,
    model: gem.model,
    duration_ms: gem.durationMs,
    error_code: gem.code,
    used_url_context: gem.grounding?.used_url_context,
    used_google_search: gem.grounding?.used_google_search,
    url_context_failed: gem.grounding?.url_context_failed,
    url_retrieval_statuses: gem.grounding?.url_retrieval_statuses,
  };
}

// ─── Phase 8 helpers ──────────────────────────────────────────────────────

const EMPTY_EXTRACT_METADATA: ExtractMetadata = {
  has_jsonld: false,
  jsonld_blocks: 0,
  has_og: false,
  has_twitter: false,
  sources: [],
  mapped_type: null,
  confidence: null,
  weak_signals: true,
};

function pickMetaString(
  m: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!m) return null;
  const lower: Record<string, string> = {};
  for (const k of Object.keys(m)) lower[k.toLowerCase()] = k;
  for (const want of keys) {
    const real = lower[want.toLowerCase()];
    if (!real) continue;
    const v = m[real];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) return item.trim();
      }
    }
  }
  return null;
}

function deriveFirecrawlSignals(
  metadata: Record<string, unknown> | null | undefined,
  baseUrl: string,
): { firecrawlImageUrl: string | null; firecrawlCurrency: string | null } {
  const imgRaw = pickMetaString(metadata, ["og:image", "ogImage", "twitter:image"]);
  const firecrawlImageUrl = imgRaw ? safeAbsoluteUrl(imgRaw, baseUrl) : null;
  const curRaw = pickMetaString(metadata, ["product:price:currency", "og:price:currency"]);
  const firecrawlCurrency = curRaw ? curRaw.toUpperCase() : null;
  return { firecrawlImageUrl, firecrawlCurrency };
}

/**
 * Run merge + category resolution. Returns the final predictions (possibly
 * null on recovery-gate failure) plus the merge diagnostics block.
 */
function applyMerge(
  extract: V2Predictions | null,
  geminiPred: GeminiRawPrediction | null,
  flags: MergeFlags,
): { predictions: V2Predictions | null; mergeDiag: MergeDiagnostics } {
  const { predictions, diagnostics } = mergePredictions({
    extract,
    gemini: geminiPred,
    flags,
  });
  if (predictions) {
    const resolved = resolveCategory({
      type: predictions.type,
      suggested_category_path: predictions.suggested_category_path,
    });
    predictions.category_id = resolved.category_id;
    predictions.matched_category_name = resolved.matched_category_name;
  }
  return { predictions, mergeDiag: diagnostics };
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
    const geminiConfigured = !!Deno.env.get("GEMINI_API_KEY");
    const priority: "high" | "normal" = isKnownJsHeavyHost(safe.url) ? "high" : "normal";

    // === Safe fetch ===
    let fetchResult: FetchResult;
    try {
      fetchResult = await validateAndFetchUrl(safe.url, { resolveDns });
    } catch (e) {
      if (!(e instanceof FetchError)) throw e;

      // Log code only — never URL, headers, body, or internal reason.
      console.warn("[analyze-entity-url-v2] fetch failed", { code: e.code });

      // Phase 8: fetch-failure recovery (Firecrawl + Gemini).
      let recExtract: ExtractResult | null = null;
      let recHtml = "";
      let recEvidenceBaseUrl = safe.url;
      let recPriceConflict = false;
      let recFirecrawlImageUrl: string | null = null;
      let recFirecrawlCurrency: string | null = null;
      let recFirecrawlBlock: V2SuccessResponse["metadata"]["firecrawl"] | undefined;
      let recWarnings: string[] = [];
      let recFirecrawlOk = false;
      let recFcDurationMs: number | undefined;

      if (FETCH_FAILED_ELIGIBLE.has(e.code) && firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, {
          fallbackBaseUrl: safe.url,
          ...(priority === "high"
            ? {
                apiTimeoutMs: HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS,
                timeoutMs: HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS,
              }
            : {}),
        });
        recFcDurationMs = fc.durationMs;
        if (fc.ok) {
          recFirecrawlOk = true;
          const base = safeBaseUrl(fc.finalUrl, safe.url);
          recEvidenceBaseUrl = base;
          recHtml = fc.html;
          let candidate = extractFromHtml(fc.html, base);
          if (candidate.predictions === null) {
            const recovered = extractFromFirecrawl({
              metadata: fc.metadata,
              markdown: fc.markdown,
              finalUrl: base,
            });
            recPriceConflict = recovered.diagnostics.price_conflict;
            if (recovered.result.predictions !== null) {
              candidate = recovered.result;
              console.log("[analyze-entity-url-v2] firecrawl recovery succeeded", {
                html_present: fc.html.length > 0,
                markdown_present: fc.markdown !== null,
                metadata_present: fc.metadata !== null,
                html_bytes: fc.html.length,
                markdown_bytes: fc.markdown?.length ?? 0,
                metadata_key_count: fc.metadata ? Object.keys(fc.metadata).length : 0,
                durationMs: fc.durationMs,
                recovered_type: recovered.result.predictions?.type ?? null,
              });
              console.log("[analyze-entity-url-v2] firecrawl recovery diagnostics", recovered.diagnostics);
            }
          }
          if (candidate.predictions !== null) {
            recExtract = candidate;
            for (const w of candidate.warnings) {
              if (!recWarnings.includes(w)) recWarnings.push(w);
            }
          } else {
            console.warn("[analyze-entity-url-v2] firecrawl recovery failed: weak extraction", {
              code: e.code,
              durationMs: fc.durationMs,
            });
          }
          const signals = deriveFirecrawlSignals(fc.metadata, base);
          recFirecrawlImageUrl = signals.firecrawlImageUrl;
          recFirecrawlCurrency = signals.firecrawlCurrency;
          recFirecrawlBlock = {
            used: recExtract !== null,
            priority,
            duration_ms: fc.durationMs,
            improved: recExtract !== null,
          };
        } else {
          console.warn("[analyze-entity-url-v2] firecrawl call failed on fetch recovery", {
            code: fc.code,
            status: fc.status,
            durationMs: fc.durationMs,
          });
          recFirecrawlBlock = {
            used: false,
            priority,
            duration_ms: fc.durationMs,
            error_code: fc.code,
          };
          recWarnings.push(fc.code);
        }
      }

      // Phase 8: invoke Gemini on the recovery path (not just diagnostics).
      let recGeminiBlock: GeminiMetadataBlock | undefined;
      let recGeminiPred: GeminiRawPrediction | null = null;
      if (geminiConfigured) {
        const evidenceBaseUrl = chooseEvidenceBaseUrl({
          firecrawlFinalUrl: recFirecrawlOk ? recEvidenceBaseUrl : null,
          fetchFinalUrl: null,
          safeUrl: safe.url,
        });
        const gem = await invokeGemini({
          url: safe.url,
          html: recHtml,
          evidenceBaseUrl,
          extractMetadata: recExtract?.metadata ?? EMPTY_EXTRACT_METADATA,
        });
        if (gem.ok) {
          recGeminiBlock = geminiSuccessBlock(gem);
          recGeminiPred = gem.prediction;
        } else if (gem.configured) {
          recGeminiBlock = geminiFailureBlock(gem);
          recWarnings.push(gem.code satisfies GeminiWarningCode);
        }
      } else {
        recWarnings.push("GEMINI_NOT_CONFIGURED" satisfies GeminiWarningCode);
      }

      // Phase 8: merge.
      const recFlags: MergeFlags = {
        priceConflict: recPriceConflict,
        firecrawlCurrency: recFirecrawlCurrency,
        firecrawlImageUrl: recFirecrawlImageUrl,
      };
      const { predictions: recMerged, mergeDiag: recMergeDiag } = applyMerge(
        recExtract?.predictions ?? null,
        recGeminiPred,
        recFlags,
      );

      if (recMerged) {
        const response: V2SuccessResponse = {
          success: true,
          predictions: recMerged,
          metadata: {
            analyzed_url: safe.url,
            normalized_url: safe.url,
            extraction_version: EXTRACTION_VERSION,
            edge_function: EDGE_FUNCTION_NAME,
            method: "exact-page",
            timestamp: new Date().toISOString(),
            used_url_context: recGeminiBlock?.used_url_context ?? false,
            used_google_search: recGeminiBlock?.used_google_search ?? false,
            used_firecrawl: recFirecrawlOk,
            phase: 8,
            stage: recExtract ? "firecrawl-recovered" : "gemini-recovered",
            ...(recExtract ? { extract: recExtract.metadata } : {}),
            ...(recFirecrawlBlock ? { firecrawl: recFirecrawlBlock } : {}),
            ...(recGeminiBlock ? { gemini: recGeminiBlock } : {}),
            merge: recMergeDiag,
          },
          warnings: recWarnings.length > 0 ? recWarnings : undefined,
        };
        return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
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
    let finalHtmlForGemini: string = fetchResult.bodyText;
    let finalEvidenceBaseUrl: string = fetchResult.finalUrl;

    const ws = detectWeakSignals(extract);
    if (ws.weak) {
      if (firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, {
          fallbackBaseUrl: safe.url,
          ...(priority === "high"
            ? {
                apiTimeoutMs: HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS,
                timeoutMs: HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS,
              }
            : {}),
        });
        if (fc.ok) {
          const base = safeBaseUrl(fc.finalUrl, safe.url);
          let extract2 = extractFromHtml(fc.html, base);
          let better = isStrictlyBetter(extract2, extract);
          let recoveryUsed = false;
          let recoveryDiagnostics: ReturnType<typeof extractFromFirecrawl>["diagnostics"] | null = null;
          if (!better) {
            const recovered = extractFromFirecrawl({
              metadata: fc.metadata,
              markdown: fc.markdown,
              finalUrl: base,
            });
            recoveryDiagnostics = recovered.diagnostics;
            if (
              recovered.result.predictions !== null &&
              (extract.predictions === null ||
                extract.metadata.weak_signals === true)
            ) {
              extract2 = recovered.result;
              better = true;
              recoveryUsed = true;
            }
          }
          if (better) {
            extract = extract2;
            usedFirecrawl = true;
            finalHtmlForGemini = fc.html;
            finalEvidenceBaseUrl = base;
            firecrawlBlock = {
              used: true,
              priority,
              duration_ms: fc.durationMs,
              improved: true,
            };
            for (const w of extract2.warnings) {
              if (!warnings.includes(w)) warnings.push(w);
            }
            if (recoveryUsed) {
              console.log("[analyze-entity-url-v2] firecrawl recovery succeeded", {
                html_present: fc.html.length > 0,
                markdown_present: fc.markdown !== null,
                metadata_present: fc.metadata !== null,
                html_bytes: fc.html.length,
                markdown_bytes: fc.markdown?.length ?? 0,
                metadata_key_count: fc.metadata ? Object.keys(fc.metadata).length : 0,
                durationMs: fc.durationMs,
                recovered_type: extract2.predictions?.type ?? null,
              });
              if (recoveryDiagnostics) {
                console.log("[analyze-entity-url-v2] firecrawl recovery diagnostics", recoveryDiagnostics);
              }
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

    // === Phase 7: Gemini trigger ===
    // Eligible when extract is weak/null OR Firecrawl was involved.
    // Strong direct successes skip Gemini.
    const wsFinal = detectWeakSignals(extract);
    const geminiEligible =
      extract.predictions === null || wsFinal.weak || usedFirecrawl;
    let geminiBlock: GeminiMetadataBlock | undefined;
    if (geminiEligible) {
      if (geminiConfigured) {
        const evidenceBaseUrl = chooseEvidenceBaseUrl({
          firecrawlFinalUrl: usedFirecrawl ? finalEvidenceBaseUrl : null,
          fetchFinalUrl: !usedFirecrawl ? fetchResult.finalUrl : null,
          safeUrl: safe.url,
        });
        const gem = await invokeGemini({
          url: safe.url,
          html: finalHtmlForGemini,
          evidenceBaseUrl,
          extractMetadata: extract.metadata,
        });
        if (gem.ok) {
          geminiBlock = geminiSuccessBlock(gem);
        } else if (gem.configured) {
          geminiBlock = geminiFailureBlock(gem);
          (warnings as string[]).push(gem.code satisfies GeminiWarningCode);
        }
      } else {
        (warnings as string[]).push(
          "GEMINI_NOT_CONFIGURED" satisfies GeminiWarningCode,
        );
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
        used_url_context: geminiBlock?.used_url_context ?? false,
        used_google_search: geminiBlock?.used_google_search ?? false,
        used_firecrawl: usedFirecrawl,
        phase: 7,
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
        ...(geminiBlock ? { gemini: geminiBlock } : {}),
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("[analyze-entity-url-v2] unhandled error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Internal error");
  }
});
