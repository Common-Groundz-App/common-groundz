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
import {
  isKnownJsHeavyHost,
  isStrictAmazonHost,
  canonicalizeAmazonUrl,
  extractAmazonPathSlug,
  extractAmazonAsin,
  sanitizeFallbackEvidenceUrl,
} from "./host_hints.ts";
import {
  runDualPathVerification,
  type AmazonGroundingEvidence,
  type DualPathDiagnostics,
  type PageSignalsForGuard,
} from "./amazon_asin_guard.ts";
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
  callGeminiSearchOnly,
  SEARCH_FALLBACK_TIMEOUT_MS,
  SEARCH_FALLBACK_BUDGET_BUFFER_MS,
  type GeminiResult,
  type GeminiGrounding,
  type GeminiWarningCode,
} from "./gemini.ts";

import { buildV2Prompts, buildV1StyleSearchFallbackPrompts } from "./prompt-generator-v2.ts";
import {
  mergePredictions,
  passesRecoveryGate,
  type MergeDiagnostics,
  type MergeFlags,
} from "./merge.ts";
import { resolveCategory } from "./category_resolver.ts";
import { safeAbsoluteUrl } from "./extractor.ts";
import { resolvePriceSourceHint, summarizePricing, type PricingBlock } from "./pricing.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";
import type { ExtractMetadata, V2Predictions } from "./schema.ts";
import {
  maybeRunGeminiSearchFallback,
  type SearchFallbackGeminiInvoker,
} from "./search_fallback.ts";
import {
  buildFinalization,
  createDefaultFinalization,
  type Finalization,
  type GuardTracker,
  makeGuardTracker,
} from "./finalization_telemetry.ts";
import {
  buildPageMetadataFallback,
  type PageMetadataFallbackDiagnostics,
} from "./page_metadata_fallback.ts";

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
  request_id?: string,
): Response {
  const body: V2ErrorResponse = { success: false, error, code };
  if (details !== undefined) body.details = details;
  if (request_id) body.request_id = request_id;
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

// ─── Telemetry: per-invocation analysis_trace ────────────────────────────
interface AnalysisTrace {
  request_id: string;
  path: "happy" | "fetch_recovery" | "weak_recovery" | "error";
  host: string | null;
  direct_fetch?: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    content_type?: string;
    bytes?: number;
    duration_ms?: number;
    error_code?: string;
    // Phase 1.8: maxBytes cap actually applied to this fetch (2 MiB default,
    // 4 MiB for strict Amazon hosts). Numbers only.
    max_bytes_used?: number;
  };
  deterministic_extract?: { ok: boolean; weak_signals: boolean };
  firecrawl?: {
    eligible: boolean;
    attempted: boolean;
    ok: boolean;
    duration_ms?: number;
    error_code?: string;
    skip_reason?: string;
  };
  gemini?: {
    attempted: boolean;
    ok: boolean;
    duration_ms?: number;
    error_code?: string;
    used_url_context?: boolean;
    used_google_search?: boolean;
    url_context_failed?: boolean;
    raw_text_length?: number;
    raw_text_sha8?: string;
  };
  merge?: { path: string; field_winners?: Record<string, string> };
  final: {
    prediction_source?: string;
    error_code: string;
    total_duration_ms: number;
  };
  // Phase 1.8c.1 — post-merge finalization telemetry.
  // Booleans, counts, and constrained enums only. NEVER raw model output,
  // page titles, brand names, product names, full URLs, or PII.
  finalization?: Finalization;
}

// Phase 1.8c.1 — finalization telemetry types/helpers live in a sibling
// module so unit tests can import them without triggering serve().


function makeTrace(request_id: string): AnalysisTrace {
  return {
    request_id,
    path: "error",
    host: null,
    final: { error_code: "UNKNOWN", total_duration_ms: 0 },
  };
}


