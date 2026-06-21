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

// Search-only fallback constants. Used by analyze-entity-url-v2/index.ts.
// The fallback runs at most once per request, only on the recovery path,
// only when every earlier step (direct fetch, Firecrawl recovery, primary
// Gemini with url_context + google_search) failed to produce a gate-passing
// prediction, and only if at least SEARCH_FALLBACK_TIMEOUT_MS +
// SEARCH_FALLBACK_BUDGET_BUFFER_MS remain in the request budget.
// Bumped from 14_000 → 20_000 (Phase 1.5b). V1's successful Gemini +
// Google Search call on hostile hosts like Amazon completes right around
// the previous 14s budget; aborting at 14s killed otherwise-valid
// fallbacks (see Root Hair Serum). The total request budget
// (REQUEST_TOTAL_BUDGET_MS in index.ts) plus the buffer below guarantees
// we never overrun the edge-function deadline.
export const SEARCH_FALLBACK_TIMEOUT_MS = 20_000;
export const SEARCH_FALLBACK_BUDGET_BUFFER_MS = 1_000;


export interface GeminiGrounding {
  used_url_context: boolean;
  used_google_search: boolean;
  url_retrieval_statuses: string[];
  url_context_failed: boolean;
  // Phase 1.6: external grounding evidence surfaced ONLY for the Amazon
  // ASIN guard. Excludes prompt text, webSearchQueries, groundingSupports
  // segment text, and model answer text. Never logged. Never on the wire.
  grounding_chunk_uris: string[];
  grounding_chunk_titles: string[];
  url_context_retrieved_urls: string[];
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
  rawTextLength?: number;
  rawTextSha8?: string;
}

