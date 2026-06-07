// Phase 6: Firecrawl fallback client.
//
// Narrow surface: one POST to /v2/scrape with formats=['html','rawHtml'].
// No markdown, no summary, no JSON extraction. 12s budget, 2 MB HTML cap.
// All errors and the response shape are sanitized for the V2 envelope.

export type FirecrawlErrorCode =
  | "FIRECRAWL_NOT_CONFIGURED"
  | "FIRECRAWL_TIMEOUT"
  | "FIRECRAWL_HTTP_ERROR"
  | "FIRECRAWL_INSUFFICIENT_CREDITS"
  | "FIRECRAWL_BAD_RESPONSE"
  | "FIRECRAWL_RESPONSE_TOO_LARGE";

export interface FirecrawlSuccess {
  ok: true;
  html: string;
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

export interface FirecrawlOpts {
  /** Local AbortController timeout (ms). Should be >= apiTimeoutMs. */
  timeoutMs?: number;
  /** Value sent in the Firecrawl request body as `timeout` (ms). */
  apiTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  /** Used when Firecrawl returns no usable finalUrl. */
  fallbackBaseUrl?: string;
}

export const NORMAL_FIRECRAWL_API_TIMEOUT_MS = 12_000;
export const NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS = 12_000;
export const HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS = 30_000;
export const HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS = 32_000;

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB, mirrors fetcher.
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(FIRECRAWL_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html", "rawHtml"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: apiTimeoutMs,
      }),
      signal: controller.signal,
    });

    if (res.status === 402) {
      return {
        ok: false,
        code: "FIRECRAWL_INSUFFICIENT_CREDITS",
        status: 402,
        durationMs: Date.now() - started,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "FIRECRAWL_HTTP_ERROR",
        status: res.status,
        durationMs: Date.now() - started,
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        ok: false,
        code: "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }

    const data =
      body && typeof body === "object" && "data" in body
        ? (body as Record<string, unknown>).data
        : body;
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        code: "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }
    const d = data as Record<string, unknown>;
    const html =
      (typeof d.html === "string" && d.html) ||
      (typeof d.rawHtml === "string" && d.rawHtml) ||
      "";
    if (!html) {
      return {
        ok: false,
        code: "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }
    if (html.length > MAX_HTML_BYTES) {
      return {
        ok: false,
        code: "FIRECRAWL_RESPONSE_TOO_LARGE",
        durationMs: Date.now() - started,
      };
    }

    let candidate: unknown = undefined;
    const meta = d.metadata;
    if (meta && typeof meta === "object") {
      const m = meta as Record<string, unknown>;
      candidate = m.sourceURL ?? m.url;
    }
    candidate = candidate ?? (d as Record<string, unknown>).finalUrl ?? (d as Record<string, unknown>).url;

    return {
      ok: true,
      html,
      finalUrl: safeBaseUrl(candidate, fallback),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      code: isAbort ? "FIRECRAWL_TIMEOUT" : "FIRECRAWL_HTTP_ERROR",
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
