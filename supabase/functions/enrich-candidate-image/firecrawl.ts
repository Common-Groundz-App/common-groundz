// Phase 6: Firecrawl fallback client.
//
// Narrow surface: one POST to /v2/scrape. Requests formats=['html','markdown']
// and also tolerates rawHtml in responses. 25s budget, 2 MB caps on html and
// markdown. metadata and markdown are internal — never serialized into the
// V2 response. A scrape is considered usable if ANY of html / markdown /
// metadata is present. Oversize HTML alone does NOT fail the scrape — it is
// dropped and recovery proceeds from metadata/markdown when those are usable.
//
// Phase 1.8c.5: diagnostic-only shape logging. `buildFirecrawlShapeDiagnostic`
// is a pure helper that produces a privacy-safe object describing what we
// sent to Firecrawl and what shape we got back. `runFirecrawlScrape` emits
// exactly one log line per invocation when FIRECRAWL_SHAPE_DIAG_ENABLED is
// true. No behavior changes — request body, formats, timeouts, return shape
// and error codes are unchanged. Flip the flag below to disable cleanly.

export type FirecrawlErrorCode =
  | "FIRECRAWL_NOT_CONFIGURED"
  | "FIRECRAWL_TIMEOUT"
  | "FIRECRAWL_HTTP_ERROR"
  | "FIRECRAWL_INSUFFICIENT_CREDITS"
  | "FIRECRAWL_BAD_RESPONSE"
  | "FIRECRAWL_RESPONSE_TOO_LARGE";

export interface FirecrawlSuccess {
  ok: true;
  /** May be empty string when only markdown/metadata was returned, or when
   *  the raw HTML exceeded MAX_HTML_BYTES and was dropped. */
  html: string;
  /** Internal only. Null when missing or oversize. */
  markdown: string | null;
  /** Internal only. Null when missing. */
  metadata: Record<string, unknown> | null;
  /** Sanitized http(s) URL the extractor should use as base. */
  finalUrl: string;
  durationMs: number;
}

export interface FirecrawlFailure {
  ok: false;
  code: FirecrawlErrorCode;
  status?: number;
  durationMs: number;
}

export type FirecrawlResult = FirecrawlSuccess | FirecrawlFailure;

export interface FirecrawlDiagContext {
  requestId: string;
  callSite: "main" | "recovery";
}

export interface FirecrawlOpts {
  /** Local AbortController timeout (ms). Should be >= apiTimeoutMs. */
  timeoutMs?: number;
  /** Value sent in the Firecrawl request body as `timeout` (ms). */
  apiTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  /** Used when Firecrawl returns no usable finalUrl. */
  fallbackBaseUrl?: string;
  /**
   * Phase 1.8: override the maximum accepted Firecrawl HTML / markdown
   * byte size for this single call. Defaults to DEFAULT_MAX_HTML_BYTES
   * (2 MiB). Callers raise this to 4 MiB for strict Amazon hosts only,
   * to mirror the direct-fetch cap so large Amazon HTML can still feed
   * the extractor (pageSignals). The enlarged HTML is NOT forwarded to
   * the Gemini prompt when pageSignals are present.
   */
  maxHtmlBytes?: number;
  /** Phase 1.8c.5: correlation context for the shape diagnostic log. */
  diagContext?: FirecrawlDiagContext;
  /** v8b.1: override the `waitFor` value sent to Firecrawl. Defaults to 1500ms. */
  waitFor?: number;
}

export const NORMAL_FIRECRAWL_API_TIMEOUT_MS = 25_000;
export const NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS = 27_000;
export const HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS = 30_000;
export const HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS = 32_000;

export const DEFAULT_MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB, mirrors fetcher default.
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

/** Phase 1.8c.5: master switch for diagnostic-only shape logging. */
export const FIRECRAWL_SHAPE_DIAG_ENABLED = true;

/**
 * Return an http(s) URL string usable as an extractor base, or null.
 * Rejects javascript:, data:, file:, blob:, mailto:, etc. and malformed URLs.
 */
