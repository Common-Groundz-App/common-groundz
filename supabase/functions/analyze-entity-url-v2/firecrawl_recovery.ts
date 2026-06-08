// Phase 7.1 hotfix: deterministic recovery from Firecrawl metadata + markdown.
//
// Used only when the HTML extractor returns null/weak. Never inspects HTML.
// Never infers `type` from markdown keywords. Markdown is parsed only within
// the "main product region" (start through first `## ` heading or 4 KB).
//
// Output is typed against the Phase 5/6 extractable subset; this initial
// hotfix only emits product / book / movie / tv_show. Other og:types
// (article, website, profile, music.*, restaurant.*, business.*, place,
// course, app, game, food, unknown) deliberately return weak/null in this
// patch.

import {
  type ExactPageExtractableType,
  type ExtractMetadata,
  type ExtractResult,
  type V2Predictions,
  safeAbsoluteUrl,
} from "./extractor.ts";

const MAIN_REGION_BYTES = 4 * 1024;

// Conservative product-first mapping. Only OG types already handled by
// extractor.ts; extends easily later with fixtures.
const OG_TYPE_MAP: Partial<Record<string, ExactPageExtractableType>> = {
  product: "product",
  book: "book",
  "books.book": "book",
  "video.movie": "movie",
  "video.tv_show": "tv_show",
  "video.episode": "tv_show",
};

interface RecoveryArgs {
  metadata: Record<string, unknown> | null;
  markdown: string | null;
  finalUrl: string;
}

export interface FirecrawlRecoveryDiagnostics {
  name_source: "markdown_h1" | "metadata_title" | null;
  markdown_h1_found: boolean;
  markdown_h1_within_main_region: boolean;
  markdown_price_found: boolean;
  metadata_price_found: boolean;
  price_conflict: boolean;
  selected_price_source: "metadata" | "markdown" | "omitted" | "none";
  image_source: "metadata_og_image" | "markdown_image" | null;
  image_present: boolean;
}

export interface FirecrawlRecoveryOutput {
  result: ExtractResult;
  diagnostics: FirecrawlRecoveryDiagnostics;
}

function emptyDiagnostics(): FirecrawlRecoveryDiagnostics {
  return {
    name_source: null,
    markdown_h1_found: false,
    markdown_h1_within_main_region: false,
    markdown_price_found: false,
    metadata_price_found: false,
    price_conflict: false,
    selected_price_source: "none",
    image_source: null,
    image_present: false,
  };
}

function weak(sources: string[], diagnostics: FirecrawlRecoveryDiagnostics): FirecrawlRecoveryOutput {
  const metadata: ExtractMetadata = {
    has_jsonld: false,
    jsonld_blocks: 0,
    has_og: sources.length > 0,
    has_twitter: false,
    sources,
    mapped_type: null,
    confidence: null,
    weak_signals: true,
  };
  return { result: { predictions: null, metadata, warnings: [] }, diagnostics };
}


/** Case-insensitive key lookup. Preserves value casing; trims only. */
function getMeta(
  m: Record<string, unknown> | null,
  keys: readonly string[],
): { value: string; key: string } | null {
  if (!m) return null;
  const lowerIndex: Record<string, string> = {};
  for (const k of Object.keys(m)) lowerIndex[k.toLowerCase()] = k;
  for (const want of keys) {
    const realKey = lowerIndex[want.toLowerCase()];
    if (!realKey) continue;
    const v = m[realKey];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return { value: t, key: realKey };
    } else if (typeof v === "number" && isFinite(v)) {
      return { value: String(v), key: realKey };
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) {
          return { value: item.trim(), key: realKey };
        }
      }
    }
  }
  return null;
}

function hasAnyProductKey(m: Record<string, unknown> | null): boolean {
  if (!m) return false;
  for (const k of Object.keys(m)) {
    const lk = k.toLowerCase();
    if (lk.startsWith("product:") || lk.startsWith("product.")) return true;
  }
  return false;
}

function mainRegion(markdown: string | null): string {
  if (!markdown) return "";
  const idx = markdown.indexOf("\n## ");
  const cut = idx >= 0 ? Math.min(idx, MAIN_REGION_BYTES) : MAIN_REGION_BYTES;
  return markdown.slice(0, cut);
}

function firstH1(region: string): string | null {
  const m = region.match(/^[ \t]*#[ \t]+(.+?)\s*$/m);
  if (!m) return null;
  const t = m[1].trim();
  return t || null;
}

function firstParagraph(region: string): string | null {
  // First non-empty line that isn't heading/list/image/blockquote.
  const lines = region.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^[-*+]\s/.test(line)) continue;
    if (/^!\[/.test(line)) continue;
    if (line.startsWith(">")) continue;
    if (line.startsWith("|")) continue;
    if (line.length < 20) continue;
    return line;
  }
  return null;
}

function firstMarkdownImage(region: string): string | null {
  const m = region.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/i);
  return m ? m[1] : null;
}

