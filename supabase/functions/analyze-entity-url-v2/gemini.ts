// Phase 7: Gemini client — native gemini-2.5-flash with urlContext +
// googleSearch tools, JSON mode primary path.
//
// NOTE: We deliberately do NOT send responseSchema in Phase 7.
// gemini-2.5-flash does not reliably support responseSchema combined with
// urlContext / googleSearch tools (that combination is a Gemini 3 capability
// per Google docs). Using schema mode here would waste one Gemini call per
// request on a guaranteed-fail attempt before falling back to JSON mode.
// When/if we adopt Gemini 3, revisit and add a runGeminiSchema() path.

import {
  buildGeminiRawPredictionSchema,
  type GeminiRawPrediction,
} from "./response_schema.ts";

export type GeminiErrorCode =
  | "GEMINI_TIMEOUT"
  | "GEMINI_HTTP_ERROR"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_PAYMENT_REQUIRED"
  | "GEMINI_BLOCKED_BY_SAFETY"
  | "GEMINI_BAD_RESPONSE"
  | "GEMINI_INVALID_JSON"
  | "GEMINI_INVALID_SHAPE";

/**
 * Diagnostic non-blocking codes that may appear in V2SuccessResponse.warnings[].
 * Intentionally NOT part of V2ErrorCode — warnings ≠ top-level errors.
 * On the wire, warnings is still string[]; this union exists for internal
 * type-safety where we push values into the array.
 */
export type GeminiWarningCode = GeminiErrorCode | "GEMINI_NOT_CONFIGURED";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_API_TIMEOUT_MS = 20_000;
export const GEMINI_LOCAL_TIMEOUT_MS = 22_000;
export const GEMINI_TEMPERATURE = 0.15;

export interface GeminiGrounding {
  used_url_context: boolean;
  used_google_search: boolean;
  url_retrieval_statuses: string[];
  url_context_failed: boolean;
}

export interface GeminiNotConfigured {
  ok: false;
  configured: false;
}

export interface GeminiSuccess {
  ok: true;
  configured: true;
  durationMs: number;
  model: string;
  grounding: GeminiGrounding;
  prediction: GeminiRawPrediction;
}

export interface GeminiFailure {
  ok: false;
  configured: true;
  code: GeminiErrorCode;
  status?: number;
  durationMs: number;
  model: string;
  grounding?: GeminiGrounding;
}

export type GeminiResult = GeminiSuccess | GeminiFailure | GeminiNotConfigured;

export interface RunGeminiArgs {
  systemPrompt: string;
  userPrompt: string;
  evidenceBaseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Local AbortController timeout (ms). */
  timeoutMs?: number;
}

function stripCodeFences(text: string): string {
  let s = text.trim();
  // ```json\n...\n```
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/i, "");
    if (s.endsWith("```")) s = s.slice(0, -3);
  }
  return s.trim();
}

function parseGrounding(cand: Record<string, unknown> | undefined): GeminiGrounding {
  const c = (cand ?? {}) as Record<string, unknown>;
  const gm = (c.groundingMetadata ?? c.grounding_metadata ?? {}) as Record<string, unknown>;
  const urlCtx =
    (c.urlContextMetadata ??
      c.url_context_metadata ??
      gm.urlContextMetadata ??
      gm.url_context_metadata ??
      {}) as Record<string, unknown>;
  const urlMeta = (urlCtx.urlMetadata ?? urlCtx.url_metadata ?? []) as Array<
    Record<string, unknown>
  >;
  const statuses = urlMeta
    .map((u) => (u.urlRetrievalStatus ?? u.url_retrieval_status) as unknown)
    .filter((v): v is string => typeof v === "string");

  const groundingChunks = (gm.groundingChunks ?? gm.grounding_chunks ?? []) as unknown[];
  const webSearchQueries = (gm.webSearchQueries ?? gm.web_search_queries ?? []) as unknown[];

  return {
    used_url_context: urlMeta.length > 0,
    used_google_search:
      (Array.isArray(groundingChunks) && groundingChunks.length > 0) ||
      (Array.isArray(webSearchQueries) && webSearchQueries.length > 0),
    url_retrieval_statuses: statuses,
    url_context_failed:
      urlMeta.length > 0 && !statuses.includes("URL_RETRIEVAL_STATUS_SUCCESS"),
  };
}