export function safeBaseUrl(
  candidate: unknown,
  fallback: string,
): string {
  if (typeof candidate === "string" && candidate.length > 0) {
    try {
      const u = new URL(candidate);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return u.toString();
      }
    } catch {
      // fall through
    }
  }
  return fallback;
}

// ===========================================================================
// Phase 1.8c.5: shape diagnostic helper
// ===========================================================================

const SAFE_ERROR_CODE_RE = /^[A-Za-z0-9_\-.]+$/;
const METADATA_KEY_CAP = 50;
const METADATA_KEY_CHAR_CAP = 40;
const TEXT_ENCODER = new TextEncoder();

function utf8Bytes(v: unknown): number {
  return typeof v === "string" ? TEXT_ENCODER.encode(v).length : 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safeErrorCode(body: unknown): string | null {
  if (!isPlainObject(body)) return null;
  const candidates: unknown[] = [];
  const err = body.error;
  if (isPlainObject(err)) candidates.push(err.code);
  candidates.push(body.code);
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0 && c.length <= 40 && SAFE_ERROR_CODE_RE.test(c)) {
      return c;
    }
  }
  return null;
}

function pickDataUnwrap(body: unknown): {
  path: "body.data" | "body.result" | "body" | "none";
  data: Record<string, unknown> | null;
} {
  if (isPlainObject(body)) {
    if (isPlainObject(body.data)) return { path: "body.data", data: body.data };
    if (isPlainObject(body.result)) return { path: "body.result", data: body.result };
    // Treat top-level body as data only if it carries any of the known content keys.
    const flatKeys = ["html", "rawHtml", "markdown", "metadata", "content", "json", "links", "screenshot", "summary"];
    if (flatKeys.some((k) => k in body)) return { path: "body", data: body };
  }
  return { path: "none", data: null };
}

