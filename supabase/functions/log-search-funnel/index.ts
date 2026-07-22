// Phase 3.5c — Funnel telemetry for the Search-to-Draft flow.
//
// Privacy contract:
//   - Raw query strings are never accepted or stored. Only query_hash (SHA-256 hex).
//   - Payload keys 'query'|'q'|'raw'|'text'|'prompt' → 400.
//   - diagnostics keys are strictly allow-listed. Everything else is dropped.
//   - Function logs contain only { event, entityType, cached, latencyMs } — no
//     hash, no headers, no body.
//
// Writes go through service_role. No user-facing INSERT policy exists.
// Failures are silent from the client's perspective (fire-and-forget).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EVENTS = new Set([
  "search_run",
  "candidate_pick",
  "review_opened",
  "entity_created",
]);
const ALLOWED_SOURCES = new Set(["search", "existing_match"]);
const FORBIDDEN_PAYLOAD_KEYS = ["query", "q", "raw", "text", "prompt"];
const ALLOWED_ENTITY_TYPES = new Set([
  "product", "brand", "place", "book", "movie", "food", "app", "tv",
]);

// Best-effort in-memory rate limit — 300 events/hour/user. Never blocks writes
// hard; on limit we return 200 with `throttled: true` so client stays quiet.
const RATE_LIMIT = 300;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Phase 3.5c v2 — allow-listed diff enums. Must mirror
// src/components/admin/entity-create/searchTelemetryTypes.ts.
const INITIAL_IMAGE_SOURCES = new Set([
  "page_metadata", "firecrawl", "google_images", "none", "unknown",
]);
const FINAL_IMAGE_SOURCES = new Set([
  "page_metadata", "firecrawl", "google_images", "user_replaced", "none", "unknown",
]);
const BRAND_DECISION_TYPES = new Set([
  "existing", "create_new", "not_sure", "not_listed", "not_applicable",
]);
const IMAGE_METHODS = new Set(["google_cse", "unknown"]);
const DIFF_BOOL_KEYS = [
  "nameChanged", "categoryChanged", "brandChanged", "imageChanged",
  "descriptionChanged", "websiteChanged", "metadataChanged", "imageUserReplaced",
];

function sanitizeDiff(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DIFF_BOOL_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k];
  }
  if (typeof src.initialImageSource === "string" && INITIAL_IMAGE_SOURCES.has(src.initialImageSource)) {
    out.initialImageSource = src.initialImageSource;
  }
  if (typeof src.finalImageSource === "string" && FINAL_IMAGE_SOURCES.has(src.finalImageSource)) {
    out.finalImageSource = src.finalImageSource;
  }
  if (typeof src.brandDecisionType === "string" && BRAND_DECISION_TYPES.has(src.brandDecisionType)) {
    out.brandDecisionType = src.brandDecisionType;
  }
  if (typeof src.imageMethod === "string" && IMAGE_METHODS.has(src.imageMethod)) {
    out.imageMethod = src.imageMethod;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeDiagnostics(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof src.latencyMs === "number" && Number.isFinite(src.latencyMs)) {
    out.latencyMs = Math.max(0, Math.min(600_000, Math.round(src.latencyMs)));
  }
  if (typeof src.cached === "boolean") out.cached = src.cached;
  if (typeof src.hasImage === "boolean") out.hasImage = src.hasImage;
  const diff = sanitizeDiff(src.diff);
  if (diff) out.diff = diff;
  return out;
}

function rateAllow(userId: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(userId);
  if (!b || now - b.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(userId, { count: 1, windowStart: now });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "unauthorized" }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return jsonResp({ error: "unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    let body: any;
    try { body = await req.json(); }
    catch { return jsonResp({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object") return jsonResp({ error: "invalid_body" }, 400);

    // Hard reject any attempt to pass raw text.
    for (const k of FORBIDDEN_PAYLOAD_KEYS) {
      if (k in body) return jsonResp({ error: "raw_text_not_allowed" }, 400);
    }
    if (body.diagnostics && typeof body.diagnostics === "object") {
      for (const k of FORBIDDEN_PAYLOAD_KEYS) {
        if (k in body.diagnostics) return jsonResp({ error: "raw_text_not_allowed" }, 400);
      }
    }

    const event = typeof body.event === "string" ? body.event : "";
    if (!ALLOWED_EVENTS.has(event)) return jsonResp({ error: "invalid_event" }, 400);

    const source = typeof body.source === "string" ? body.source : "";
    if (!ALLOWED_SOURCES.has(source)) return jsonResp({ error: "invalid_source" }, 400);

    const queryHash =
      typeof body.queryHash === "string" && /^[a-f0-9]{16,128}$/i.test(body.queryHash)
        ? body.queryHash.toLowerCase()
        : null;

    const entityType =
      typeof body.entityType === "string" && ALLOWED_ENTITY_TYPES.has(body.entityType)
        ? body.entityType
        : null;

    const candidateIndex =
      typeof body.candidateIndex === "number" && Number.isFinite(body.candidateIndex)
        ? Math.max(0, Math.min(20, Math.trunc(body.candidateIndex)))
        : null;

    const diagnostics = sanitizeDiagnostics(body.diagnostics);

    if (!rateAllow(userId)) {
      // Silent throttle. Never surfaces to user.
      return jsonResp({ ok: true, throttled: true });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: insErr } = await supabaseAdmin.from("search_funnel_events").insert({
      user_id: userId,
      event,
      query_hash: queryHash,
      entity_type: entityType,
      candidate_index: candidateIndex,
      source,
      diagnostics,
    });
    if (insErr) {
      console.warn("[log-search-funnel] insert failed:", insErr.message);
      return jsonResp({ ok: false }, 200);
    }

    // Safe log — no hash, no source url, no headers.
    console.log(
      "[log-search-funnel]",
      JSON.stringify({
        event,
        entityType,
        cached: diagnostics.cached ?? null,
        latencyMs: diagnostics.latencyMs ?? null,
      }),
    );
    return jsonResp({ ok: true });
  } catch (e) {
    console.warn("[log-search-funnel] fatal:", (e as Error).message);
    return jsonResp({ ok: false }, 200);
  }
});
