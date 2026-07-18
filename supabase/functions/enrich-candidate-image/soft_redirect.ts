// v8a — soft-redirect target extraction. Pure functions, no I/O.
//
// Detects one hop of client-side redirect that a bot fetch would otherwise
// stop at:
//   1. <meta http-equiv="refresh" content="N; url=X">
//   2. Explicit JS redirect calls (both quote styles)
//   3. <link rel="canonical" href="X"> when the guards pass
//
// Consumers MUST still call assertSafeUrl(target) before fetching, and
// enforce the one-hop-maximum + self-referential rules.

export type SoftRedirectKind = "meta_refresh" | "js" | "canonical";

const KNOWN_INTERSTITIAL_HOSTS = new Set([
  "vertexaisearch.cloud.google.com",
  "www.google.com",
  "duckduckgo.com",
]);

const SHALLOW_ROOT_PATHS = new Set([
  "/", "/home", "/products", "/collections", "/category",
]);

function safeResolve(target: string, base: string): string | null {
  try {
    const u = new URL(target, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Normalize a URL for self-referential comparison: lowercase host, strip
 *  hash, remove trailing slash on non-root paths. */
export function normalizeForCompare(input: string): string | null {
  try {
    const u = new URL(input);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function extractMetaRefresh(html: string): string | null {
  // <meta http-equiv="refresh" content="N; url=X">  (case-insensitive,
  // tolerate whitespace, quotes optional around url=).
  const re =
    /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["']\s*\d+\s*;\s*url\s*=\s*["']?([^"'>\s]+)["']?/i;
  const m = re.exec(html);
  if (m && m[1]) return m[1].trim();
  // content-first attribute order.
  const re2 =
    /<meta[^>]+content\s*=\s*["']\s*\d+\s*;\s*url\s*=\s*["']?([^"'>\s]+)["']?[^>]*http-equiv\s*=\s*["']refresh["']/i;
  const m2 = re2.exec(html);
  if (m2 && m2[1]) return m2[1].trim();
  return null;
}

// Explicit JS redirect patterns — both single and double quotes supported.
// Each entry is a literal pattern with matching quotes; no eval, no generic
// JS parsing. Order does not matter — first match wins.
const JS_REDIRECT_PATTERNS: RegExp[] = [
  // Assignment forms
  /window\.location\s*=\s*"([^"]+)"/i,
  /window\.location\s*=\s*'([^']+)'/i,
  /window\.location\.href\s*=\s*"([^"]+)"/i,
  /window\.location\.href\s*=\s*'([^']+)'/i,
  /location\.href\s*=\s*"([^"]+)"/i,
  /location\.href\s*=\s*'([^']+)'/i,
  // Method forms
  /window\.location\.assign\s*\(\s*"([^"]+)"\s*\)/i,
  /window\.location\.assign\s*\(\s*'([^']+)'\s*\)/i,
  /location\.assign\s*\(\s*"([^"]+)"\s*\)/i,
  /location\.assign\s*\(\s*'([^']+)'\s*\)/i,
  /window\.location\.replace\s*\(\s*"([^"]+)"\s*\)/i,
  /window\.location\.replace\s*\(\s*'([^']+)'\s*\)/i,
  /location\.replace\s*\(\s*"([^"]+)"\s*\)/i,
  /location\.replace\s*\(\s*'([^']+)'\s*\)/i,
];

function extractJsRedirect(html: string): string | null {
  for (const re of JS_REDIRECT_PATTERNS) {
    const m = re.exec(html);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extractCanonical(html: string): string | null {
  const patterns = [
    /<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function canonicalPassesGuards(finalUrl: string, targetAbs: string): boolean {
  let fu: URL, tu: URL;
  try { fu = new URL(finalUrl); tu = new URL(targetAbs); }
  catch { return false; }
  // Host rule.
  const sameHost = tu.hostname.toLowerCase() === fu.hostname.toLowerCase();
  const finalIsInterstitial =
    KNOWN_INTERSTITIAL_HOSTS.has(fu.hostname.toLowerCase());
  if (!sameHost && !finalIsInterstitial) return false;
  // Meaningful-difference rule — pathname must differ (query-only diff is
  // handled by clean-URL retry).
  if (tu.pathname === fu.pathname) return false;
  // Shallow-root rule.
  const segs = tu.pathname.split("/").filter(Boolean);
  if (SHALLOW_ROOT_PATHS.has(tu.pathname)) return false;
  // /category/foo with ≤1 additional segment counts as shallow.
  if (segs.length <= 1 && SHALLOW_ROOT_PATHS.has("/" + (segs[0] ?? ""))) {
    return false;
  }
  return true;
}

/** Try each source in order. First match wins. Returns absolute URL + kind,
 *  or null. Canonical guards enforced here; caller still runs SSRF + self-ref. */
export function extractSoftRedirectTarget(
  finalUrl: string,
  html: string,
): { target: string; kind: SoftRedirectKind } | null {
  const meta = extractMetaRefresh(html);
  if (meta) {
    const abs = safeResolve(meta, finalUrl);
    if (abs) return { target: abs, kind: "meta_refresh" };
  }
  const js = extractJsRedirect(html);
  if (js) {
    const abs = safeResolve(js, finalUrl);
    if (abs) return { target: abs, kind: "js" };
  }
  const canon = extractCanonical(html);
  if (canon) {
    const abs = safeResolve(canon, finalUrl);
    if (abs && canonicalPassesGuards(finalUrl, abs)) {
      return { target: abs, kind: "canonical" };
    }
  }
  return null;
}