function firstMarkdownPrice(region: string): number | null {
  const m = region.match(
    /(?:₹|\$|€|£|USD|INR|EUR|GBP)\s?([\d]{1,3}(?:[,\d]{0,12})(?:\.\d{1,2})?)/i,
  );
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

export function extractFromFirecrawl(args: RecoveryArgs): ExtractResult {
  const { metadata, markdown, finalUrl } = args;
  if (!metadata && !markdown) return weak([]);

  const sources: string[] = [];

  // ─── Type — strict OG only ────────────────────────────────────────────
  const ogType = getMeta(metadata, ["og:type", "ogType"]);
  let mapped: ExactPageExtractableType | null = null;
  let suggestedPath: string | null = null;

  if (ogType) {
    const m = OG_TYPE_MAP[ogType.value.toLowerCase()];
    if (m) {
      mapped = m;
      suggestedPath = ogType.value;
      sources.push(`firecrawl:metadata:${ogType.key}`);
    }
  }
  if (!mapped && hasAnyProductKey(metadata)) {
    mapped = "product";
    suggestedPath = "Product";
    sources.push("firecrawl:metadata:product:*");
  }
  if (!mapped) return weak(sources);

  // ─── Name ─────────────────────────────────────────────────────────────
  const region = mainRegion(markdown);
  let name: string | null = null;
  const h1 = firstH1(region);
  if (h1) {
    name = h1;
    sources.push("firecrawl:markdown:h1");
  } else {
    const og = getMeta(metadata, ["og:title", "ogTitle", "title"]);
    if (og) {
      name = og.value;
      sources.push(`firecrawl:metadata:${og.key}`);
    }
  }
  if (!name) return weak(sources);

  // ─── Description ──────────────────────────────────────────────────────
  let description: string | null = null;
  const ogDesc = getMeta(metadata, [
    "og:description",
    "ogDescription",
    "description",
    "twitter:description",
  ]);
  if (ogDesc) {
    description = ogDesc.value;
    sources.push(`firecrawl:metadata:${ogDesc.key}`);
  } else {
    const p = firstParagraph(region);
    if (p) {
      description = p;
      sources.push("firecrawl:markdown:paragraph");
    }
  }

  // ─── Image ────────────────────────────────────────────────────────────
  let image_url: string | null = null;
  const ogImg = getMeta(metadata, ["og:image", "ogImage", "twitter:image"]);
  if (ogImg) {
    image_url = safeAbsoluteUrl(ogImg.value, finalUrl);
    if (image_url) sources.push(`firecrawl:metadata:${ogImg.key}`);
  }
  if (!image_url) {
    const mdImg = firstMarkdownImage(region);
    if (mdImg) {
      image_url = safeAbsoluteUrl(mdImg, finalUrl);
      if (image_url) sources.push("firecrawl:markdown:image");
    }
  }

  // ─── additional_data ──────────────────────────────────────────────────
  const additional_data: Record<string, unknown> = {};

  const brand = getMeta(metadata, ["og:brand", "product:brand"]);
  if (brand) {
    additional_data.brand = brand.value;
    sources.push(`firecrawl:metadata:${brand.key}`);
  }

  const currency = getMeta(metadata, [
    "product:price:currency",
    "og:price:currency",
  ]);
  if (currency) {
    additional_data.currency = currency.value.toUpperCase();
    sources.push(`firecrawl:metadata:${currency.key}`);
  }

  // Conservative price handling
  const metaPriceRaw = getMeta(metadata, [
    "product:price:amount",
    "og:price:amount",
  ]);
  const metaPrice = metaPriceRaw ? parseFloat(metaPriceRaw.value.replace(/,/g, "")) : NaN;
  const mdPrice = firstMarkdownPrice(region);
  const hasMeta = isFinite(metaPrice);
  const hasMd = mdPrice !== null;
  if (hasMeta && hasMd) {
    const diff = Math.abs(metaPrice - (mdPrice as number)) /
      Math.max(metaPrice, mdPrice as number);
    if (diff <= 0.05) {
      additional_data.price = metaPrice;
      sources.push(`firecrawl:metadata:${metaPriceRaw!.key}`);
    }
    // else: omit price (keep currency)
  } else if (hasMeta) {
    additional_data.price = metaPrice;
    sources.push(`firecrawl:metadata:${metaPriceRaw!.key}`);
  } else if (hasMd) {
    additional_data.price = mdPrice;
    sources.push("firecrawl:markdown:price");
  }

  const predictions: V2Predictions = {
    type: mapped,
    name,
    description,
    category_id: null,
    suggested_category_path: suggestedPath,
    matched_category_name: null,
    tags: [],
    confidence: 0.75,
    reasoning: "Extracted from Firecrawl metadata/markdown",
    image_url,
    images: image_url ? [{ url: image_url }] : [],
    additional_data,
  };

  const meta: ExtractMetadata = {
    has_jsonld: false,
    jsonld_blocks: 0,
    has_og: true,
    has_twitter: false,
    sources,
    mapped_type: mapped,
    confidence: 0.75,
    weak_signals: false,
  };

  return { predictions, metadata: meta, warnings: [] };
}