function safeHost(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
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
  usedFirecrawl: boolean;
  searchOnly?: boolean;
  timeoutMs?: number;
  // Phase 1.7: forwarded real-page identity signals (Amazon-prioritized).
  pageSignals?: import("./extractor.ts").PageSignals | null;
}): Promise<GeminiResult> {
  // Phase A3: for Amazon URLs, send Gemini URL Context the canonical
  // /dp/<ASIN>/ URL (strips tracking junk). Preserve the original path slug
  // as untrusted evidence. Non-Amazon URLs are returned unchanged.
  const canonicalUrl = canonicalizeAmazonUrl(args.url);
  const amazonPathSlug = extractAmazonPathSlug(args.url);
  const amazonAsin = extractAmazonAsin(args.url);

  // Phase 1.8b: single-source Amazon predicate (host_hints.isStrictAmazonHost)
  // shared with the 4 MiB fetch cap and the minimal evidence packet. Drives
  // thinkingBudget: 0 on Amazon-only Gemini calls (primary + search fallback).
  let isAmazon = false;
  try {
    isAmazon = isStrictAmazonHost(new URL(args.url).hostname);
  } catch { /* malformed url → non-Amazon default */ }

  if (args.searchOnly) {
    const sanitizedUrl = sanitizeFallbackEvidenceUrl(canonicalUrl);
    let host: string | null = null;
    try {
      host = new URL(args.url).host || null;
    } catch {
      host = null;
    }
    const { systemPrompt, userPrompt } = buildV1StyleSearchFallbackPrompts({
      url: sanitizedUrl,
      host,
      amazonPathSlug,
      amazonAsin,
      mappedType: args.extractMetadata?.mapped_type ?? null,
    });
    return await callGeminiSearchOnly({
      systemPrompt,
      userPrompt,
      evidenceBaseUrl: sanitizedUrl ?? canonicalUrl,
      timeoutMs: args.timeoutMs,
      isAmazon,
    });
  }

  const promptBaseUrl =
    !args.usedFirecrawl && canonicalUrl !== args.url
      ? canonicalUrl
      : args.evidenceBaseUrl;

  // Phase 1.7: assemble pageSignals into V2Evidence. og_image is intentionally
  // NOT forwarded to the prompt to avoid bloat (kept on pageSignals only).
  const ps = args.pageSignals ?? null;
  const ogPayload: Record<string, string> = {};
  const twPayload: Record<string, string> = {};
  const jsonldPayload: unknown[] = [];
  let titleField: string | null = null;
  let descField: string | null = null;
  let canonicalField: string | null = null;
  if (ps) {
    if (ps.og_title) ogPayload.title = ps.og_title;
    if (ps.og_description) ogPayload.description = ps.og_description;
    if (ps.og_site_name) ogPayload.site_name = ps.og_site_name;
    if (ps.twitter_title) twPayload.title = ps.twitter_title;
    if (ps.twitter_description) twPayload.description = ps.twitter_description;
    if (ps.jsonld_product_name || ps.jsonld_brand) {
      const block: Record<string, unknown> = { "@type": "Product" };
      if (ps.jsonld_product_name) block.name = ps.jsonld_product_name;
      if (ps.jsonld_brand) block.brand = ps.jsonld_brand;
      jsonldPayload.push(block);
    }
    titleField = ps.title;
    descField = ps.og_description ?? ps.twitter_description ?? null;
    canonicalField = ps.canonical;
  }

  const promptOut = buildV2Prompts(
    {
      url: canonicalUrl,
      evidenceBaseUrl: promptBaseUrl,
      title: titleField,
      description: descField,
      canonical: canonicalField,
      og: Object.keys(ogPayload).length ? ogPayload : undefined,
      twitter: Object.keys(twPayload).length ? twPayload : undefined,
      jsonld: jsonldPayload.length ? jsonldPayload : undefined,
      rawHtml: args.html ?? null,
      extractMetadata: args.extractMetadata,
      amazonPathSlug,
      amazonAsin,
    },
    promptBaseUrl,
  );

  // Phase 1.8: emit one structured log line summarizing the evidence packet
  // selection. Booleans / enum labels / numbers only — no prompt text, no
  // prediction values, no PII.
  console.log("[analyze-entity-url-v2] gemini.evidence", {
    amazon_min_packet_used: promptOut.amazon_min_packet_used ?? false,
    raw_html_dropped_reason: promptOut.raw_html_dropped_reason ?? null,
    amazon_packet_oversize: promptOut.amazon_packet_oversize ?? false,
    evidence_truncated: promptOut.evidence_truncated,
    evidence_chars: promptOut.evidence_chars,
  });

  return await runGeminiJsonMode({
    systemPrompt: promptOut.systemPrompt,
    userPrompt: promptOut.userPrompt,
    evidenceBaseUrl: promptBaseUrl,
    isAmazon,
  });
}


// Search-only Gemini invoker for the shared fallback helper. Intentionally
// has NO `html` field — guarantees raw HTML can never reach the search-only
// prompt path (see search_fallback.ts and the sentinel test).
const searchOnlyGeminiInvoker: SearchFallbackGeminiInvoker = (a) =>
  invokeGemini({
    url: a.safeUrl,
    html: "",
    evidenceBaseUrl: a.evidenceBaseUrl,
    extractMetadata: a.extractMetadata,
    usedFirecrawl: a.usedFirecrawl,
    searchOnly: true,
    timeoutMs: a.timeoutMs,
  });

// ─── Search-only fallback configuration ──────────────────────────────────
// Total wall-clock budget for one analyze-entity-url-v2 request. Used to
// gate the last-resort search-only Gemini fallback so it never overruns
// the edge-function deadline. Conservative; well under Supabase's 50s cap.
const REQUEST_TOTAL_BUDGET_MS = 45_000;


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

/**
 * Phase 1.6 + 1.7: Amazon ASIN dual-path identity guard wrapper.
 *
 * Accepts a prediction if EITHER:
 *   - Path A: Gemini external grounding contains the target ASIN, OR
 *   - Path B: fetched-page title anchor (after bot-wall + canonical-ASIN
 *     filters) shares ≥ 1 distinctive token with the model's returned name.
 *
 * Rejects with AMAZON_NAME_PAGE_TITLE_MISMATCH when a usable anchor exists
 * with distinctive tokens and the model name does not overlap — fetched
 * page always wins. Returns Phase-1.6 reasons when both paths fail.
 *
 * Does NOT mutate `prediction_source`; identity-verification path is
 * surfaced only via diagnostics.amazon_identity_verified_via.
 */
function runAmazonAsinGuard(
  amazonAsin: string | null,
  grounding: GeminiGrounding | undefined,
  pageSignals: PageSignalsForGuard | null | undefined,
  modelName: string | null | undefined,
):
  | { ok: true; diagnostics: AmazonGuardDiagnostics }
  | { ok: false; reason: string; diagnostics: AmazonGuardDiagnostics } {
  const g = grounding;
  const evidence: AmazonGroundingEvidence = {
    chunkUris: g?.grounding_chunk_uris ?? [],
    chunkTitles: g?.grounding_chunk_titles ?? [],
    retrievedUrls: g?.url_context_retrieved_urls ?? [],
  };
  const verdict = runDualPathVerification({
    amazonAsin,
    groundingEvidence: evidence,
    pageSignals: pageSignals ?? null,
    modelName: modelName ?? null,
  });
  if (verdict.ok) return { ok: true, diagnostics: verdict.diagnostics };
  return {
    ok: false,
    reason: verdict.reason ?? "AMAZON_ASIN_GROUNDING_MISMATCH",
    diagnostics: verdict.diagnostics,
  };
}

type AmazonGuardDiagnostics = DualPathDiagnostics;

function mergeGuardDiagnostics(
  block: GeminiMetadataBlock | undefined,
  diag: AmazonGuardDiagnostics,
): GeminiMetadataBlock | undefined {
  if (!block) return block;
  return { ...block, ...diag };
}


