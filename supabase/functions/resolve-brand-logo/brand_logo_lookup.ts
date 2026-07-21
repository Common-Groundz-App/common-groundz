// V2 Brand Logo Parity — Google CSE lookup ported from legacy
// `enrich-brand-data`, scope-locked to analyze-entity-url-v2.
//
// Legacy is NOT modified. This module is only imported by entity_draft.ts.
// Every returned URL is expected to be re-run through the caller's
// normalizeLogoUrl / isRejectedLogoUrl / isAcceptableLogo filters — this
// module never claims a URL is safe on its own.
//
// Global abort signal is required: caller owns the 4s budget. All fetches
// pass signal through; on abort/error the helpers resolve to null and
// swallow the exception so analyze never fails because of logo lookup.

// ─── Legacy scoring config (mirrors enrich-brand-data DOMAIN_CONFIG) ──────
const MAJOR_MARKETPLACES = [
  "amazon", "ebay", "alibaba", "aliexpress", "walmart", "target",
  "shopify", "etsy", "wish", "temu", "shein",
];
const BEAUTY_RETAILERS = [
  "sephora", "ulta", "beautybarn", "nykaa", "purplle",
  "oliveyoung", "yesstyle", "stylevana", "maccaron", "beautytap",
  "cultbeauty", "lookfantastic", "spacenk",
];
const SOCIAL_MEDIA = [
  "facebook", "instagram", "twitter", "linkedin", "tiktok",
  "youtube", "pinterest", "reddit",
];
const REVIEW_SITES = [
  "trustpilot", "yelp", "google", "reddit", "quora", "wikipedia",
];
const CDN_PATTERNS = ["cdn-image", "cloudinary", "imgix", "fastly"];
const PRODUCT_INDICATORS = ["/product-", "/item-", "prdtimg", "/pd/", "/products/"];
const AGGREGATOR_HOSTS = [
  "lovable.me", "vercel.app", "netlify.app", "github.io",
  "herokuapp.com", "replit.dev", "glitch.me", "cloudflare.pages.dev",
  "surge.sh", "render.com", "railway.app",
];

function matchesAny(urlLower: string, patterns: string[]): boolean {
  for (const p of patterns) if (urlLower.includes(p)) return true;
  return false;
}

function safeHostname(u: string): string | null {
  try { return new URL(u).hostname.toLowerCase(); } catch { return null; }
}

// ─── Website result scoring (port of legacy scoreWebsiteResult) ──────────
function scoreWebsiteResult(item: { link?: string; title?: string }, brandName: string): number {
  if (!item?.link || typeof item.link !== "string") return -100;
  const link = item.link.toLowerCase();
  const title = (item.title || "").toLowerCase();
  const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domain = safeHostname(item.link);
  if (!domain) return -100;

  let score = 0;
  if (domain.includes(brandLower)) score += 10;
  const domainBase = domain.split(".")[0];
  const brandSimplified = brandLower.replace(/\s+/g, "");
  if (
    domainBase === brandSimplified ||
    domainBase === brandSimplified + "s" ||
    brandSimplified === domainBase + "s"
  ) score += 15;
  if (title.includes("official") || title.includes("brand")) score += 5;
  if (title.includes(brandLower)) score += 3;

  const agencyPatterns = [
    "/work/", "/portfolio/", "/case-study/", "/projects/",
    "behance", "dribbble", "agency", "studio", "design",
  ];
  if (agencyPatterns.some((p) => link.includes(p))) score -= 15;
  if (matchesAny(link, AGGREGATOR_HOSTS)) score -= 20;
  if (matchesAny(link, MAJOR_MARKETPLACES) || matchesAny(link, BEAUTY_RETAILERS)) score -= 20;
  if (matchesAny(link, SOCIAL_MEDIA) || matchesAny(link, REVIEW_SITES)) score -= 10;
  return score;
}

// ─── Logo scoring (port of legacy scoreLogoImage) ────────────────────────
function scoreLogoImage(item: { link?: string; title?: string }, brandName: string): number {
  if (!item?.link || typeof item.link !== "string") return -100;
  const link = item.link.toLowerCase();
  const title = (item.title || "").toLowerCase();
  const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");

  let score = 0;
  if (link.includes("logo")) score += 15;
  if (link.includes(".png") || link.includes(".svg")) score += 8;
  if (title.includes("logo") || title.includes("brand")) score += 5;
  if (title.includes(brandLower)) score += 3;
  if (link.includes("linkedin.com") || link.includes("instagram.com")) score += 5;
  if (CDN_PATTERNS.some((p) => link.includes(p))) score -= 2;
  if (PRODUCT_INDICATORS.some((p) => link.includes(p)) && !link.includes("logo")) score -= 3;
  if (matchesAny(link, MAJOR_MARKETPLACES) || matchesAny(link, BEAUTY_RETAILERS)) score -= 20;
  return score;
}

// ─── Google CSE calls (share abort signal with caller) ───────────────────
const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export type GoogleCseError = "ok" | "quota_exhausted" | "http_error" | "network" | "aborted";

