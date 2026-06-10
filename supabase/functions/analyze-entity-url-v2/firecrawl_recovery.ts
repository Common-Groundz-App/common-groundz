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

const MAIN_REGION_BYTES = 16 * 1024;

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

export interface MarkdownListSalePair {
  list_price: number;
  sale_price: number;
  currency: string | null;
  source: "mrp_sale_labels";
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
  /** Phase 8.1C: labeled MRP + sale pair from markdown main region. */
  markdown_list_sale_pair: MarkdownListSalePair | null;
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
    markdown_list_sale_pair: null,
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

/**
 * Extract a single product price from the markdown main region.
 *
 * Guardrails:
 *  - NEVER matches bare numbers. Each candidate must be anchored by either a
 *    price label (MRP / Price / Offer Price / Sale Price) or a currency token
 *    (₹ $ € £ Rs. INR USD EUR GBP).
 *  - When multiple candidates exist, picks by priority:
 *      P1: Offer Price / Sale Price / Price label
 *      P2: currency-prefixed match with no "MRP" within ~40 chars before it
 *      P3: MRP (last resort, so MRP never beats a visible sale price)
 *    Within a tier, first occurrence wins.
 */
function firstMarkdownPrice(region: string): number | null {
  type Cand = { value: number; index: number; tier: 1 | 2 | 3 };
  const cands: Cand[] = [];

  const NUM = String.raw`(\d{1,3}(?:[,\d]{0,12})(?:\.\d{1,2})?)`;
  const CUR = String.raw`(?:₹|\$|€|£|Rs\.|Rs(?=\s)|INR(?=\s)|USD(?=\s)|EUR(?=\s)|GBP(?=\s))`;

  // Branch 1a — REQUIRED label + ":" + optional currency + number
  const LABEL_COLON = new RegExp(
    String.raw`\b(MRP|Offer Price|Sale Price|Price)\s*:\s*(?:` + CUR + String.raw`\s?)?` + NUM,
    "gi",
  );
  // Branch 1b — REQUIRED label + REQUIRED currency (no colon) + number
  const LABEL_CUR = new RegExp(
    String.raw`\b(MRP|Offer Price|Sale Price|Price)\s+` + CUR + String.raw`\s?` + NUM,
    "gi",
  );
  // Branch 2 — REQUIRED currency + number (no label needed)
  const CUR_ONLY = new RegExp(CUR + String.raw`\s?` + NUM, "gi");

  const parseNum = (raw: string): number | null => {
    const n = parseFloat(raw.replace(/,/g, ""));
    return isFinite(n) ? n : null;
  };

  const labelTier = (label: string): 1 | 3 => {
    return label.toLowerCase() === "mrp" ? 3 : 1;
  };

  for (const re of [LABEL_COLON, LABEL_CUR]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(region)) !== null) {
      const n = parseNum(m[2]);
      if (n === null) continue;
      cands.push({ value: n, index: m.index, tier: labelTier(m[1]) });
    }
  }

  CUR_ONLY.lastIndex = 0;
  let cm: RegExpExecArray | null;
  while ((cm = CUR_ONLY.exec(region)) !== null) {
    const n = parseNum(cm[1]);
    if (n === null) continue;
    // Skip if this currency match is already part of a label-anchored match
    // (within ~40 chars of an MRP/Price/Offer/Sale label before it). The
    // label branches already captured those, so we'd double-count.
    const before = region.slice(Math.max(0, cm.index - 40), cm.index);
    if (/\b(MRP|Offer Price|Sale Price|Price)\s*:?\s*$/i.test(before)) continue;
    // Demote currency match to tier 3 if "MRP" appears within ~40 chars before
    const mrpNearby = /\bMRP\b/i.test(before);
    cands.push({ value: n, index: cm.index, tier: mrpNearby ? 3 : 2 });
  }

  if (cands.length === 0) return null;
  cands.sort((a, b) => (a.tier - b.tier) || (a.index - b.index));
  return cands[0].value;
}

