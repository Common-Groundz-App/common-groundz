// Phase 6: Firecrawl fallback client.
//
// Narrow surface: one POST to /v2/scrape. Requests formats=['html','markdown']
// and also tolerates rawHtml in responses. 25s budget, 2 MB caps on html and
// markdown. metadata and markdown are internal — never serialized into the
// V2 response. A scrape is considered usable if ANY of html / markdown /
// metadata is present. Oversize HTML alone does NOT fail the scrape — it is
// dropped and recovery proceeds from metadata/markdown when those are usable.

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
}

export const NORMAL_FIRECRAWL_API_TIMEOUT_MS = 25_000;
export const NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS = 27_000;
export const HIGH_PRIORITY_FIRECRAWL_API_TIMEOUT_MS = 30_000;
export const HIGH_PRIORITY_FIRECRAWL_LOCAL_TIMEOUT_MS = 32_000;

export const DEFAULT_MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB, mirrors fetcher default.
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
  const maxHtmlBytes = opts.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES;

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
        formats: ["html", "markdown"],
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

    const rawHtmlInitial =
      (typeof d.html === "string" && d.html) ||
      (typeof d.rawHtml === "string" && d.rawHtml) ||
      "";
    // Oversize HTML alone no longer fails the scrape — drop the HTML and
    // continue with metadata/markdown if those are usable.
    const htmlOversize = rawHtmlInitial.length > MAX_HTML_BYTES;
    const rawHtml = htmlOversize ? "" : rawHtmlInitial;

    const rawMd = typeof d.markdown === "string" ? d.markdown : "";
    const markdown =
      rawMd && rawMd.length <= MAX_HTML_BYTES ? rawMd : null;

    const meta = d.metadata;
    const metadata =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null;

    // Usable if ANY of html / markdown / metadata is present.
    if (!rawHtml && !markdown && !metadata) {
      return {
        ok: false,
        // Preserve the oversize code when oversize HTML was the cause and
        // nothing else was usable; otherwise it's a generic bad response.
        code: htmlOversize
          ? "FIRECRAWL_RESPONSE_TOO_LARGE"
          : "FIRECRAWL_BAD_RESPONSE",
        durationMs: Date.now() - started,
      };
    }

    let candidate: unknown = undefined;
    if (metadata) {
      candidate = metadata.sourceURL ?? metadata.url;
    }
    candidate = candidate ?? d.finalUrl ?? d.url;

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
    return {
      ok: false,
      code: isAbort ? "FIRECRAWL_TIMEOUT" : "FIRECRAWL_HTTP_ERROR",
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
