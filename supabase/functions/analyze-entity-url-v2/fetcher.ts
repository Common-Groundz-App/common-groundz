// Phase 4B: safe-fetch boundary for analyze-entity-url-v2.
//
// Performs one safe fetch operation per call. Up to (1 + maxRedirects) HTTP
// requests internally. SSRF preflight runs on the initial URL and on every
// redirect target via assertSafeUrl().
//
// Security posture (honest): performs BEST-EFFORT pre-fetch DNS revalidation
// on the initial URL and every redirect target. Does NOT pin the connected
// socket to the validated IP — standard fetch() resolves DNS again internally
// at connect time, so a hostile authoritative DNS server could in principle
// return a public IP during preflight and a private IP at connect (DNS
// rebinding). For this reason, V2 stays admin-only in Phase 4B.
//
// Timeout model: `timeoutMs` is a SINGLE TOTAL BUDGET covering preflight DNS,
// every redirect-hop DNS recheck, headers, and full body streaming. No
// per-hop reset.

import { assertSafeUrl, type DnsResolver, SsrfError } from "./ssrf.ts";

export type FetchErrorCode =
  | "FETCH_TIMEOUT"
  | "FETCH_TOO_LARGE"
  | "FETCH_TOO_MANY_REDIRECTS"
  | "FETCH_BAD_CONTENT_TYPE"
  | "FETCH_BAD_STATUS"
  | "FETCH_NETWORK_ERROR"
  | "BLOCKED_HOST"
  | "DNS_RESOLUTION_FAILED"
  | "INVALID_URL";

export class FetchError extends Error {
  code: FetchErrorCode;
  /** Internal diagnostic only. Never echoed to clients, never logged. */
  reason?: string;
  constructor(code: FetchErrorCode, opts?: { reason?: string; message?: string }) {
    super(opts?.message ?? code);
    this.code = code;
    this.reason = opts?.reason;
    this.name = "FetchError";
  }
}

export interface FetchOpts {
  /** Total budget covering preflight DNS, redirects, headers, body. Default 8000ms. */
  timeoutMs?: number;
  /** Hard cap on actually-received bytes. Default 2 MiB. */
  maxBytes?: number;
  /** Default 3. */
  maxRedirects?: number;
  /** Default ['text/html','application/xhtml+xml']. Parameters stripped before match. */
  allowedContentTypes?: string[];
  /** REQUIRED. Production handler passes Deno.resolveDns. Tests inject a fake. */
  resolveDns: DnsResolver;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

/** Internal result. NOT serialized to the edge response. */
export interface FetchResult {
  finalUrl: string;
  status: number;
  /** Lowercased, parameters stripped. */
  contentType: string;
  /** INTERNAL — Phase 5 consumer. Never logged, never serialized. */
  bodyText: string;
  bytes: number;
  /** INTERNAL — never serialized. */
  redirectChain: string[];
  durationMs: number;
}

const DEFAULTS = {
  timeoutMs: 8000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
  userAgent: "Mozilla/5.0 (compatible; CommonGroundzAnalyzer/2.0)",
};

/**
 * Races a promise against an absolute deadline (ms epoch).
 * `onTimeout` may be sync or async; it MUST throw. Typed as
 * `() => never | Promise<never>` so async cancel-then-throw works without
 * swallowing the FetchError.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  onTimeout: () => never | Promise<never>,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    // Already expired — invoke onTimeout (must throw).
    await onTimeout();
    // Defensive: onTimeout should throw; if it doesn't, surface as timeout.
    throw new FetchError("FETCH_TIMEOUT", { reason: "deadline_expired" });
  }

  let timer: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // onTimeout MUST throw (sync or async). Convert its rejection into ours.
      Promise.resolve()
        .then(() => onTimeout())
        .then(
          () => reject(new FetchError("FETCH_TIMEOUT", { reason: "deadline_expired" })),
          (e) => reject(e),
        );
    }, remaining) as unknown as number;
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Dedicated body-read helper. Races reader.read() against the deadline.
 * On timeout, throws FETCH_TIMEOUT (reason 'body_stream_timeout') SYNCHRONOUSLY
 * from onTimeout and cancels the reader AFTER the throw — awaiting cancel()
 * here would resolve the pending reader.read() and let it win the race.
 * Required so streams that ignore AbortSignal still honor the total budget.
 */
export async function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timedOut = false;
  try {
    return await withDeadline(
      reader.read(),
      deadline,
      () => {
        timedOut = true;
        throw new FetchError("FETCH_TIMEOUT", { reason: "body_stream_timeout" });
      },
    );
  } catch (e) {
    if (timedOut) {
      reader.cancel().catch(() => {});
    }
    throw e;
  }
}

function parseContentType(raw: string | null): string {
  if (!raw) return "";
  const semi = raw.indexOf(";");
  const base = semi >= 0 ? raw.slice(0, semi) : raw;
  return base.trim().toLowerCase();
}

function isRedirectStatus(s: number): boolean {
  return s === 301 || s === 302 || s === 303 || s === 307 || s === 308;
}

function isSsrfErrorInstance(e: unknown): e is SsrfError {
  return e instanceof SsrfError ||
    (typeof e === "object" && e !== null && (e as { name?: string }).name === "SsrfError");
}