// ─── Phase 8.1C: labeled MRP/Sale pair detection ─────────────────────────
//
// Adds a second, additive pass that collects labeled price candidates with
// their currency token, then attempts to form a (list_price, sale_price)
// pair. This NEVER affects `firstMarkdownPrice` or `additional_data.price`.
//
// Rules:
//  - Sale candidates must carry one of {Offer Price, Sale Price, Price}.
//    Currency-only matches are excluded. Priority: Offer > Sale > Price.
//    Generic "Price" only pairs when a strictly-higher MRP/List Price exists.
//  - List candidates must carry one of {MRP, List Price}.
//  - Sanity: list > sale AND sale >= MIN_SALE_TO_MRP_RATIO * list.
//  - Currency precedence: both present & equal → use; conflict → reject;
//    one/both missing → metadata fallback; else reject.
//  - Nearest-MRP: among list candidates passing all checks, pick the one
//    with the smallest character distance from the chosen sale candidate.

export const MIN_SALE_TO_MRP_RATIO = 0.4;

type PairLabel = "MRP" | "List Price" | "Offer Price" | "Sale Price" | "Price";

interface PairCandidate {
  value: number;
  index: number;
  label: PairLabel;
  currency: string | null;
}

function currencyTokenToIso(tok: string | undefined | null): string | null {
  if (!tok) return null;
  const t = tok.trim();
  if (t === "₹") return "INR";
  if (t === "$") return "USD";
  if (t === "€") return "EUR";
  if (t === "£") return "GBP";
  const up = t.toUpperCase().replace(/\.$/, "");
  if (up === "RS" || up === "INR") return "INR";
  if (up === "USD") return "USD";
  if (up === "EUR") return "EUR";
  if (up === "GBP") return "GBP";
  return null;
}

function collectLabeledCandidates(region: string): PairCandidate[] {
  const out: PairCandidate[] = [];
  const NUM = String.raw`(\d{1,3}(?:[,\d]{0,12})(?:\.\d{1,2})?)`;
  const CUR = String.raw`(₹|\$|€|£|Rs\.|Rs(?=\s)|INR(?=\s)|USD(?=\s)|EUR(?=\s)|GBP(?=\s))`;
  const LABEL = String.raw`(MRP|List Price|Offer Price|Sale Price|Price)`;

  // Branch A: LABEL + ":" + optional currency + number
  const reColon = new RegExp(
    String.raw`\b` + LABEL + String.raw`\s*:\s*(?:` + CUR + String.raw`\s?)?` + NUM,
    "gi",
  );
  // Branch B: LABEL + required currency + number (no colon)
  const reCur = new RegExp(
    String.raw`\b` + LABEL + String.raw`\s+` + CUR + String.raw`\s?` + NUM,
    "gi",
  );

  const parseNum = (raw: string): number | null => {
    const n = parseFloat(raw.replace(/,/g, ""));
    return isFinite(n) ? n : null;
  };

  const normLabel = (s: string): PairLabel => {
    const lo = s.toLowerCase();
    if (lo === "mrp") return "MRP";
    if (lo === "list price") return "List Price";
    if (lo === "offer price") return "Offer Price";
    if (lo === "sale price") return "Sale Price";
    return "Price";
  };

  for (const re of [reColon, reCur]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(region)) !== null) {
      const n = parseNum(m[3]);
      if (n === null) continue;
      out.push({
        value: n,
        index: m.index,
        label: normLabel(m[1]),
        currency: currencyTokenToIso(m[2]),
      });
    }
  }
  // De-duplicate exact (index,value) entries that both regexes captured.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.index}:${c.value}:${c.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function resolvePairCurrency(
  saleCur: string | null,
  listCur: string | null,
  metaCur: string | null,
): string | null {
  if (saleCur && listCur) {
    return saleCur === listCur ? saleCur : null;
  }
  return metaCur ?? null;
}