// Phase 1.8c.1 — finalization helpers imported from finalization_telemetry.ts.







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

  const request_id = crypto.randomUUID();
  const t0 = Date.now();
  const trace = makeTrace(request_id);
  trace.finalization = createDefaultFinalization();
  // Phase 1.8c.1 — guard trackers, one per branch. Capture the LAST guard
  // call's outcome on each branch; suspect site for post-merge discard.
  const recGuardTracker: GuardTracker = makeGuardTracker();
  const mainGuardTracker: GuardTracker = makeGuardTracker();
  const respondError = (
    status: number,
    code: V2ErrorCode,
    msg: string,
    details?: unknown,
  ): Response => {
    trace.path = "error";
    trace.final.error_code = code;
    trace.final.total_duration_ms = Date.now() - t0;
    return errorResponse(status, code, msg, details, request_id);
  };


  try {
    // Method gate
    if (req.method !== "POST") {
      return respondError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }

    // === Auth gate (mirrors V1) ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respondError(401, "MISSING_AUTH", "Unauthorized");
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return respondError(401, "INVALID_TOKEN", "Unauthorized");
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
      return respondError(403, "NOT_ADMIN", "Forbidden");
    }

    // === Body parse ===
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return respondError(400, "INVALID_JSON", "Invalid JSON body");
    }

    // === Zod validation ===
    const parsed = V2RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return respondError(
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
      return respondError(503, "DNS_RESOLUTION_FAILED", "Could not resolve host");
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
        return respondError(400, e.code as V2ErrorCode, msg);
      }
      throw e;
    }

    trace.host = safeHost(safe.url);

    const firecrawlConfigured = !!Deno.env.get("FIRECRAWL_API_KEY");
    const geminiConfigured = !!Deno.env.get("GEMINI_API_KEY_V2");
    const priority: "high" | "normal" = isKnownJsHeavyHost(safe.url) ? "high" : "normal";

    // Phase 1.8: strict Amazon hosts get a 4 MiB direct-fetch + Firecrawl HTML
    // cap. The enlarged HTML is consumed by the extractor (pageSignals only)
    // and is NOT forwarded to the Gemini prompt — buildV2Prompts uses the
    // minimal Amazon evidence packet when pageSignals carry a title signal.
    // Uses the SAME strict host predicate as extractAmazonAsin /
    // canonicalizeAmazonUrl (rejects lookalikes like amazon.in.evil.com).
    let safeHostname = "";
    try { safeHostname = new URL(safe.url).hostname; } catch { /* ignore */ }
    const isAmazon = isStrictAmazonHost(safeHostname);
    const directFetchMaxBytes = isAmazon ? 4 * 1024 * 1024 : 2 * 1024 * 1024;
    const firecrawlMaxHtmlBytes = isAmazon ? 4 * 1024 * 1024 : undefined;

    // === Safe fetch ===
    let fetchResult: FetchResult;
    try {
      fetchResult = await validateAndFetchUrl(safe.url, {
        resolveDns,
        maxBytes: directFetchMaxBytes,
      });
      trace.direct_fetch = {
        attempted: true,
        ok: true,
        status: fetchResult.status,
        content_type: fetchResult.contentType,
        bytes: fetchResult.bytes,
        duration_ms: fetchResult.durationMs,
        max_bytes_used: directFetchMaxBytes,
      };
    } catch (e) {
      if (!(e instanceof FetchError)) throw e;

      trace.direct_fetch = {
        attempted: true,
        ok: false,
        error_code: e.code,
        max_bytes_used: directFetchMaxBytes,
      };
      // Log code only — never URL, headers, body, or internal reason.
      console.warn("[analyze-entity-url-v2] fetch failed", { request_id, code: e.code });

      // Phase 8: fetch-failure recovery (Firecrawl + Gemini).
      let recExtract: ExtractResult | null = null;
      let recHtml = "";
      let recEvidenceBaseUrl = safe.url;
      let recPriceConflict = false;
      let recSelectedPriceSource: "metadata" | "markdown" | "omitted" | "none" | null = null;
      let recListSalePair: import("./firecrawl_recovery.ts").MarkdownListSalePair | null = null;
      let recFirecrawlImageUrl: string | null = null;
      let recFirecrawlCurrency: string | null = null;
      let recFirecrawlBlock: V2SuccessResponse["metadata"]["firecrawl"] | undefined;
      let recWarnings: string[] = [];
      let recFirecrawlOk = false;
      let recFcDurationMs: number | undefined;

      if (FETCH_FAILED_ELIGIBLE.has(e.code) && firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, {
          fallbackBaseUrl: safe.url,
          diagContext: { requestId: request_id, callSite: "recovery" },
          ...(firecrawlMaxHtmlBytes !== undefined ? { maxHtmlBytes: firecrawlMaxHtmlBytes } : {}),
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
            recSelectedPriceSource = recovered.diagnostics.selected_price_source;
            recListSalePair = recovered.diagnostics.markdown_list_sale_pair;
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
      // Phase 1.8c.3b — primary error code feeds search-fallback trigger_reason.
      let recPrimaryGeminiErrorCode: string | null = null;
      // (recPrimaryGrounding intentionally not retained — guard runs inline below.)
      const recAmazonAsin = extractAmazonAsin(safe.url);
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
          usedFirecrawl: recFirecrawlOk,
          pageSignals: recExtract?.pageSignals ?? null,
        });
        if (gem.ok) {
          recGeminiBlock = geminiSuccessBlock(gem);
          recGeminiPred = gem.prediction;
          // Phase 1.7: dual-path guard always runs on Amazon URLs — page
          // anchor verifies even when external grounding is weak/empty.
          if (recAmazonAsin) {
            const guard = runAmazonAsinGuard(
              recAmazonAsin,
              gem.grounding,
              recExtract?.pageSignals ?? null,
              gem.prediction?.name ?? null,
            );
            recGeminiBlock = mergeGuardDiagnostics(recGeminiBlock, guard.diagnostics);
            // Phase 1.8c.1 — record guard outcome (primary gemini call).
            recGuardTracker.evaluated = true;
            recGuardTracker.passed = guard.ok;
            recGuardTracker.raw_reason_code = guard.ok ? null : guard.reason;
            recGuardTracker.input_source = "gemini_only";
            recGuardTracker.diagnostics = guard.diagnostics.extended ?? null;
            if (!guard.ok) {
              recGeminiPred = null;
              recWarnings.push(guard.reason as GeminiWarningCode);
            }
          }
        } else if (gem.configured) {
          recGeminiBlock = geminiFailureBlock(gem);
          recPrimaryGeminiErrorCode = gem.code;
          recWarnings.push(gem.code satisfies GeminiWarningCode);
        }
      } else {
        recWarnings.push("GEMINI_NOT_CONFIGURED" satisfies GeminiWarningCode);
      }

      // Phase 8: merge. Phase 8.1A: pre-resolve price source hint.
      const recPriceHint = resolvePriceSourceHint({
        extractSources: recExtract?.metadata.sources,
        firecrawlRecoveryPriceSource: recSelectedPriceSource,
      });
      const recFlags: MergeFlags = {
        priceConflict: recPriceConflict,
        firecrawlCurrency: recFirecrawlCurrency,
        firecrawlImageUrl: recFirecrawlImageUrl,
        priceSourceHint: recPriceHint,
        extractedOffers: recExtract?.extractedOffers ?? null,
        firecrawlListSalePair: recListSalePair,
      };
      let { predictions: recMerged, mergeDiag: recMergeDiag } = applyMerge(
        recExtract?.predictions ?? null,
        recGeminiPred,
        recFlags,
      );

      // ─── Last-resort search-only Gemini fallback (shared helper) ──────
      // See search_fallback.ts for skip-reason precedence. Note that the
      // `firecrawl_succeeded` skip reason was removed in Phase 1.5: a
      // non-null extract may still fail the recovery gate, so we only
      // skip when a prior step produced a usable, gate-passing prediction
      // (covered by `prior_prediction_valid`).
      const recEvidenceBaseUrlForFb = chooseEvidenceBaseUrl({
        firecrawlFinalUrl: recFirecrawlOk ? recEvidenceBaseUrl : null,
        fetchFinalUrl: null,
        safeUrl: safe.url,
      });
      const recFb = await maybeRunGeminiSearchFallback(
        {
          currentMerged: recMerged,
          primaryGeminiPred: recGeminiPred,
          geminiConfigured,
          elapsedMs: Date.now() - t0,
          totalBudgetMs: REQUEST_TOTAL_BUDGET_MS,
          safeUrl: safe.url,
          evidenceBaseUrl: recEvidenceBaseUrlForFb,
          extractMetadata: recExtract?.metadata ?? EMPTY_EXTRACT_METADATA,
          usedFirecrawl: recFirecrawlOk,
          mergeFlags: recFlags,
          extractPredictions: recExtract?.predictions ?? null,
          primaryGeminiErrorCode: recPrimaryGeminiErrorCode,
        },
        { geminiInvoker: searchOnlyGeminiInvoker, applyMerge },
      );
      const recFallbackAttempted = recFb.attempted;
      const recFallbackOk = recFb.ok;
      const recFallbackSkipReason = recFb.skipReason;
      const recFallbackTriggerReason = recFb.triggerReason;
      let recFallbackError = recFb.error;
      const recFallbackDurationMs = recFb.durationMs;
      let recFallbackUsed = recFb.used;
      // Phase 1.8c.1 — snapshot "did merge return a non-null prediction?"
      // BEFORE any post-fallback guard discards it. This distinguishes
      // "merge had nothing" from "merge produced a prediction that guard
      // threw away" in finalization telemetry.
      let recMergeReturnedPredictionsBeforeGuard = recMerged !== null;
      if (recFb.used && recFb.mergedPredictions && recFb.mergeDiag && recFb.geminiPred && recFb.geminiResult?.ok) {
        recMergeReturnedPredictionsBeforeGuard = true;
        recMerged = recFb.mergedPredictions;
        recMergeDiag = recFb.mergeDiag;
        recGeminiPred = recFb.geminiPred;
        // Refresh gemini block to reflect the winning call's grounding.
        recGeminiBlock = geminiSuccessBlock(recFb.geminiResult);
        // Phase 1.6: Amazon ASIN exact-match guard on the fallback path.
        // Runs AFTER parser/Zod/recovery gate/post-fallback merge accept.
        // Fail-closed: a guard rejection discards the prediction and routes
        // the request to the original NO_PREDICTIONS / fetch-error path
        // (never opens the AI Analysis modal with a wrong product).
        if (recAmazonAsin) {
          const guard = runAmazonAsinGuard(
            recAmazonAsin,
            recFb.geminiResult.grounding,
            recExtract?.pageSignals ?? null,
            recFb.geminiPred?.name ?? null,
          );
          recGeminiBlock = mergeGuardDiagnostics(recGeminiBlock, guard.diagnostics);
          // Phase 1.8c.1 — record guard outcome (search-fallback gemini call).
          recGuardTracker.evaluated = true;
          recGuardTracker.passed = guard.ok;
          recGuardTracker.raw_reason_code = guard.ok ? null : guard.reason;
          recGuardTracker.input_source = "gemini_only";
          recGuardTracker.diagnostics = guard.diagnostics.extended ?? null;
          if (!guard.ok) {
            recMerged = null;
            recGeminiPred = null;
            recFallbackUsed = false;
            recFallbackError = guard.reason;
            recWarnings.push(guard.reason as GeminiWarningCode);
          }
        }
      } else if (recFb.attempted && !recFb.ok && recFb.error && recFb.error !== "RECOVERY_GATE_FAILED") {
        // Preserve original failure context by recording the fallback error
        // as a warning. The original primary-Gemini warning (if any) is
        // already in recWarnings.
        recWarnings.push(recFb.error as GeminiWarningCode);
      }


      // Attach fallback diagnostics onto the existing gemini block (additive).
      if (recGeminiBlock) {
        recGeminiBlock = {
          ...recGeminiBlock,
          search_fallback_attempted: recFallbackAttempted,
          search_fallback_ok: recFallbackOk,
          search_fallback_skip_reason: recFallbackSkipReason,
          search_fallback_trigger_reason: recFallbackTriggerReason,
          ...(recFallbackError !== undefined
            ? { search_fallback_error: recFallbackError as never }
            : {}),
          ...(recFallbackDurationMs !== undefined
            ? { search_fallback_duration_ms: recFallbackDurationMs }
            : {}),
        };
      } else if (recFallbackAttempted) {
        // No primary block existed (e.g. gemini not configured path won't reach
        // here because we skip the fallback). Create a minimal block so the
        // additive diagnostics survive into the response.
        recGeminiBlock = {
          used: recFallbackOk,
          search_fallback_attempted: recFallbackAttempted,
          search_fallback_ok: recFallbackOk,
          search_fallback_skip_reason: recFallbackSkipReason,
          search_fallback_trigger_reason: recFallbackTriggerReason,
          ...(recFallbackError !== undefined
            ? { search_fallback_error: recFallbackError as never }
            : {}),
          ...(recFallbackDurationMs !== undefined
            ? { search_fallback_duration_ms: recFallbackDurationMs }
            : {}),
        };
      }


      // Phase 1.8c.6-A — page-metadata fallback floor (recovery branch).
      // Last-resort low-confidence prediction built from page-owned signals
      // (JSON-LD/OG/Twitter/HTML title) when the full pipeline produced
      // nothing. Only fires when type was deterministically resolved.
      let recPageFallbackDiag: PageMetadataFallbackDiagnostics | null = null;
      let recPageFallbackUsed = false;
      if (!recMerged && recExtract) {
        const fb = buildPageMetadataFallback({
          pageSignals: recExtract.pageSignals ?? null,
          extractMetadata: recExtract.metadata,
          baseUrl: recEvidenceBaseUrl,
        });
        recPageFallbackDiag = fb.diagnostics;
        if (fb.predictions) {
          const resolved = resolveCategory({
            type: fb.predictions.type,
            suggested_category_path: fb.predictions.suggested_category_path,
          });
          fb.predictions.category_id = resolved.category_id;
          fb.predictions.matched_category_name = resolved.matched_category_name;
          recMerged = fb.predictions;
          recPageFallbackUsed = true;
        }
      }
      if (recGeminiBlock && recPageFallbackDiag) {
        recGeminiBlock = {
          ...recGeminiBlock,
          page_metadata_fallback_used: recPageFallbackDiag.used,
          page_metadata_fallback_skip_reason: recPageFallbackDiag.skip_reason,
          page_metadata_field_source: recPageFallbackDiag.field_source,
        } as typeof recGeminiBlock;
      } else if (recPageFallbackDiag) {
        recGeminiBlock = {
          used: false,
          page_metadata_fallback_used: recPageFallbackDiag.used,
          page_metadata_fallback_skip_reason: recPageFallbackDiag.skip_reason,
          page_metadata_field_source: recPageFallbackDiag.field_source,
        } as typeof recGeminiBlock;
      }

      if (recMerged) {
        const recPricing = recMerged.additional_data.pricing as PricingBlock | undefined;
        const finalSource = recPageFallbackUsed
          ? "page_metadata_fallback"
          : recFallbackUsed
            ? "gemini_search_fallback"
            : recExtract
              ? "firecrawl_recovery"
              : "gemini_recovery";
        const response: V2SuccessResponse = {
          success: true,
          predictions: recMerged,
          metadata: {
            request_id,
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
            stage: recPageFallbackUsed
              ? "page-metadata-fallback"
              : recFallbackUsed
                ? "gemini-search-fallback"
                : recExtract
                  ? "firecrawl-recovered"
                  : "gemini-recovered",
            ...(recExtract ? { extract: recExtract.metadata } : {}),
            ...(recFirecrawlBlock ? { firecrawl: recFirecrawlBlock } : {}),
            ...(recGeminiBlock ? { gemini: recGeminiBlock } : {}),
            merge: recMergeDiag,
            ...(recPricing ? { pricing: summarizePricing(recPricing, recMergeDiag.price_source_used) } : {}),
            final_prediction_source: finalSource,
          },
          warnings: recWarnings.length > 0 ? recWarnings : undefined,
        };
        trace.path = "fetch_recovery";
        trace.firecrawl = recFirecrawlBlock
          ? {
              eligible: FETCH_FAILED_ELIGIBLE.has(e.code),
              attempted: true,
              ok: recFirecrawlOk,
              duration_ms: recFirecrawlBlock.duration_ms,
              error_code: recFirecrawlBlock.error_code,
            }
          : { eligible: FETCH_FAILED_ELIGIBLE.has(e.code), attempted: false, ok: false, skip_reason: firecrawlConfigured ? "not_eligible" : "not_configured" };
        trace.gemini = recGeminiBlock
          ? {
              attempted: true,
              ok: recGeminiBlock.used === true,
              duration_ms: recGeminiBlock.duration_ms,
              error_code: recGeminiBlock.error_code,
              used_url_context: recGeminiBlock.used_url_context,
              used_google_search: recGeminiBlock.used_google_search,
              url_context_failed: recGeminiBlock.url_context_failed,
            }
          : { attempted: false, ok: false };
        trace.merge = { path: recMergeDiag.path, field_winners: recMergeDiag.field_winners as unknown as Record<string, string> };
        trace.final = {
          prediction_source: finalSource,
          error_code: "OK",
          total_duration_ms: Date.now() - t0,
        };
        console.info("[analyze-entity-url-v2] gemini_search_fallback", {
          request_id,
          attempted: recFallbackAttempted,
          ok: recFallbackOk,
          skip_reason: recFallbackSkipReason,
          trigger_reason: recFallbackTriggerReason,
          duration_ms: recFallbackDurationMs,
          final_prediction_source: finalSource,
        });
        trace.finalization = buildFinalization({
          mergedPredictions: recMerged,
          mergeDiag: recMergeDiag,
          mergeReturnedPredictionsBeforeGuard: recMergeReturnedPredictionsBeforeGuard,
          guard: recGuardTracker,
          fallbackUsed: recFallbackUsed,
          usedFirecrawl: recFirecrawlOk,
          extractPresent: recExtract !== null,
        });
        return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
      }

      // Fallback did not produce predictions either — preserve original error
      // but log fallback telemetry for observability.
      console.info("[analyze-entity-url-v2] gemini_search_fallback", {
        request_id,
        attempted: recFallbackAttempted,
        ok: recFallbackOk,
        skip_reason: recFallbackSkipReason,
        trigger_reason: recFallbackTriggerReason,
        duration_ms: recFallbackDurationMs,
        final_prediction_source: "none",
        original_error_code: e.code,
      });

      trace.finalization = buildFinalization({
        mergedPredictions: recMerged,
        mergeDiag: recMergeDiag,
        mergeReturnedPredictionsBeforeGuard: recMergeReturnedPredictionsBeforeGuard,
        guard: recGuardTracker,
        fallbackUsed: recFallbackUsed,
        usedFirecrawl: recFirecrawlOk,
        extractPresent: recExtract !== null,
      });

      // Strict contract: return the ORIGINAL fetch error unchanged.
      return respondError(
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
    // Phase 8: deterministic signals plumbed into merge.
    let mainPriceConflict = false;
    let mainFirecrawlImageUrl: string | null = null;
    let mainFirecrawlCurrency: string | null = null;
    let mainSelectedPriceSource: "metadata" | "markdown" | "omitted" | "none" | null = null;
    let mainListSalePair: import("./firecrawl_recovery.ts").MarkdownListSalePair | null = null;

    const ws = detectWeakSignals(extract);
    if (ws.weak) {
      if (firecrawlConfigured) {
        const fc = await runFirecrawlScrape(safe.url, {
          fallbackBaseUrl: safe.url,
          diagContext: { requestId: request_id, callSite: "main" },
          ...(firecrawlMaxHtmlBytes !== undefined ? { maxHtmlBytes: firecrawlMaxHtmlBytes } : {}),
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
            const signals = deriveFirecrawlSignals(fc.metadata, base);
            mainFirecrawlImageUrl = signals.firecrawlImageUrl;
            mainFirecrawlCurrency = signals.firecrawlCurrency;
            if (recoveryDiagnostics?.price_conflict) mainPriceConflict = true;
            if (recoveryDiagnostics) mainSelectedPriceSource = recoveryDiagnostics.selected_price_source;
            if (recoveryDiagnostics) mainListSalePair = recoveryDiagnostics.markdown_list_sale_pair;
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
    let mainGeminiPred: GeminiRawPrediction | null = null;
    // Phase 1.8c.3b — primary error code feeds search-fallback trigger_reason.
    let mainPrimaryGeminiErrorCode: string | null = null;
    const mainAmazonAsin = extractAmazonAsin(safe.url);
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
          usedFirecrawl,
          pageSignals: extract.pageSignals ?? null,
        });
        if (gem.ok) {
          geminiBlock = geminiSuccessBlock(gem);
          mainGeminiPred = gem.prediction;
          // Phase 1.7: dual-path guard always runs on Amazon URLs.
          if (mainAmazonAsin) {
            const guard = runAmazonAsinGuard(
              mainAmazonAsin,
              gem.grounding,
              extract.pageSignals ?? null,
              gem.prediction?.name ?? null,
            );
            geminiBlock = mergeGuardDiagnostics(geminiBlock, guard.diagnostics);
            // Phase 1.8c.1 — record guard outcome (primary gemini call).
            mainGuardTracker.evaluated = true;
            mainGuardTracker.passed = guard.ok;
            mainGuardTracker.raw_reason_code = guard.ok ? null : guard.reason;
            mainGuardTracker.input_source = "gemini_only";
            mainGuardTracker.diagnostics = guard.diagnostics.extended ?? null;
            if (!guard.ok) {
              mainGeminiPred = null;
              (warnings as string[]).push(guard.reason as GeminiWarningCode);
            }
          }
        } else if (gem.configured) {
          geminiBlock = geminiFailureBlock(gem);
          mainPrimaryGeminiErrorCode = gem.code;
          (warnings as string[]).push(gem.code satisfies GeminiWarningCode);
        }
      } else {
        (warnings as string[]).push(
          "GEMINI_NOT_CONFIGURED" satisfies GeminiWarningCode,
        );
      }
    }

    // === Phase 8: merge + category resolution ===
    // Phase 8.1A: pre-resolve price source hint from extractor diagnostics.
    const mainPriceHint = resolvePriceSourceHint({
      extractSources: extract.metadata.sources,
      firecrawlRecoveryPriceSource: mainSelectedPriceSource,
    });
    const mainFlags: MergeFlags = {
      priceConflict: mainPriceConflict,
      firecrawlCurrency: mainFirecrawlCurrency,
      firecrawlImageUrl: mainFirecrawlImageUrl,
      priceSourceHint: mainPriceHint,
      extractedOffers: extract.extractedOffers ?? null,
      firecrawlListSalePair: mainListSalePair,
    };
    let { predictions: mainMerged, mergeDiag: mainMergeDiag } = applyMerge(
      extract.predictions,
      mainGeminiPred,
      mainFlags,
    );
    // Phase 1.8c.1 — hoisted snapshot used by finalization telemetry. Reset
    // inside the search-fallback block if/when a successful fallback merge
    // produces predictions BEFORE the post-fallback guard runs.
    let mainMergeReturnedPredictionsBeforeGuard = mainMerged !== null;

    // ─── Phase 1.5: search-only Gemini fallback in main branch ──────────
    // Runs only when the main branch has no usable merged prediction.
    // Same shared helper as the recovery branch; see search_fallback.ts.
    let mainFallbackUsed = false;
    let mainFallbackAttempted = false;
    let mainFallbackOk = false;
    let mainFallbackSkipReason: string | null = null;
    let mainFallbackTriggerReason: string | null = null;
    let mainFallbackError: string | undefined;
    let mainFallbackDurationMs: number | undefined;
    if (!mainMerged) {
      const mainEvidenceBaseUrlForFb = chooseEvidenceBaseUrl({
        firecrawlFinalUrl: usedFirecrawl ? finalEvidenceBaseUrl : null,
        fetchFinalUrl: !usedFirecrawl ? fetchResult.finalUrl : null,
        safeUrl: safe.url,
      });
      const mainFb = await maybeRunGeminiSearchFallback(
        {
          currentMerged: mainMerged,
          primaryGeminiPred: mainGeminiPred,
          geminiConfigured,
          elapsedMs: Date.now() - t0,
          totalBudgetMs: REQUEST_TOTAL_BUDGET_MS,
          safeUrl: safe.url,
          evidenceBaseUrl: mainEvidenceBaseUrlForFb,
          extractMetadata: extract.metadata,
          usedFirecrawl,
          mergeFlags: mainFlags,
          extractPredictions: extract.predictions,
          primaryGeminiErrorCode: mainPrimaryGeminiErrorCode,
        },
        { geminiInvoker: searchOnlyGeminiInvoker, applyMerge },
      );
      mainFallbackAttempted = mainFb.attempted;
      mainFallbackOk = mainFb.ok;
      mainFallbackSkipReason = mainFb.skipReason;
      mainFallbackTriggerReason = mainFb.triggerReason;
      mainFallbackError = mainFb.error;
      mainFallbackDurationMs = mainFb.durationMs;
      // (mainMergeReturnedPredictionsBeforeGuard is hoisted above; only the
      // successful-fallback branch below overrides it to true.)
      if (mainFb.used && mainFb.mergedPredictions && mainFb.mergeDiag && mainFb.geminiPred && mainFb.geminiResult?.ok) {
        mainMergeReturnedPredictionsBeforeGuard = true;
        mainMerged = mainFb.mergedPredictions;
        mainMergeDiag = mainFb.mergeDiag;
        mainGeminiPred = mainFb.geminiPred;
        // Refresh the gemini block to reflect the winning call's grounding.
        geminiBlock = geminiSuccessBlock(mainFb.geminiResult);
        mainFallbackUsed = true;
        // Phase 1.6: Amazon ASIN exact-match guard on the fallback path.
        // Fail-closed: guard rejection discards the prediction and routes
        // the response to the existing NO_PREDICTIONS path (modal NOT
        // opened). Trace/telemetry preserves the rejection reason.
        if (mainAmazonAsin) {
          const guard = runAmazonAsinGuard(
            mainAmazonAsin,
            mainFb.geminiResult.grounding,
            extract.pageSignals ?? null,
            mainFb.geminiPred?.name ?? null,
          );
          geminiBlock = mergeGuardDiagnostics(geminiBlock, guard.diagnostics);
          // Phase 1.8c.1 — record guard outcome (search-fallback gemini call).
          mainGuardTracker.evaluated = true;
          mainGuardTracker.passed = guard.ok;
          mainGuardTracker.raw_reason_code = guard.ok ? null : guard.reason;
          mainGuardTracker.input_source = "gemini_only";
          mainGuardTracker.diagnostics = guard.diagnostics.extended ?? null;
          if (!guard.ok) {
            mainMerged = null;
            mainGeminiPred = null;
            mainFallbackUsed = false;
            mainFallbackError = guard.reason;
            (warnings as string[]).push(guard.reason as GeminiWarningCode);
          }
        }
      } else if (mainFb.attempted && !mainFb.ok && mainFb.error && mainFb.error !== "RECOVERY_GATE_FAILED") {
        // Preserve the original primary-Gemini warning AND add the fallback
        // failure code so observers see both failures.
        (warnings as string[]).push(mainFb.error as GeminiWarningCode);
      }

      // Attach fallback telemetry to the gemini block (additive). If no
      // primary block existed, create a minimal one so diagnostics survive.
      if (geminiBlock && mainFallbackAttempted) {
        geminiBlock = {
          ...geminiBlock,
          search_fallback_attempted: mainFallbackAttempted,
          search_fallback_ok: mainFallbackOk,
          search_fallback_skip_reason: mainFallbackSkipReason,
          search_fallback_trigger_reason: mainFallbackTriggerReason,
          ...(mainFallbackError !== undefined
            ? { search_fallback_error: mainFallbackError as never }
            : {}),
          ...(mainFallbackDurationMs !== undefined
            ? { search_fallback_duration_ms: mainFallbackDurationMs }
            : {}),
        };
      } else if (!geminiBlock && mainFallbackAttempted) {
        geminiBlock = {
          used: mainFallbackOk,
          search_fallback_attempted: mainFallbackAttempted,
          search_fallback_ok: mainFallbackOk,
          search_fallback_skip_reason: mainFallbackSkipReason,
          search_fallback_trigger_reason: mainFallbackTriggerReason,
          ...(mainFallbackError !== undefined
            ? { search_fallback_error: mainFallbackError as never }
            : {}),
          ...(mainFallbackDurationMs !== undefined
            ? { search_fallback_duration_ms: mainFallbackDurationMs }
            : {}),
        };
      }
    }

    // Phase 1.8c.6-A — page-metadata fallback floor (main branch).
    // Synthesize a LOW-CONFIDENCE prediction from page-owned signals when
    // the full pipeline (extractor → Firecrawl → Gemini → search-only
    // fallback) failed to produce one. Type-safe: only fires when
    // extract.metadata.mapped_type was deterministically resolved.
    let mainPageFallbackDiag: PageMetadataFallbackDiagnostics | null = null;
    let mainPageFallbackUsed = false;
    if (!mainMerged) {
      const fb = buildPageMetadataFallback({
        pageSignals: extract.pageSignals ?? null,
        extractMetadata: extract.metadata,
        baseUrl: finalEvidenceBaseUrl,
      });
      mainPageFallbackDiag = fb.diagnostics;
      if (fb.predictions) {
        const resolved = resolveCategory({
          type: fb.predictions.type,
          suggested_category_path: fb.predictions.suggested_category_path,
        });
        fb.predictions.category_id = resolved.category_id;
        fb.predictions.matched_category_name = resolved.matched_category_name;
        mainMerged = fb.predictions;
        mainPageFallbackUsed = true;
      }
    }
    if (geminiBlock && mainPageFallbackDiag) {
      geminiBlock = {
        ...geminiBlock,
        page_metadata_fallback_used: mainPageFallbackDiag.used,
        page_metadata_fallback_skip_reason: mainPageFallbackDiag.skip_reason,
        page_metadata_field_source: mainPageFallbackDiag.field_source,
      } as typeof geminiBlock;
    } else if (mainPageFallbackDiag) {
      geminiBlock = {
        used: false,
        page_metadata_fallback_used: mainPageFallbackDiag.used,
        page_metadata_fallback_skip_reason: mainPageFallbackDiag.skip_reason,
        page_metadata_field_source: mainPageFallbackDiag.field_source,
      } as typeof geminiBlock;
    }

    const mainPricing = mainMerged?.additional_data.pricing as PricingBlock | undefined;

    const response: V2SuccessResponse = {
      success: true,
      predictions: mainMerged,
      metadata: {
        request_id,
        analyzed_url: safe.url,
        normalized_url: safe.url,
        extraction_version: EXTRACTION_VERSION,
        edge_function: EDGE_FUNCTION_NAME,
        method: mainMerged ? "exact-page" : "stub",
        timestamp: new Date().toISOString(),
        used_url_context: geminiBlock?.used_url_context ?? false,
        used_google_search: geminiBlock?.used_google_search ?? false,
        used_firecrawl: usedFirecrawl,
        phase: 8,
        stage: mainPageFallbackUsed
          ? "page-metadata-fallback"
          : mainFallbackUsed
            ? "gemini-search-fallback"
            : usedFirecrawl
              ? "firecrawl-improved"
              : mainMerged
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
        merge: mainMergeDiag,
        ...(mainPricing ? { pricing: summarizePricing(mainPricing, mainMergeDiag.price_source_used) } : {}),
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    trace.deterministic_extract = {
      ok: extract.predictions !== null,
      weak_signals: extract.metadata.weak_signals,
    };
    trace.firecrawl = firecrawlBlock
      ? {
          eligible: true,
          attempted: true,
          ok: firecrawlBlock.used === true,
          duration_ms: firecrawlBlock.duration_ms,
          error_code: firecrawlBlock.error_code,
        }
      : { eligible: false, attempted: false, ok: false };
    trace.gemini = geminiBlock
      ? {
          attempted: true,
          ok: geminiBlock.used === true,
          duration_ms: geminiBlock.duration_ms,
          error_code: geminiBlock.error_code,
          used_url_context: geminiBlock.used_url_context,
          used_google_search: geminiBlock.used_google_search,
          url_context_failed: geminiBlock.url_context_failed,
        }
      : { attempted: false, ok: false };
    trace.merge = {
      path: mainMergeDiag.path,
      field_winners: mainMergeDiag.field_winners as unknown as Record<string, string>,
    };
    trace.path = usedFirecrawl ? "weak_recovery" : "happy";
    trace.final = {
      prediction_source: mainMerged
        ? mainPageFallbackUsed
          ? "page_metadata_fallback"
          : mainFallbackUsed
            ? "gemini_search_fallback"
            : usedFirecrawl
              ? "firecrawl_merge"
              : "extractor_merge"
        : "none",
      error_code: mainMerged ? "OK" : "NO_PREDICTIONS",
      total_duration_ms: Date.now() - t0,
    };
    if (mainPageFallbackDiag) {
      console.info("[analyze-entity-url-v2] page_metadata_fallback main", {
        request_id,
        used: mainPageFallbackDiag.used,
        skip_reason: mainPageFallbackDiag.skip_reason,
        field_source: mainPageFallbackDiag.field_source,
        image_candidate_count: mainPageFallbackDiag.image_candidate_count,
      });
    }
    if (mainFallbackAttempted || mainFallbackSkipReason) {
      console.info("[analyze-entity-url-v2] gemini_search_fallback main", {
        request_id,
        attempted: mainFallbackAttempted,
        ok: mainFallbackOk,
        used: mainFallbackUsed,
        skip_reason: mainFallbackSkipReason,
        trigger_reason: mainFallbackTriggerReason,
        duration_ms: mainFallbackDurationMs,
        final_prediction_source: trace.final.prediction_source,
      });
    }
    trace.finalization = buildFinalization({
      mergedPredictions: mainMerged,
      mergeDiag: mainMergeDiag,
      mergeReturnedPredictionsBeforeGuard: mainMergeReturnedPredictionsBeforeGuard,
      guard: mainGuardTracker,
      fallbackUsed: mainFallbackUsed,
      usedFirecrawl,
      extractPresent: extract.predictions !== null,
    });
    return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("[analyze-entity-url-v2] unhandled error:", { request_id, err: String(err) });
    return respondError(500, "INTERNAL_ERROR", "Internal error");
  } finally {
    if (trace.final.total_duration_ms === 0) {
      trace.final.total_duration_ms = Date.now() - t0;
    }
    console.info("[analyze-entity-url-v2] trace", trace);
  }
});
