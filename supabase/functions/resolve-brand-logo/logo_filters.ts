// v8e temporary parity copy of URL Analysis logo filters.
// Do not change behavior here without syncing with analyze-entity-url-v2/entity_draft.ts.
// Consolidate into _shared/brand_logo in a later cleanup phase.
//
// Copied verbatim (only imports/exports adjusted) from
// supabase/functions/analyze-entity-url-v2/entity_draft.ts lines ~56-201.

const LOGO_TRACKING_PARAMS = new Set([
  "srsltid", "utm_source", "utm_medium", "utm_campaign", "utm_term",
  "utm_content", "_gl", "fbclid", "gclid", "mc_cid", "mc_eid",
]);
const REJECT_HOST_EXACT = new Set([
  "share.google",
  "www.bing.com",
  "external-content.duckduckgo.com",
  "proxy.duckduckgo.com",
]);
const REJECT_HOST_PATTERNS: RegExp[] = [
  /^encrypted-tbn[0-9]\.gstatic\.com$/i,
  /^tse[0-9]+\.mm\.bing\.net$/i,
];
const REJECT_PATH_SNIPPETS = [
  "/s2/favicons", "/imgres", "/thumbnail", "/thumb", "/proxy",
];

export type LogoRejectReason =
  | "invalid_scheme"
  | "redirect_wrapper_empty"
  | "rejected_host"
  | "rejected_path"
  | "non_image_url";

export function normalizeLogoUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("javascript:")) {
    return null;
  }
  let u: URL;
  try { u = new URL(trimmed); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if (host === "www.google.com" || host === "google.com") {
    if (path === "/url" || path === "/imgres") {
      const inner = u.searchParams.get("q") ?? u.searchParams.get("imgurl") ?? u.searchParams.get("url");
      if (!inner) return null;
      return normalizeLogoUrl(inner);
    }
  }
  if (host === "share.google") {
    const inner = u.searchParams.get("q") ?? u.searchParams.get("url");
    if (inner) return normalizeLogoUrl(inner);
    return null;
  }
  if (/^encrypted-tbn[0-9]\.gstatic\.com$/i.test(host)) {
    const inner = u.searchParams.get("q") ?? u.searchParams.get("url") ?? u.searchParams.get("imgurl");
    if (inner) return normalizeLogoUrl(inner);
    return null;
  }

  const next = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (!LOGO_TRACKING_PARAMS.has(k.toLowerCase())) next.append(k, v);
  }
  u.search = next.toString();
  u.hash = "";
  return u.toString();
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|svg|avif|gif|ico)(\?|#|$)/i;

export function isRejectedLogoUrl(normalized: string): LogoRejectReason | null {
  let u: URL;
  try { u = new URL(normalized); } catch { return "invalid_scheme"; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (REJECT_HOST_EXACT.has(host)) return "rejected_host";
  for (const re of REJECT_HOST_PATTERNS) if (re.test(host)) return "rejected_host";
  for (const snippet of REJECT_PATH_SNIPPETS) if (path.includes(snippet)) return "rejected_path";
  return null;
}

export function isAcceptableLogo(
  normalized: string,
  websiteUrl: string | null | undefined,
  source: string,
): boolean {
  if (source === "official_site" || source === "firecrawl" ||
      source === "page_metadata" || source === "open_food_facts") return true;
  try {
    if (websiteUrl) {
      const w = new URL(websiteUrl);
      const l = new URL(normalized);
      if (w.hostname.toLowerCase() === l.hostname.toLowerCase()) return true;
    }
  } catch { /* ignore */ }
  return IMAGE_EXT_RE.test(normalized);
}

export async function tryOwnOriginFavicon(
  websiteUrl: string,
  signal: AbortSignal,
): Promise<string | null> {
  let host: string, origin: string;
  try {
    const wu = new URL(websiteUrl);
    if (wu.protocol !== "http:" && wu.protocol !== "https:") return null;
    host = wu.hostname.toLowerCase();
    origin = `${wu.protocol}//${wu.host}`;
  } catch { return null; }
  if (REJECT_HOST_EXACT.has(host)) return null;
  for (const re of REJECT_HOST_PATTERNS) if (re.test(host)) return null;

  const candidates = [`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`];

  const probe = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url, { method: "HEAD", signal, redirect: "follow" });
      if (r.ok) {
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        if (ct.startsWith("image/")) return url;
      }
      if (!(r.status === 405 || r.status === 403 || r.status === 501 || r.ok)) return null;
    } catch { /* fall through */ }
    try {
      const r = await fetch(url, {
        method: "GET", signal, redirect: "follow",
        headers: { Range: "bytes=0-511" },
      });
      const ok = r.status === 200 || r.status === 206;
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      try { await r.body?.cancel(); } catch { /* ignore */ }
      if (ok && ct.startsWith("image/")) return url;
    } catch { /* ignore */ }
    return null;
  };

  const results = await Promise.all(candidates.map(probe));
  for (const r of results) if (r) return r;
  return null;
}