export function detectListSalePair(
  region: string,
  metadataCurrency: string | null,
): MarkdownListSalePair | null {
  if (!region) return null;
  const cands = collectLabeledCandidates(region);
  if (cands.length < 2) return null;

  const lists = cands.filter((c) => c.label === "MRP" || c.label === "List Price");
  if (lists.length === 0) return null;

  // Sale priority: Offer Price > Sale Price > Price.
  const priorities: PairLabel[] = ["Offer Price", "Sale Price", "Price"];
  const metaCur = metadataCurrency ? metadataCurrency.trim().toUpperCase() : null;

  for (const pri of priorities) {
    const sales = cands.filter((c) => c.label === pri);
    if (sales.length === 0) continue;
    // Generic "Price" needs at least one list candidate strictly higher.
    if (pri === "Price") {
      const anyHigher = lists.some((l) => l.value > sales[0].value);
      if (!anyHigher) return null;
    }
    // First occurrence of this priority tier.
    const sale = sales[0];
    // Find list candidates passing all checks; pick nearest by index.
    let best: { list: PairCandidate; currency: string; dist: number } | null = null;
    for (const list of lists) {
      if (!(list.value > sale.value)) continue;
      if (!(sale.value >= MIN_SALE_TO_MRP_RATIO * list.value)) continue;
      const cur = resolvePairCurrency(sale.currency, list.currency, metaCur);
      if (!cur) continue;
      const dist = Math.abs(list.index - sale.index);
      if (best === null || dist < best.dist) {
        best = { list, currency: cur, dist };
      }
    }
    if (!best) return null;
    return {
      list_price: best.list.value,
      sale_price: sale.value,
      currency: best.currency,
      source: "mrp_sale_labels",
    };
  }
  return null;
}

export function extractFromFirecrawl(args: RecoveryArgs): FirecrawlRecoveryOutput {
  const { metadata, markdown, finalUrl } = args;
  const diag = emptyDiagnostics();
  if (!metadata && !markdown) return weak([], diag);

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
  if (!mapped) return weak(sources, diag);

  // ─── Name ─────────────────────────────────────────────────────────────
  const region = mainRegion(markdown);
  const h1InRegion = firstH1(region);
  const h1Anywhere = markdown ? firstH1(markdown) : null;
  diag.markdown_h1_found = h1Anywhere !== null;
  diag.markdown_h1_within_main_region = h1InRegion !== null;

  let name: string | null = null;
  if (h1InRegion) {
    name = h1InRegion;
    diag.name_source = "markdown_h1";
    sources.push("firecrawl:markdown:h1");
  } else {
    const og = getMeta(metadata, ["og:title", "ogTitle", "title"]);
    if (og) {
      name = og.value;
      diag.name_source = "metadata_title";
      sources.push(`firecrawl:metadata:${og.key}`);
    }
  }
  if (!name) return weak(sources, diag);

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
    if (image_url) {
      sources.push(`firecrawl:metadata:${ogImg.key}`);
      diag.image_source = "metadata_og_image";
    }
  }
  if (!image_url) {
    const mdImg = firstMarkdownImage(region);
    if (mdImg) {
      image_url = safeAbsoluteUrl(mdImg, finalUrl);
      if (image_url) {
        sources.push("firecrawl:markdown:image");
        diag.image_source = "markdown_image";
      }
    }
  }
  diag.image_present = image_url !== null;

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
  diag.metadata_price_found = hasMeta;
  diag.markdown_price_found = hasMd;
  if (hasMeta && hasMd) {
    const diff = Math.abs(metaPrice - (mdPrice as number)) /
      Math.max(metaPrice, mdPrice as number);
    if (diff <= 0.05) {
      additional_data.price = metaPrice;
      sources.push(`firecrawl:metadata:${metaPriceRaw!.key}`);
      diag.selected_price_source = "metadata";
    } else {
      diag.price_conflict = true;
      diag.selected_price_source = "omitted";
    }
    // else: omit price (keep currency)
  } else if (hasMeta) {
    additional_data.price = metaPrice;
    sources.push(`firecrawl:metadata:${metaPriceRaw!.key}`);
    diag.selected_price_source = "metadata";
  } else if (hasMd) {
    additional_data.price = mdPrice;
    sources.push("firecrawl:markdown:price");
    diag.selected_price_source = "markdown";
  }

  // Phase 8.1C: additive labeled MRP/Sale pair detection. NEVER affects
  // additional_data.price; consumed downstream only via pricing.ts.
  const pairMetaCur = typeof additional_data.currency === "string"
    ? (additional_data.currency as string)
    : null;
  diag.markdown_list_sale_pair = detectListSalePair(region, pairMetaCur);



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

  return { result: { predictions, metadata: meta, warnings: [] }, diagnostics: diag };
}