async function performCse(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<{ items: Array<{ link?: string; title?: string }>; err: GoogleCseError }> {
  try {
    const r = await fetch(`${GOOGLE_CSE_ENDPOINT}?${params.toString()}`, { signal });
    if (r.status === 429) {
      console.log(JSON.stringify({ event: "v2_brand_logo_quota_exhausted", status: 429 }));
      return { items: [], err: "quota_exhausted" };
    }
    if (!r.ok) {
      // Try to peek at "quotaExceeded" reason without leaking body.
      try {
        const body = await r.json();
        const reason = body?.error?.errors?.[0]?.reason;
        if (typeof reason === "string" && reason.toLowerCase().includes("quota")) {
          console.log(JSON.stringify({ event: "v2_brand_logo_quota_exhausted", status: r.status, reason }));
          return { items: [], err: "quota_exhausted" };
        }
      } catch { /* ignore */ }
      return { items: [], err: "http_error" };
    }
    const data = await r.json();
    const items = Array.isArray(data?.items) ? (data.items as Array<{ link?: string; title?: string }>) : [];
    return { items, err: "ok" };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return { items: [], err: "aborted" };
    return { items: [], err: "network" };
  }
}

// ─── Website hard-block classifier ───────────────────────────────────────
// Returns rejection reason enum or null if the result passes hard filters.
type WebsiteRejectReason =
  | "blocked_retailer"
  | "blocked_social"
  | "blocked_review"
  | "blocked_aggregator"
  | "blocked_marketplace_subdomain"
  | "blocked_product_path";

const PRODUCT_PATH_PATTERNS = [
  "/product", "/products/", "/p/", "/item", "/pd/", "/dp/",
  "/sku", "/collections/", "/catalog/", "/shop/", "/store/",
];

function hostMatchesAny(host: string, needles: string[]): boolean {
  // Match either full-label or apex-domain contains. `host` is lowercased.
  for (const n of needles) if (host.includes(n)) return true;
  return false;
}

function classifyWebsiteBlock(rawUrl: string): WebsiteRejectReason | null {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return "blocked_aggregator"; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (hostMatchesAny(host, MAJOR_MARKETPLACES)) {
    // Subdomains of marketplaces (`shop.amazon.co.jp`, `smile.amazon.com`) → distinct enum.
    const apex = host.split(".").slice(-2).join(".");
    const apexBase = apex.split(".")[0];
    if (!MAJOR_MARKETPLACES.includes(apexBase)) return "blocked_marketplace_subdomain";
    return "blocked_retailer";
  }
  if (hostMatchesAny(host, BEAUTY_RETAILERS)) return "blocked_retailer";
  if (hostMatchesAny(host, SOCIAL_MEDIA)) return "blocked_social";
  if (hostMatchesAny(host, REVIEW_SITES)) return "blocked_review";
  if (hostMatchesAny(host, AGGREGATOR_HOSTS)) return "blocked_aggregator";
  for (const p of PRODUCT_PATH_PATTERNS) if (path.includes(p)) return "blocked_product_path";
  return null;
}

function normalizeBrandTokenLocal(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isBrandOwnedDomain(host: string, brandName: string): boolean {
  const brand = normalizeBrandTokenLocal(brandName);
  if (!brand) return false;
  const domainBase = host.split(".")[0];
  if (!domainBase) return false;
  if (domainBase === brand) return true;
  if (domainBase === brand + "s" || domainBase + "s" === brand) return true;
  if (domainBase === `official-${brand}` || domainBase === `${brand}-official`) return true;
  if (domainBase === `official${brand}` || domainBase === `${brand}official`) return true;
  if (domainBase === `get${brand}`) return true;
  if (domainBase === `${brand}hq`) return true;
  if (domainBase === `${brand}cosmetics`) return true;
  if (domainBase === `${brand}beauty`) return true;
  return false;
}

function tiebreakSort(
  a: { host: string; score: number },
  b: { host: string; score: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  const al = a.host.split(".").length;
  const bl = b.host.split(".").length;
  if (al !== bl) return al - bl;
  return a.host.length - b.host.length;
}

// ─── Per-process cache (positive + negative). Keyed by normalized brand. ─
// Analyze runs per request; warm invocations share this Map, which is
// harmless: it only caches Google's CSE-selected official website.
const websiteResolveCache = new Map<string, string | null>();

export function clearBrandLogoLookupCache(): void {
  websiteResolveCache.clear();
}

// ─── Public: find official website (top-5 evaluation) ────────────────────
export async function findOfficialBrandWebsite(
  brandName: string,
  apiKey: string,
  cxId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const cacheKey = normalizeBrandTokenLocal(brandName);
  if (cacheKey && websiteResolveCache.has(cacheKey)) {
    return websiteResolveCache.get(cacheKey) ?? null;
  }

  const q = `${brandName} brand official website -amazon -ebay -alibaba`;
  const params = new URLSearchParams({ key: apiKey, cx: cxId, q, num: "5" });
  const { items } = await performCse(params, signal);
  console.log(JSON.stringify({
    event: "v2_brand_website_evaluated", brand: cacheKey, count: items.length,
  }));
  if (items.length === 0) {
    if (cacheKey) websiteResolveCache.set(cacheKey, null);
    return null;
  }

  // Score + classify all top-5 results, preserving CSE rank.
  const survivors: Array<{ rank: number; host: string; url: string; score: number }> = [];
  items.forEach((it, idx) => {
    const rank = idx + 1;
    const url = it.link ?? "";
    if (!url) return;
    const host = safeHostname(url) ?? "";
    const score = scoreWebsiteResult(it, brandName);
    const blockReason = classifyWebsiteBlock(url);
    if (blockReason) {
      console.log(JSON.stringify({
        event: "v2_brand_website_rejected",
        rank, host, score, reason: blockReason,
      }));
      return;
    }
    console.log(JSON.stringify({
      event: "v2_brand_website_candidate",
      rank, host, score,
      tier: score >= 10 ? "high" : score >= 6 ? "medium" : "none",
    }));
    survivors.push({ rank, host, url, score });
  });

  if (survivors.length === 0) {
    if (cacheKey) websiteResolveCache.set(cacheKey, null);
    return null;
  }

  survivors.sort(tiebreakSort);

  // Tier 1: any survivor with score >= 10.
  const high = survivors.find((s) => s.score >= 10);
  if (high) {
    console.log(JSON.stringify({
      event: "v2_brand_website_accepted",
      rank: high.rank, host: high.host, score: high.score, tier: "high",
    }));
    if (cacheKey) websiteResolveCache.set(cacheKey, high.url);
    return high.url;
  }

  // Tier 2: score >= 6 AND domain looks brand-owned.
  const medium = survivors.find((s) => s.score >= 6 && isBrandOwnedDomain(s.host, brandName));
  if (medium) {
    console.log(JSON.stringify({
      event: "v2_brand_website_accepted",
      rank: medium.rank, host: medium.host, score: medium.score, tier: "medium",
    }));
    if (cacheKey) websiteResolveCache.set(cacheKey, medium.url);
    return medium.url;
  }

  // Log why the top survivor didn't qualify, then return null.
  const top = survivors[0];
  console.log(JSON.stringify({
    event: "v2_brand_website_rejected",
    rank: top.rank, host: top.host, score: top.score,
    reason: top.score < 6 ? "low_score" : "not_brand_owned",
  }));
  if (cacheKey) websiteResolveCache.set(cacheKey, null);
  return null;
}

// ─── Public: search brand logo (two-phase like legacy) ───────────────────
export interface BrandLogoSearchResult {
  url: string | null;
  score: number;
  phase: "site_scoped" | "broad" | "none";
}

export async function searchBrandLogoV2(
  brandName: string,
  officialWebsite: string | null,
  apiKey: string,
  cxId: string,
  signal: AbortSignal,
  filter: (rawUrl: string) => string | null, // caller's normalize+reject+accept pipeline
): Promise<BrandLogoSearchResult> {
  const officialHost = officialWebsite ? safeHostname(officialWebsite) : null;

  const runQuery = async (
    q: string,
  ): Promise<Array<{ link?: string; title?: string }>> => {
    const params = new URLSearchParams({
      key: apiKey, cx: cxId, q, searchType: "image", num: "5",
    });
    const { items } = await performCse(params, signal);
    return items;
  };

  const pickBest = (
    items: Array<{ link?: string; title?: string }>,
    phase: "site_scoped" | "broad",
  ): BrandLogoSearchResult | null => {
    if (items.length === 0) return null;
    const scored = items
      .map((it) => ({ raw: it.link ?? "", score: scoreLogoImage(it, brandName) }))
      .filter((s) => !!s.raw)
      .sort((a, b) => b.score - a.score);
    for (const cand of scored) {
      if (cand.score <= 0) break;
      const passed = filter(cand.raw);
      if (passed) return { url: passed, score: cand.score, phase };
    }
    return null;
  };

  // Phase 1: site-scoped (preferred). Only skip broad if this finds a survivor.
  if (officialHost) {
    const siteItems = await runQuery(`"${brandName}" logo site:${officialHost}`);
    const best = pickBest(siteItems, "site_scoped");
    if (best) {
      console.log(JSON.stringify({
        event: "v2_brand_logo_phase", phase: "site_scoped", ok: true, score: best.score,
      }));
      return best;
    }
  }

  // Phase 2: broad — simplified query "{brand} brand logo".
  if (signal.aborted) {
    console.log(JSON.stringify({ event: "v2_brand_logo_phase", phase: "none", ok: false, score: 0 }));
    return { url: null, score: 0, phase: "none" };
  }
  const broadItems = await runQuery(`"${brandName}" brand logo`);
  const broadBest = pickBest(broadItems, "broad");
  if (broadBest) {
    console.log(JSON.stringify({
      event: "v2_brand_logo_phase", phase: "broad", ok: true, score: broadBest.score,
    }));
    return broadBest;
  }

  console.log(JSON.stringify({ event: "v2_brand_logo_phase", phase: "none", ok: false, score: 0 }));
  return { url: null, score: 0, phase: "none" };
}
