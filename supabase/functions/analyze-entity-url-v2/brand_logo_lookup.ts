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

// ─── Public: find official website ───────────────────────────────────────
export async function findOfficialBrandWebsite(
  brandName: string,
  apiKey: string,
  cxId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const q = `${brandName} brand official website -amazon -ebay -alibaba`;
  const params = new URLSearchParams({ key: apiKey, cx: cxId, q, num: "5" });
  const { items } = await performCse(params, signal);
  if (items.length === 0) return null;
  const scored = items
    .map((it) => ({ url: it.link ?? "", score: scoreWebsiteResult(it, brandName) }))
    .filter((s) => !!s.url)
    .sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score >= 10) return scored[0].url;
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
  const all: Array<{ item: { link?: string; title?: string }; phase: "site_scoped" | "broad" }> = [];
  const seen = new Set<string>();
  const officialHost = officialWebsite ? safeHostname(officialWebsite) : null;

  const runQuery = async (
    q: string,
    phase: "site_scoped" | "broad",
  ): Promise<Array<{ link?: string; title?: string }>> => {
    const params = new URLSearchParams({
      key: apiKey, cx: cxId, q, searchType: "image", num: "5",
    });
    const { items } = await performCse(params, signal);
    for (const it of items) {
      if (it.link && !seen.has(it.link)) {
        seen.add(it.link);
        all.push({ item: it, phase });
      }
    }
    return items;
  };

  if (officialHost) {
    const siteResults = await runQuery(`"${brandName}" logo site:${officialHost}`, "site_scoped");
    const bestSiteScore = siteResults.length > 0
      ? Math.max(...siteResults.map((it) => scoreLogoImage(it, brandName)))
      : -100;
    if (bestSiteScore < 15 && !signal.aborted) {
      await runQuery(
        `"${brandName}" official brand logo -site:${officialHost} -product -buy -shop`,
        "broad",
      );
    }
  } else {
    await runQuery(
      `"${brandName}" official brand logo transparent png -product -buy -shop`,
      "broad",
    );
  }

  if (all.length === 0) return { url: null, score: 0, phase: "none" };

  const scored = all
    .map(({ item, phase }) => ({
      raw: item.link ?? "",
      score: scoreLogoImage(item, brandName),
      phase,
    }))
    .filter((s) => !!s.raw)
    .sort((a, b) => b.score - a.score);

  // Walk in score order, apply caller's filter, pick first survivor with score > 0.
  for (const cand of scored) {
    if (cand.score <= 0) break;
    const passed = filter(cand.raw);
    if (passed) {
      return { url: passed, score: cand.score, phase: cand.phase };
    }
  }
  return { url: null, score: scored[0]?.score ?? 0, phase: "none" };
}