export interface GeminiFailure {
  ok: false;
  configured: true;
  code: GeminiErrorCode;
  status?: number;
  durationMs: number;
  model: string;
  grounding?: GeminiGrounding;
  rawTextLength?: number;
  rawTextSha8?: string;
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
  /**
   * Override the Gemini `tools` array. Defaults to
   * `[{ url_context: {} }, { google_search: {} }]` (primary path).
   * The search-only fallback overrides to `[{ google_search: {} }]`.
   * Nothing else about the request body changes.
   */
  tools?: Array<Record<string, unknown>>;
  /**
   * Optional external AbortSignal. When provided, the call aborts as soon
   * as either this signal or the internal timeout fires.
   */
  abortSignal?: AbortSignal;
  /** Diagnostic label used only in the structured log line. */
  logLabel?: string;
  /**
   * Phase 1.8b: when true, the request uses thinkingBudget: 0 instead of the
   * non-Amazon default of 256. Computed once by the caller from
   * `isStrictAmazonHost(host)` so primary, recovery, and search-only paths
   * share an identical Amazon predicate. maxOutputTokens stays 2048 either way.
   */
  isAmazon?: boolean;
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

/**
 * Scan for the first balanced top-level `{...}` block in `text`, respecting
 * string literals (so braces inside strings don't unbalance the count).
 * Returns the raw substring (including outer braces), or null if none found.
 */
function extractFirstBalancedObject(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Given a parsed object, return conservative nested-wrapper candidates:
 *  - values of well-known wrapper keys (prediction, result, response, data)
 *  - any property whose value is a plain object containing BOTH `type` AND `name`
 * Arrays, primitives, and metadata-shaped objects are rejected.
 */
function nestedWrapperCandidates(
  obj: Record<string, unknown>,
): Array<{ key: string; value: Record<string, unknown> }> {
  const out: Array<{ key: string; value: Record<string, unknown> }> = [];
  const seen = new Set<unknown>();
  const push = (key: string, v: unknown) => {
    if (isPlainObject(v) && !seen.has(v)) {
      seen.add(v);
      out.push({ key, value: v });
    }
  };
  const WELL_KNOWN = ["prediction", "result", "response", "data"];
  for (const k of WELL_KNOWN) {
    if (k in obj) push(k, obj[k]);
  }
  for (const [k, v] of Object.entries(obj)) {
    if (WELL_KNOWN.includes(k)) continue;
    if (isPlainObject(v) && typeof v.type === "string" && typeof v.name === "string") {
      push(k, v);
    }
  }
  return out;
}

/** Hex SHA-256 of `text`, first 8 chars. Web Crypto, edge-compatible. */
async function sha8(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const bytes = new Uint8Array(buf);
    let hex = "";
    for (let i = 0; i < 4; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  } catch {
    return "";
  }
}

export type ZodIssueLite = {
  code: string;
  path: ReadonlyArray<string | number>;
  received?: unknown;
};

/**
 * Phase 1.8c.3a — envelope wrapper keys recognized by the strict
 * single-level unwrap pass. Actual unwrap requires that EXACTLY ONE of
 * these keys be present at the top level (and the top-level object is
 * missing one or more required schema fields).
 */
export const ENVELOPE_WRAPPER_KEYS = [
  "content",
  "data",
  "result",
  "output",
  "response",
] as const;
export type EnvelopeWrapperKey = (typeof ENVELOPE_WRAPPER_KEYS)[number];
export type EnvelopeChildKind =
  | "object"
  | "json_string"
  | "fenced_json"
  | "non_json_string"
  | "other";

const ENVELOPE_REQUIRED_FIELDS = ["type", "name", "confidence"] as const;

export type TolerantParseAttempts = {
  parse_candidate_count: number;
  parsed_json: boolean;
  contains_code_fence: boolean;
  top_level_keys: string[];
  nested_wrapper_keys: string[];
  best_candidate_keys: string[];
  // Phase 1.8c.3a — strict envelope unwrap telemetry (optional for
  // backwards compat with tests that construct TolerantParseAttempts
  // directly).
  envelope_wrapper_key_present?: boolean;
  envelope_unwrap_attempted?: boolean;
  envelope_unwrap_succeeded?: boolean;
  envelope_unwrap_key?: EnvelopeWrapperKey | null;
  envelope_child_kind?: EnvelopeChildKind | null;
};

export type TolerantParseOutcome =
  | { ok: true; value: unknown; attempts: TolerantParseAttempts }
  | {
      ok: false;
      code: "GEMINI_INVALID_JSON" | "GEMINI_INVALID_SHAPE";
      attempts: TolerantParseAttempts;
      zodIssues?: ZodIssueLite[];
    };

function detectEnvelopeKey(
  obj: Record<string, unknown>,
): EnvelopeWrapperKey | null {
  // Trigger envelope unwrap only when the top-level object is missing one
  // or more required schema fields AND has EXACTLY ONE wrapper key
  // present. Multiple wrapper keys => ambiguous, do not unwrap.
  let missing = false;
  for (const req of ENVELOPE_REQUIRED_FIELDS) {
    if (!(req in obj)) { missing = true; break; }
  }
  if (!missing) return null;
  let found: EnvelopeWrapperKey | null = null;
  for (const k of ENVELOPE_WRAPPER_KEYS) {
    if (k in obj) {
      if (found !== null) return null; // ambiguous
      found = k;
    }
  }
  return found;
}

function classifyEnvelopeChild(value: unknown): {
  kind: EnvelopeChildKind;
  parsed?: unknown;
} {
  if (isPlainObject(value)) return { kind: "object", parsed: value };
  if (typeof value !== "string") return { kind: "other" };
  const trimmed = value.trim();
  // Fenced ```json ... ``` block.
  if (trimmed.startsWith("```")) {
    try {
      const stripped = stripCodeFences(trimmed);
      if (stripped.startsWith("{") || stripped.startsWith("[")) {
        return { kind: "fenced_json", parsed: JSON.parse(stripped) };
      }
    } catch { /* fall through */ }
    return { kind: "fenced_json" };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { return { kind: "json_string", parsed: JSON.parse(trimmed) }; }
    catch { return { kind: "json_string" }; }
  }
  return { kind: "non_json_string" };
}

/**
 * Tolerant Gemini JSON parser. Tries candidates in order and returns the
 * first that satisfies `validate(candidate).success === true`:
 *   1. JSON.parse(stripCodeFences(text))
 *   2. JSON.parse(firstBalancedObject(text))
 *   3. For each parsed object from (1)/(2): conservative nested wrappers.
 *   4. Phase 1.8c.3a: strict single-level envelope unwrap on a parsed
 *      root that has EXACTLY ONE of ENVELOPE_WRAPPER_KEYS and is missing
 *      a required schema field. Child may be object, JSON-like string
 *      ({/[ prefix after trim), or ```json fenced block. Single level
 *      only; no recursion; never parses arbitrary prose.
 *
 * On failure, threads attempts metadata + Zod issues from the best failed
 * candidate (fewest issues) so diagnostics reflect real parser behavior.
 */
export function tolerantParseGeminiJson(
  text: string,
  validate: (
    v: unknown,
  ) => { success: boolean; error?: { issues?: ReadonlyArray<ZodIssueLite> } | null },
): TolerantParseOutcome {
  const containsCodeFence = text.includes("```");
  const parsedRoots: unknown[] = [];
  const failedCandidates: Array<{ keys: string[]; issues: ZodIssueLite[] }> = [];
  let parseCandidateCount = 0;
  let topLevelKeys: string[] = [];
  const nestedWrapperKeys: string[] = [];
  let envelopeWrapperKeyPresent = false;
  let envelopeUnwrapAttempted = false;
  let envelopeUnwrapSucceeded = false;
  let envelopeUnwrapKey: EnvelopeWrapperKey | null = null;
  let envelopeChildKind: EnvelopeChildKind | null = null;

  const keysOf = (v: unknown): string[] => (isPlainObject(v) ? Object.keys(v) : []);
  const tryValidate = (cand: unknown): boolean => {
    parseCandidateCount++;
    const r = validate(cand);
    if (r.success === true) return true;
    const issues = (r.error?.issues ?? []) as ReadonlyArray<ZodIssueLite>;
    failedCandidates.push({ keys: keysOf(cand), issues: issues.slice() });
    return false;
  };

  const buildAttempts = (): TolerantParseAttempts => {
    let best: { keys: string[]; issues: ZodIssueLite[] } | undefined;
    for (const c of failedCandidates) {
      if (!best || c.issues.length < best.issues.length) best = c;
    }
    return {
      parse_candidate_count: parseCandidateCount,
      parsed_json: parsedRoots.length > 0,
      contains_code_fence: containsCodeFence,
      top_level_keys: topLevelKeys,
      nested_wrapper_keys: Array.from(new Set(nestedWrapperKeys)),
      best_candidate_keys: best?.keys ?? [],
      envelope_wrapper_key_present: envelopeWrapperKeyPresent,
      envelope_unwrap_attempted: envelopeUnwrapAttempted,
      envelope_unwrap_succeeded: envelopeUnwrapSucceeded,
      envelope_unwrap_key: envelopeUnwrapKey,
      envelope_child_kind: envelopeChildKind,
    };
  };

  const noteEnvelopePresence = (root: unknown) => {
    if (envelopeWrapperKeyPresent || !isPlainObject(root)) return;
    for (const k of ENVELOPE_WRAPPER_KEYS) {
      if (k in root) { envelopeWrapperKeyPresent = true; return; }
    }
  };

  // Candidate 1: stripped fences.
  try {
    const v = JSON.parse(stripCodeFences(text));
    parsedRoots.push(v);
    if (topLevelKeys.length === 0) topLevelKeys = keysOf(v);
    noteEnvelopePresence(v);
    if (tryValidate(v)) return { ok: true, value: v, attempts: buildAttempts() };
  } catch { /* fallthrough */ }

  // Candidate 2: first balanced top-level {...} block from raw text.
  const block = extractFirstBalancedObject(text);
  if (block !== null) {
    try {
      const v = JSON.parse(block);
      parsedRoots.push(v);
      if (topLevelKeys.length === 0) topLevelKeys = keysOf(v);
      noteEnvelopePresence(v);
      if (tryValidate(v)) return { ok: true, value: v, attempts: buildAttempts() };
    } catch { /* fallthrough */ }
  }

  // Candidate 3: conservative nested wrappers on each parsed root.
  for (const root of parsedRoots) {
    if (!isPlainObject(root)) continue;
    for (const { key, value } of nestedWrapperCandidates(root)) {
      nestedWrapperKeys.push(key);
      if (tryValidate(value)) return { ok: true, value, attempts: buildAttempts() };
    }
  }

  // Candidate 4 (Phase 1.8c.3a): strict single-level envelope unwrap.
  // First parsed root only. Requires exactly one wrapper key AND missing
  // a required schema field. Never recurses. String children must be
  // JSON-like ({, [, or ```json fenced) — never arbitrary prose.
  for (const root of parsedRoots) {
    if (!isPlainObject(root)) continue;
    const key = detectEnvelopeKey(root);
    if (key === null) continue;
    envelopeUnwrapAttempted = true;
    envelopeUnwrapKey = key;
    const classified = classifyEnvelopeChild(root[key]);
    envelopeChildKind = classified.kind;
    if (classified.parsed !== undefined && isPlainObject(classified.parsed)) {
      if (tryValidate(classified.parsed)) {
        envelopeUnwrapSucceeded = true;
        return { ok: true, value: classified.parsed, attempts: buildAttempts() };
      }
    }
    break; // single-level only
  }

  const attempts = buildAttempts();
  let best: { keys: string[]; issues: ZodIssueLite[] } | undefined;
  for (const c of failedCandidates) {
    if (!best || c.issues.length < best.issues.length) best = c;
  }
  return {
    ok: false,
    code: parsedRoots.length > 0 ? "GEMINI_INVALID_SHAPE" : "GEMINI_INVALID_JSON",
    attempts,
    zodIssues: best?.issues,
  };
}

// ---- Failure diagnostics (failure-log only; never raw text/values) ----

const DIAG_STR_MAX = 64;
const DIAG_ARR_MAX = 12;
const DIAG_SAFE_KEY = /^[A-Za-z0-9_.\-\[\]]+$/;
/** Top-level Zod-required fields in GeminiRawPrediction (kept in sync with schema). */
const DIAG_KNOWN_REQUIRED = ["type", "name", "confidence"];

function diagSanitizeKeyList(arr: ReadonlyArray<unknown>): string[] {
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const truncated = v.slice(0, DIAG_STR_MAX);
    if (!DIAG_SAFE_KEY.test(truncated)) continue;
    out.push(truncated);
    if (out.length >= DIAG_ARR_MAX) break;
  }
  return out;
}

/**
 * Build a diagnostic object for the gemini-failure log line.
 * NEVER includes raw model text, prediction values, URLs, prompts, or secrets.
 * Only shape keys, Zod issue codes/paths, counts, and booleans.
 */
export function geminiFailureDiagnostics(
  rawText: string,
  attempts: TolerantParseAttempts,
  zodIssues?: ReadonlyArray<ZodIssueLite>,
): Record<string, unknown> {
  const top_level_keys = diagSanitizeKeyList(attempts.top_level_keys);
  const nested_wrapper_keys = diagSanitizeKeyList(attempts.nested_wrapper_keys);
  const best_candidate_keys = diagSanitizeKeyList(attempts.best_candidate_keys);

  const codes = new Set<string>();
  const paths = new Set<string>();
  const missing = new Set<string>();

  // Missing required = required fields absent from best candidate's keys.
  for (const req of DIAG_KNOWN_REQUIRED) {
    if (!best_candidate_keys.includes(req)) missing.add(req);
  }

  if (Array.isArray(zodIssues)) {
    for (const issue of zodIssues) {
      try {
        if (issue && typeof issue.code === "string") codes.add(issue.code);
        if (issue && Array.isArray(issue.path)) {
          const pathStr = issue.path.map((p: string | number) => String(p)).join(".");
          if (pathStr) paths.add(pathStr);
          if (issue.code === "invalid_type" && issue.path.length === 1) {
            const received = (issue as { received?: unknown }).received;
            if (received === "undefined" || received === undefined) {
              const key = String(issue.path[0] ?? "");
              if (key) missing.add(key);
            }
          }
        }
      } catch { /* skip malformed issue */ }
    }
  }

  // Refusal heuristic: not parsable JSON, starts with a sentence-like letter,
  // and no balanced {…} block exists. Boolean only — no excerpt.
  let refusal_like = false;
  try {
    if (!attempts.parsed_json) {
      const trimmed = rawText.trim();
      const firstCh = trimmed.charAt(0).toLowerCase();
      if (firstCh === "i" || firstCh === "s" || firstCh === "a") {
        if (extractFirstBalancedObject(rawText) === null) refusal_like = true;
      }
    }
  } catch { /* keep false */ }

  return {
    parse_candidate_count: attempts.parse_candidate_count,
    parsed_json: attempts.parsed_json,
    contains_code_fence: attempts.contains_code_fence,
    top_level_keys,
    nested_wrapper_keys,
    best_candidate_keys,
    zod_issue_codes: diagSanitizeKeyList(Array.from(codes)),
    zod_issue_paths: diagSanitizeKeyList(Array.from(paths)),
    missing_required_fields: diagSanitizeKeyList(Array.from(missing)),
    refusal_like,
  };
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
  const retrievedUrls = urlMeta
    .map((u) => (u.retrievedUrl ?? u.retrieved_url ?? u.url) as unknown)
    .filter((v): v is string => typeof v === "string");

  const groundingChunks = (gm.groundingChunks ?? gm.grounding_chunks ?? []) as unknown[];
  const webSearchQueries = (gm.webSearchQueries ?? gm.web_search_queries ?? []) as unknown[];

  const chunkUris: string[] = [];
  const chunkTitles: string[] = [];
  if (Array.isArray(groundingChunks)) {
    for (const ch of groundingChunks) {
      if (!ch || typeof ch !== "object") continue;
      const web = (ch as Record<string, unknown>).web as
        | Record<string, unknown>
        | undefined;
      if (!web || typeof web !== "object") continue;
      const uri = web.uri;
      const title = web.title;
      if (typeof uri === "string" && uri.length > 0) chunkUris.push(uri);
      if (typeof title === "string" && title.length > 0) chunkTitles.push(title);
    }
  }

  return {
    used_url_context: urlMeta.length > 0,
    used_google_search:
      (Array.isArray(groundingChunks) && groundingChunks.length > 0) ||
      (Array.isArray(webSearchQueries) && webSearchQueries.length > 0),
    url_retrieval_statuses: statuses,
    url_context_failed:
      urlMeta.length > 0 && !statuses.includes("URL_RETRIEVAL_STATUS_SUCCESS"),
    grounding_chunk_uris: chunkUris,
    grounding_chunk_titles: chunkTitles,
    url_context_retrieved_urls: retrievedUrls,
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

/**
 * Phase 1.5b: safe candidate-level diagnostics for Gemini fallback failures.
 * Returns only shape/booleans/strings — never raw text, prompts, URLs, secrets.
 */
function candidateDiagnostics(json: Record<string, unknown>): Record<string, unknown> {
  const candidates = (json.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const cand0 = candidates[0] ?? {};
  const content = (cand0.content as Record<string, unknown> | undefined) ?? {};
  const parts = (content.parts as Array<Record<string, unknown>> | undefined) ?? [];
  const hasTextParts = parts.some(
    (p) => typeof p.text === "string" && (p.text as string).length > 0,
  );
  const gm = (cand0.groundingMetadata ?? cand0.grounding_metadata) as
    | Record<string, unknown>
    | undefined;
  const finishReason =
    typeof cand0.finishReason === "string"
      ? (cand0.finishReason as string).slice(0, 64)
      : typeof cand0.finish_reason === "string"
        ? (cand0.finish_reason as string).slice(0, 64)
        : null;
  return {
    candidate_count: candidates.length,
    finish_reason: finishReason,
    has_text_parts: hasTextParts,
    has_grounding_metadata: !!gm && Object.keys(gm).length > 0,
  };
}

function logLine(payload: Record<string, unknown>): void {
  console.log("[analyze-entity-url-v2] gemini", payload);
}

function sanitizeErrorBody(raw: string): {
  error_status?: string;
  error_code?: number;
  error_message_truncated?: string;
} {
  const MAX = 400;
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX);
  try {
    const j = JSON.parse(raw) as { error?: { status?: unknown; code?: unknown; message?: unknown } };
    const err = j?.error ?? {};
    const out: { error_status?: string; error_code?: number; error_message_truncated?: string } = {};
    if (typeof err.status === "string") out.error_status = err.status.slice(0, 64);
    if (typeof err.code === "number") out.error_code = err.code;
    if (typeof err.message === "string") out.error_message_truncated = collapse(err.message);
    return out;
  } catch {
    return raw ? { error_message_truncated: collapse(raw) } : {};
  }
}

export async function runGeminiJsonMode(args: RunGeminiArgs): Promise<GeminiResult> {
  const apiKey = args.apiKey ?? Deno.env.get("GEMINI_API_KEY_V2") ?? "";
  if (!apiKey) {
    return { ok: false, configured: false };
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? GEMINI_LOCAL_TIMEOUT_MS;
  const t0 = Date.now();

  const tools = args.tools ?? [{ url_context: {} }, { google_search: {} }];
  // Phase 1.8b: Amazon-only thinkingBudget: 0. Non-Amazon stays at 256
  // (Phase 1.8 default) so Nykaa et al. are unchanged. Single source of
  // truth: caller derives `isAmazon` via isStrictAmazonHost() from host_hints.
  const thinkingBudgetUsed = args.isAmazon ? 0 : 256;
  const body = {
    systemInstruction: {
      role: "system",
      parts: [{ text: args.systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: args.userPrompt }],
      },
    ],
    tools,
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      // Phase 1.8 / 1.8b: cap reasoning tokens + guarantee output budget so
      // the model returns text parts instead of STOP-with-no-content. Amazon
      // uses 0 (Phase 1.8b) after empty STOPs persisted at 256; non-Amazon
      // keeps 256. Same config flows through primary, recovery, and the
      // search-only fallback (callGeminiSearchOnly delegates here).
      thinkingConfig: { thinkingBudget: thinkingBudgetUsed },
      maxOutputTokens: 2048,
    },
  };

  // Phase 1.8: prompt-byte telemetry (UTF-8, not UTF-16 .length).
  const enc = new TextEncoder();
  const systemPromptBytes = enc.encode(args.systemPrompt).length;
  const userPromptBytes = enc.encode(args.userPrompt).length;
  const combinedPromptBytes = systemPromptBytes + userPromptBytes;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (args.abortSignal) {
    if (args.abortSignal.aborted) controller.abort();
    else args.abortSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
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
    let bodyText = "";
    try { bodyText = await res.text(); } catch { /* ignore */ }
    const sanitized = sanitizeErrorBody(bodyText);
    logLine({
      ok: false,
      code,
      status: res.status,
      ...sanitized,
      durationMs,
      modelUsed: GEMINI_MODEL,
    });
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

  // Phase 1.8: usage telemetry (numbers only, no prediction values).
  const usage = (json.usageMetadata ?? json.usage_metadata) as
    | Record<string, unknown>
    | undefined;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && isFinite(v) ? v : null;
  const tokensDiag = {
    prompt_token_count: numOrNull(usage?.promptTokenCount ?? usage?.prompt_token_count),
    candidates_token_count: numOrNull(
      usage?.candidatesTokenCount ?? usage?.candidates_token_count,
    ),
    thoughts_token_count: numOrNull(
      usage?.thoughtsTokenCount ?? usage?.thoughts_token_count,
    ),
    total_token_count: numOrNull(usage?.totalTokenCount ?? usage?.total_token_count),
  };
  const promptBytesDiag = {
    system_prompt_bytes: systemPromptBytes,
    user_prompt_bytes: userPromptBytes,
    combined_prompt_bytes: combinedPromptBytes,
    // Phase 1.8b: surface the effective thinking budget so retests don't
    // require source inspection. Number only; no prediction values.
    thinking_budget_used: thinkingBudgetUsed,
    is_amazon: !!args.isAmazon,
  };

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
  const candDiag = candidateDiagnostics(json);
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
      ...candDiag,
      ...tokensDiag,
      ...promptBytesDiag,
      json_parse_ok: false,
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

  const rawTextLength = text.length;
  const rawTextSha8 = await sha8(text);

  const validator = buildGeminiRawPredictionSchema(args.evidenceBaseUrl);
  const outcome = tolerantParseGeminiJson(text, (cand) => validator.safeParse(cand));
  if (!outcome.ok) {
    logLine({
      ok: false,
      code: outcome.code,
      durationMs,
      modelUsed: GEMINI_MODEL,
      used_url_context: grounding.used_url_context,
      used_google_search: grounding.used_google_search,
      url_context_failed: grounding.url_context_failed,
      raw_text_length: rawTextLength,
      raw_text_sha8: rawTextSha8,
      ...candDiag,
      ...tokensDiag,
      ...promptBytesDiag,
      json_parse_ok: false,
      gemini_failure_diagnostics: geminiFailureDiagnostics(text, outcome.attempts, outcome.zodIssues),
    });
    return {
      ok: false,
      configured: true,
      code: outcome.code,
      durationMs,
      model: GEMINI_MODEL,
      grounding,
      rawTextLength,
      rawTextSha8,
    };
  }

  // outcome.value passed Zod via the same schema; re-parse to get typed data.
  const v = validator.safeParse(outcome.value);
  if (!v.success) {
    // Should be unreachable: tolerantParseGeminiJson only returns ok when validate(...).success.
    const fallbackAttempts: TolerantParseAttempts = {
      parse_candidate_count: 1,
      parsed_json: true,
      contains_code_fence: text.includes("```"),
      top_level_keys: [],
      nested_wrapper_keys: [],
      best_candidate_keys: [],
    };
    logLine({
      ok: false,
      code: "GEMINI_INVALID_SHAPE",
      durationMs,
      modelUsed: GEMINI_MODEL,
      raw_text_length: rawTextLength,
      raw_text_sha8: rawTextSha8,
      gemini_failure_diagnostics: geminiFailureDiagnostics(
        text,
        fallbackAttempts,
        v.error?.issues as ReadonlyArray<ZodIssueLite> | undefined,
      ),
    });
    return {
      ok: false,
      configured: true,
      code: "GEMINI_INVALID_SHAPE",
      durationMs,
      model: GEMINI_MODEL,
      grounding,
      rawTextLength,
      rawTextSha8,
    };
  }

  logLine({
    ok: true,
    durationMs,
    modelUsed: GEMINI_MODEL,
    used_url_context: grounding.used_url_context,
    used_google_search: grounding.used_google_search,
    url_context_failed: grounding.url_context_failed,
    raw_text_length: rawTextLength,
    raw_text_sha8: rawTextSha8,
    ...tokensDiag,
    ...promptBytesDiag,
    json_parse_ok: true,
    has_text_parts: true,
  });

  return {
    ok: true,
    configured: true,
    durationMs,
    model: GEMINI_MODEL,
    grounding,
    prediction: v.data,
    rawTextLength,
    rawTextSha8,
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

/**
 * Last-resort search-only Gemini fallback used by the V2 recovery path
 * when the primary `url_context + google_search` call produced nothing
 * usable. Only the tools list changes — same model, temperature,
 * prompts, parser, schema, and recovery gate apply downstream.
 *
 * The caller MUST gate this behind the strict trigger conditions
 * documented in analyze-entity-url-v2/index.ts (recovery path only,
 * no prior valid prediction, sufficient budget).
 */
export function callGeminiSearchOnly(
  args: Omit<RunGeminiArgs, "tools" | "timeoutMs"> & { timeoutMs?: number },
): Promise<GeminiResult> {
  return runGeminiJsonMode({
    ...args,
    tools: [{ google_search: {} }],
    timeoutMs: args.timeoutMs ?? SEARCH_FALLBACK_TIMEOUT_MS,
    logLabel: "search_fallback",
  });
}