export function buildFirecrawlShapeDiagnostic(input: {
  requestArgs: {
    urlHost: string;
    urlHasQueryString: boolean;
    isAmazon: boolean;
    formats: string[];
    onlyMainContent: boolean;
    waitForMs: number;
    apiTimeoutMs: number;
    localTimeoutMs: number;
    maxHtmlBytes: number;
    payloadKeys: string[];
    proxySettingPresent?: boolean;
    locationSettingPresent?: boolean;
    cacheSettingPresent?: boolean;
  };
  response?: {
    httpStatus: number;
    contentType: string | null;
    body: unknown;
    parseOk: boolean;
    bodyParseFailed: boolean;
  };
  failure?: {
    errorKind: "http_error" | "timeout" | "parse_error" | "network_error" | "unknown";
    aborted: boolean;
  };
  htmlOversizeDropped: boolean;
  durationMs: number;
  context: FirecrawlDiagContext;
}): Record<string, unknown> {
  const { requestArgs, response, failure, htmlOversizeDropped, durationMs, context } = input;

  const out: Record<string, unknown> = {
    request_id: context.requestId,
    call_site: context.callSite,
    is_amazon: requestArgs.isAmazon,
    url_host: requestArgs.urlHost,
    url_has_query_string: requestArgs.urlHasQueryString,

    endpoint: "v2/scrape",
    method_used: "scrape",
    formats_requested: requestArgs.formats,
    only_main_content: requestArgs.onlyMainContent,
    wait_for_ms: requestArgs.waitForMs,
    api_timeout_ms: requestArgs.apiTimeoutMs,
    local_timeout_ms: requestArgs.localTimeoutMs,
    max_html_bytes: requestArgs.maxHtmlBytes,
    proxy_setting_present: !!requestArgs.proxySettingPresent,
    location_setting_present: !!requestArgs.locationSettingPresent,
    cache_setting_present: !!requestArgs.cacheSettingPresent,
    request_payload_keys: [...requestArgs.payloadKeys].sort(),

    html_oversize_dropped: htmlOversizeDropped,
    duration_ms: durationMs,

    // Failure-shape fields (null on success).
    error_kind: failure?.errorKind ?? null,
    aborted: failure?.aborted ?? null,
    parse_ok: response?.parseOk ?? null,
    body_parse_failed: response?.bodyParseFailed ?? null,
  };

  // Response defaults (null when no response captured, e.g. network/timeout pre-response).
  out.http_status = response?.httpStatus ?? null;
  out.content_type = response?.contentType ?? null;
  out.firecrawl_success = null;
  out.firecrawl_error_present = null;
  out.firecrawl_error_code = null;
  out.proxy_used = null;
  out.cache_state = null;
  out.credits_used = null;
  out.response_keys = null;
  out.data_keys = null;
  out.data_unwrap_path = "none";
  out.has_metadata = false;
  out.has_markdown = false;
  out.has_html = false;
  out.has_raw_html = false;
  out.has_content = false;
  out.has_json = false;
  out.has_links = false;
  out.has_screenshot = false;
  out.has_summary = false;
  out.metadata_key_count = 0;
  out.metadata_keys = [];
  out.metadata_title_present = false;
  out.metadata_description_present = false;
  out.metadata_og_title_present = false;
  out.metadata_og_description_present = false;
  out.markdown_bytes = 0;
  out.html_bytes = 0;
  out.raw_html_bytes = 0;
  out.content_bytes = 0;
  out.json_key_count = 0;

  if (!response || !response.parseOk || response.bodyParseFailed) {
    return out;
  }

  const body = response.body;
  if (isPlainObject(body)) {
    out.response_keys = Object.keys(body).sort();
    out.firecrawl_success = typeof body.success === "boolean" ? body.success : null;
    out.firecrawl_error_present = body.error !== undefined && body.error !== null;
    out.firecrawl_error_code = safeErrorCode(body);
    out.credits_used = typeof body.creditsUsed === "number" ? body.creditsUsed : null;
  }

  const { path, data } = pickDataUnwrap(body);
  out.data_unwrap_path = path;
  if (data) {
    out.data_keys = Object.keys(data).sort();
    out.has_metadata = isPlainObject(data.metadata);
    out.has_markdown = typeof data.markdown === "string";
    out.has_html = typeof data.html === "string";
    out.has_raw_html = typeof data.rawHtml === "string";
    out.has_content = typeof data.content === "string";
    out.has_json = data.json !== undefined && data.json !== null;
    out.has_links = Array.isArray(data.links);
    out.has_screenshot = typeof data.screenshot === "string";
    out.has_summary = typeof data.summary === "string";

    out.markdown_bytes = utf8Bytes(data.markdown);
    out.html_bytes = utf8Bytes(data.html);
    out.raw_html_bytes = utf8Bytes(data.rawHtml);
    out.content_bytes = utf8Bytes(data.content);
    out.json_key_count = isPlainObject(data.json) ? Object.keys(data.json).length : 0;

    if (isPlainObject(data.metadata)) {
      const md = data.metadata;
      const keys = Object.keys(md);
      out.metadata_key_count = keys.length;
      out.metadata_keys = keys
        .slice()
        .sort()
        .slice(0, METADATA_KEY_CAP)
        .map((k) => (k.length > METADATA_KEY_CHAR_CAP ? k.slice(0, METADATA_KEY_CHAR_CAP) : k));
      out.metadata_title_present = "title" in md;
      out.metadata_description_present = "description" in md;
      out.metadata_og_title_present = "ogTitle" in md || "og:title" in md;
      out.metadata_og_description_present = "ogDescription" in md || "og:description" in md;
      out.proxy_used = typeof md.proxyUsed === "string" ? md.proxyUsed : (md.proxyUsed ?? null);
      out.cache_state = typeof md.cacheState === "string" ? md.cacheState : (md.cacheState ?? null);
    }
  }

  return out;
}