function ssrfToFetchError(e: SsrfError): FetchError {
  if (e.code === "BLOCKED_HOST") {
    return new FetchError("BLOCKED_HOST", { reason: e.reason ?? "blocked_host" });
  }
  if (e.code === "DNS_RESOLUTION_FAILED") {
    return new FetchError("DNS_RESOLUTION_FAILED", { reason: e.reason });
  }
  return new FetchError("INVALID_URL", { reason: e.reason });
}

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

export async function validateAndFetchUrl(
  input: string,
  opts: FetchOpts,
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = opts.maxBytes ?? DEFAULTS.maxBytes;
  const maxRedirects = opts.maxRedirects ?? DEFAULTS.maxRedirects;
  const allowedContentTypes = opts.allowedContentTypes ?? DEFAULTS.allowedContentTypes;
  const ua = opts.userAgent ?? DEFAULTS.userAgent;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const start = Date.now();
  const deadline = start + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs) as unknown as number;

  try {
    // ----- initial preflight -----
    let safe;
    try {
      safe = await withDeadline(
        assertSafeUrl(input, { resolveDns: opts.resolveDns }),
        deadline,
        () => {
          throw new FetchError("FETCH_TIMEOUT", { reason: "preflight_timeout" });
        },
      );
    } catch (e) {
      if (e instanceof FetchError) throw e;
      if (isSsrfErrorInstance(e)) throw ssrfToFetchError(e);
      throw new FetchError("FETCH_NETWORK_ERROR", { reason: String((e as Error)?.message ?? e) });
    }

    let current = safe.url;
    const redirectChain: string[] = [current];

    for (let hop = 0; hop <= maxRedirects; hop++) {
      let resp: Response;
      try {
        resp = await fetchImpl(current, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
            "Accept-Language": "en",
          },
        });
      } catch (e) {
        if (isAbortError(e)) {
          throw new FetchError("FETCH_TIMEOUT", { reason: "fetch_aborted" });
        }
        throw new FetchError("FETCH_NETWORK_ERROR", {
          reason: String((e as Error)?.message ?? e),
        });
      }

      if (isRedirectStatus(resp.status)) {
        // Drain/cancel body of redirect response to free the connection.
        try { await resp.body?.cancel(); } catch { /* ignore */ }

        if (hop >= maxRedirects) {
          throw new FetchError("FETCH_TOO_MANY_REDIRECTS");
        }
        const loc = resp.headers.get("Location");
        if (!loc) {
          throw new FetchError("FETCH_BAD_STATUS", { reason: "redirect_no_location" });
        }
        let nextUrl: string;
        try {
          nextUrl = new URL(loc, current).toString();
        } catch {
          throw new FetchError("FETCH_BAD_STATUS", { reason: "redirect_bad_location" });
        }
        let nextSafe;
        try {
          nextSafe = await withDeadline(
            assertSafeUrl(nextUrl, { resolveDns: opts.resolveDns }),
            deadline,
            () => {
              throw new FetchError("FETCH_TIMEOUT", { reason: "redirect_preflight_timeout" });
            },
          );
        } catch (e) {
          if (e instanceof FetchError) throw e;
          if (isSsrfErrorInstance(e)) throw ssrfToFetchError(e);
          throw new FetchError("FETCH_NETWORK_ERROR", {
            reason: String((e as Error)?.message ?? e),
          });
        }
        current = nextSafe.url;
        redirectChain.push(current);
        continue;
      }

      if (resp.status < 200 || resp.status > 299) {
        try { await resp.body?.cancel(); } catch { /* ignore */ }
        throw new FetchError("FETCH_BAD_STATUS", { reason: String(resp.status) });
      }

      const ct = parseContentType(resp.headers.get("Content-Type"));
      if (!allowedContentTypes.includes(ct)) {
        try { await resp.body?.cancel(); } catch { /* ignore */ }
        throw new FetchError("FETCH_BAD_CONTENT_TYPE", { reason: ct || "missing" });
      }

      if (!resp.body) {
        return {
          finalUrl: current,
          status: resp.status,
          contentType: ct,
          bodyText: "",
          bytes: 0,
          redirectChain,
          durationMs: Date.now() - start,
        };
      }

      const reader = resp.body.getReader();
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await readWithDeadline(reader, deadline);
          if (done) break;
          if (value) {
            bytes += value.byteLength;
            if (bytes > maxBytes) {
              try { await reader.cancel(); } catch { /* ignore */ }
              throw new FetchError("FETCH_TOO_LARGE", { reason: String(bytes) });
            }
            chunks.push(value);
          }
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
      }

      // Concatenate chunks → text
      const merged = new Uint8Array(bytes);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.byteLength;
      }
      const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(merged);

      return {
        finalUrl: current,
        status: resp.status,
        contentType: ct,
        bodyText,
        bytes,
        redirectChain,
        durationMs: Date.now() - start,
      };
    }

    // Loop exit without return → exceeded redirect cap.
    throw new FetchError("FETCH_TOO_MANY_REDIRECTS");
  } finally {
    clearTimeout(timer);
  }
}