function extractText(json: Record<string, unknown>): string | null {
  const candidates = (json.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const cand = candidates[0];
  if (!cand) return null;
  const content = (cand.content as Record<string, unknown> | undefined) ?? {};
  const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
  const texts: string[] = [];
  for (const p of parts) {
    if (typeof p.text === "string") texts.push(p.text);
  }
  if (texts.length === 0) return null;
  return texts.join("");
}

function logLine(payload: Record<string, unknown>): void {
  console.log("[analyze-entity-url-v2] gemini", payload);
}

export async function runGeminiJsonMode(args: RunGeminiArgs): Promise<GeminiResult> {
  const apiKey = args.apiKey ?? Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) {
    return { ok: false, configured: false };
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? GEMINI_LOCAL_TIMEOUT_MS;
  const t0 = Date.now();

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${args.systemPrompt}\n\n${args.userPrompt}` }],
      },
    ],
    tools: [{ urlContext: {} }, { googleSearch: {} }],
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const dur = Date.now() - t0;
    const aborted = (e as { name?: string })?.name === "AbortError";
    const code: GeminiErrorCode = aborted ? "GEMINI_TIMEOUT" : "GEMINI_HTTP_ERROR";
    logLine({ ok: false, code, durationMs: dur, modelUsed: GEMINI_MODEL });
    return { ok: false, configured: true, code, durationMs: dur, model: GEMINI_MODEL };
  }
  clearTimeout(timer);
  const durationMs = Date.now() - t0;

  if (!res.ok) {
    let code: GeminiErrorCode = "GEMINI_HTTP_ERROR";
    if (res.status === 429) code = "GEMINI_RATE_LIMITED";
    else if (res.status === 402) code = "GEMINI_PAYMENT_REQUIRED";
    logLine({ ok: false, code, status: res.status, durationMs, modelUsed: GEMINI_MODEL });
    // Drain body to free the connection; don't log it.
    try { await res.text(); } catch { /* ignore */ }
    return { ok: false, configured: true, code, status: res.status, durationMs, model: GEMINI_MODEL };
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    logLine({ ok: false, code: "GEMINI_BAD_RESPONSE", durationMs, modelUsed: GEMINI_MODEL });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_BAD_RESPONSE",
      durationMs,
      model: GEMINI_MODEL,
    };
  }

  // Safety / block checks.
  const promptFeedback = json.promptFeedback as Record<string, unknown> | undefined;
  if (promptFeedback?.blockReason) {
    logLine({
      ok: false,
      code: "GEMINI_BLOCKED_BY_SAFETY",
      durationMs,
      modelUsed: GEMINI_MODEL,
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_BLOCKED_BY_SAFETY",
      durationMs,
      model: GEMINI_MODEL,
    };
  }

  const candidates = (json.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const cand0 = candidates[0];
  if (cand0 && (cand0.finishReason === "SAFETY" || cand0.finish_reason === "SAFETY")) {
    const grounding = parseGrounding(cand0);
    logLine({
      ok: false,
      code: "GEMINI_BLOCKED_BY_SAFETY",
      durationMs,
      modelUsed: GEMINI_MODEL,
      used_url_context: grounding.used_url_context,
      used_google_search: grounding.used_google_search,
      url_context_failed: grounding.url_context_failed,
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_BLOCKED_BY_SAFETY",
      durationMs,
      model: GEMINI_MODEL,
      grounding,
    };
  }

  const grounding = parseGrounding(cand0);
  const text = extractText(json);
  if (!text) {
    logLine({
      ok: false,
      code: "GEMINI_BAD_RESPONSE",
      durationMs,
      modelUsed: GEMINI_MODEL,
      used_url_context: grounding.used_url_context,
      used_google_search: grounding.used_google_search,
      url_context_failed: grounding.url_context_failed,
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_BAD_RESPONSE",
      durationMs,
      model: GEMINI_MODEL,
      grounding,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(text));
  } catch {
    logLine({
      ok: false,
      code: "GEMINI_INVALID_JSON",
      durationMs,
      modelUsed: GEMINI_MODEL,
      used_url_context: grounding.used_url_context,
      used_google_search: grounding.used_google_search,
      url_context_failed: grounding.url_context_failed,
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_INVALID_JSON",
      durationMs,
      model: GEMINI_MODEL,
      grounding,
    };
  }

  const validator = buildGeminiRawPredictionSchema(args.evidenceBaseUrl);
  const v = validator.safeParse(parsed);
  if (!v.success) {
    logLine({
      ok: false,
      code: "GEMINI_INVALID_SHAPE",
      durationMs,
      modelUsed: GEMINI_MODEL,
      used_url_context: grounding.used_url_context,
      used_google_search: grounding.used_google_search,
      url_context_failed: grounding.url_context_failed,
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_INVALID_SHAPE",
      durationMs,
      model: GEMINI_MODEL,
      grounding,
    };
  }

  logLine({
    ok: true,
    durationMs,
    modelUsed: GEMINI_MODEL,
    used_url_context: grounding.used_url_context,
    used_google_search: grounding.used_google_search,
    url_context_failed: grounding.url_context_failed,
  });

  return {
    ok: true,
    configured: true,
    durationMs,
    model: GEMINI_MODEL,
    grounding,
    prediction: v.data,
  };
}

/**
 * Choose the evidence base URL for prompt + image normalization.
 * Firecrawl final URL > direct fetch final URL > safe normalized URL.
 */
export function chooseEvidenceBaseUrl(opts: {
  firecrawlFinalUrl?: string | null;
  fetchFinalUrl?: string | null;
  safeUrl: string;
}): string {
  if (opts.firecrawlFinalUrl) {
    try {
      const u = new URL(opts.firecrawlFinalUrl);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch { /* ignore */ }
  }
  if (opts.fetchFinalUrl) {
    try {
      const u = new URL(opts.fetchFinalUrl);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch { /* ignore */ }
  }
  return opts.safeUrl;
}