function emitShapeDiag(diag: Record<string, unknown>): void {
  if (!FIRECRAWL_SHAPE_DIAG_ENABLED) return;
  try {
    console.log("[analyze-entity-url-v2] firecrawl.shape_diag", JSON.stringify(diag));
  } catch {
    // Never let logging break the request path.
  }
}

export async function runFirecrawlScrape(
  url: string,
  opts: FirecrawlOpts = {},
): Promise<FirecrawlResult> {
  const started = Date.now();
  const apiKey = opts.apiKey ?? Deno.env.get("FIRECRAWL_API_KEY") ?? "";
  if (!apiKey) {
    return {
      ok: false,
      code: "FIRECRAWL_NOT_CONFIGURED",
      durationMs: Date.now() - started,
    };
  }

  const apiTimeoutMs = opts.apiTimeoutMs ?? NORMAL_FIRECRAWL_API_TIMEOUT_MS;
  const timeoutMs = opts.timeoutMs ?? NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const fallback = opts.fallbackBaseUrl ?? url;
  const maxHtmlBytes = opts.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES;
  const diagContext: FirecrawlDiagContext = opts.diagContext ?? {
    requestId: "unknown",
    callSite: "main",
  };

  // Derive shape-diag request fields from the already-validated URL we are
  // about to send to Firecrawl. Never logs raw query strings.
  let urlHost = "";
  let urlHasQueryString = false;
  let isAmazon = false;
  try {
    const parsed = new URL(url);
    urlHost = parsed.host;
    urlHasQueryString = parsed.search.length > 0;
    isAmazon = /(^|\.)amazon\./i.test(parsed.host);
  } catch {
    // leave defaults
  }

  const requestBody: Record<string, unknown> = {
    url,
    formats: ["html", "markdown"],
    onlyMainContent: false,
    waitFor: opts.waitFor ?? 1500,
    timeout: apiTimeoutMs,
  };
  const requestArgs = {
    urlHost,
    urlHasQueryString,
    isAmazon,
    formats: requestBody.formats as string[],
    onlyMainContent: requestBody.onlyMainContent as boolean,
    waitForMs: requestBody.waitFor as number,
    apiTimeoutMs,
    localTimeoutMs: timeoutMs,
    maxHtmlBytes,
    payloadKeys: Object.keys(requestBody),
    proxySettingPresent: "proxy" in requestBody,
    locationSettingPresent: "location" in requestBody,
    cacheSettingPresent: "cache" in requestBody || "maxAge" in requestBody,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let htmlOversizeDropped = false;
  let res: Response | null = null;
  let parsedBody: unknown = undefined;
  let parseOk = false;
  let bodyParseFailed = false;

  try {
    res = await fetchImpl(FIRECRAWL_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (res.status === 402) {
      emitShapeDiag(buildFirecrawlShapeDiagnostic({
        requestArgs,
        response: { httpStatus: 402, contentType: res.headers.get("content-type"), body: undefined, parseOk: false, bodyParseFailed: false },
        failure: { errorKind: "http_error", aborted: false },
        htmlOversizeDropped,
        durationMs: Date.now() - started,
        context: diagContext,
      }));
      return {
        ok: false,
        code: "FIRECRAWL_INSUFFICIENT_CREDITS",
        status: 402,
        durationMs: Date.now() - started,
      };
    }
    if (!res.ok) {
      emitShapeDiag(buildFirecrawlShapeDiagnostic({
        requestArgs,
        response: { httpStatus: res.status, contentType: res.headers.get("content-type"), body: undefined, parseOk: false, bodyParseFailed: false },
        failure: { errorKind: "http_error", aborted: false },
        htmlOversizeDropped,
        durationMs: Date.now() - started,
        context: diagContext,
      }));
      return {
        ok: false,
        code: "FIRECRAWL_HTTP_ERROR",
        status: res.status,
        durationMs: Date.now() - started,
      };
    }

    try {
      parsedBody = await res.json();
      parseOk = true;
    } catch {
      bodyParseFailed = true;
      emitShapeDiag(buildFirecrawlShapeDiagnostic({
        requestArgs,
        response: { httpStatus: res.status, contentType: res.headers.get("content-type"), body: undefined, parseOk: false, bodyParseFailed: true },
        failure: { errorKind: "parse_error", aborted: false },
        htmlOversizeDropped,
        durationMs: Date.now() - started,
        context: diagContext,
      }));
      return {
        ok: false,
        code: "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }

    const body = parsedBody;
    const data =
      body && typeof body === "object" && "data" in body
        ? (body as Record<string, unknown>).data
        : body;
    if (!data || typeof data !== "object") {
      emitShapeDiag(buildFirecrawlShapeDiagnostic({
        requestArgs,
        response: { httpStatus: res.status, contentType: res.headers.get("content-type"), body, parseOk: true, bodyParseFailed: false },
        failure: { errorKind: "parse_error", aborted: false },
        htmlOversizeDropped,
        durationMs: Date.now() - started,
        context: diagContext,
      }));
      return {
        ok: false,
        code: "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }
    const d = data as Record<string, unknown>;

    const rawHtmlInitial =
      (typeof d.html === "string" && d.html) ||
      (typeof d.rawHtml === "string" && d.rawHtml) ||
      "";
    // Oversize HTML alone no longer fails the scrape — drop the HTML and
    // continue with metadata/markdown if those are usable.
    const htmlOversize = rawHtmlInitial.length > maxHtmlBytes;
    htmlOversizeDropped = htmlOversize;
    const rawHtml = htmlOversize ? "" : rawHtmlInitial;

    const rawMd = typeof d.markdown === "string" ? d.markdown : "";
    const markdown =
      rawMd && rawMd.length <= maxHtmlBytes ? rawMd : null;

    const meta = d.metadata;
    const metadata =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null;

    // Usable if ANY of html / markdown / metadata is present.
    if (!rawHtml && !markdown && !metadata) {
      const code: FirecrawlErrorCode = htmlOversize
        ? "FIRECRAWL_RESPONSE_TOO_LARGE"
        : "FIRECRAWL_BAD_RESPONSE";
      emitShapeDiag(buildFirecrawlShapeDiagnostic({
        requestArgs,
        response: { httpStatus: res.status, contentType: res.headers.get("content-type"), body, parseOk: true, bodyParseFailed: false },
        failure: { errorKind: code === "FIRECRAWL_RESPONSE_TOO_LARGE" ? "http_error" : "parse_error", aborted: false },
        htmlOversizeDropped,
        durationMs: Date.now() - started,
        context: diagContext,
      }));
      return {
        ok: false,
        code,
        durationMs: Date.now() - started,
      };
    }

    let candidate: unknown = undefined;
    if (metadata) {
      candidate = metadata.sourceURL ?? metadata.url;
    }
    candidate = candidate ?? d.finalUrl ?? d.url;

    emitShapeDiag(buildFirecrawlShapeDiagnostic({
      requestArgs,
      response: { httpStatus: res.status, contentType: res.headers.get("content-type"), body, parseOk: true, bodyParseFailed: false },
      htmlOversizeDropped,
      durationMs: Date.now() - started,
      context: diagContext,
    }));

    return {
      ok: true,
      html: rawHtml,
      markdown,
      metadata,
      finalUrl: safeBaseUrl(candidate, fallback),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === "AbortError";
    emitShapeDiag(buildFirecrawlShapeDiagnostic({
      requestArgs,
      response: res
        ? { httpStatus: res.status, contentType: res.headers.get("content-type"), body: parsedBody, parseOk, bodyParseFailed }
        : undefined,
      failure: {
        errorKind: isAbort ? "timeout" : "network_error",
        aborted: isAbort,
      },
      htmlOversizeDropped,
      durationMs: Date.now() - started,
      context: diagContext,
    }));
    return {
      ok: false,
      code: isAbort ? "FIRECRAWL_TIMEOUT" : "FIRECRAWL_HTTP_ERROR",
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
