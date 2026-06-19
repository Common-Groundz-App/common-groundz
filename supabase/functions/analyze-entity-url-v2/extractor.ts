// Phase 5 — deterministic exact-page extractor.
//
// Pure function: HTML in, structured prediction (or weak_signals) out.
// No network I/O, no AI, no DB, no Firecrawl, no category resolution,
// no brand entity creation.
//
// EXACT_PAGE_EXTRACTABLE_TYPES is a Phase-5 POLICY subset of
// CanonicalEntityType. It lives here (not in `_shared/entityTypes.ts`)
// because it represents this phase's extraction capability, not the
// universal app taxonomy.

import {
  type CanonicalEntityType,
  isCanonicalEntityType,
} from "../_shared/entityTypes.ts";

// ─── Phase-5 policy subset ────────────────────────────────────────────────

export const EXACT_PAGE_EXTRACTABLE_TYPES = [
  "product",
  "book",
  "movie",
  "tv_show",
  "course",
  "app",
  "game",
  "food",
  "place",
] as const;

export type ExactPageExtractableType = Extract<
  CanonicalEntityType,
  "product" | "book" | "movie" | "tv_show" | "course" | "app" | "game" | "food" | "place"
>;

// ─── URL safety ───────────────────────────────────────────────────────────

/**
 * Resolve `value` against `baseUrl` and return an absolute http(s) URL string,
 * or null. Rejects javascript:, data:, blob:, file:, mailto:, etc.
 */
export function safeAbsoluteUrl(
  value: unknown,
  baseUrl: string,
): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const u = new URL(value, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ─── Type mapping tables ──────────────────────────────────────────────────

// JSON-LD @type → canonical Phase-5 type
const JSONLD_TYPE_MAP: Record<string, ExactPageExtractableType> = {
  Product: "product",
  Book: "book",
  Audiobook: "book",
  Movie: "movie",
  TVSeries: "tv_show",
  TVSeason: "tv_show",
  TVEpisode: "tv_show",
  Course: "course",
  SoftwareApplication: "app",
  MobileApplication: "app",
  WebApplication: "app",
  VideoGame: "game",
  Recipe: "food",
  Restaurant: "place",
  LocalBusiness: "place",
  Hotel: "place",
  Place: "place",
};

// og:type → canonical Phase-5 type
const OG_TYPE_MAP: Record<string, ExactPageExtractableType> = {
  "video.movie": "movie",
  "video.tv_show": "tv_show",
  "product": "product",
  "book": "book",
};

const WRAPPER_TYPES = new Set([
  "WebPage",
  "WebSite",
  "Article",
  "NewsArticle",
  "BlogPosting",
  "CollectionPage",
  "ItemPage",
  "ProductPage",
]);

// ─── Public types ─────────────────────────────────────────────────────────

export interface V2Predictions {
  type: CanonicalEntityType;
  name: string;
  description: string | null;
  /** Phase 8+: resolved root-level category UUID, or null when unresolved. */
  category_id: string | null;
  /** RAW schema.org @type or og:type verbatim. Never a fabricated path. */
  suggested_category_path: string | null;
  /** Phase 8+: human-readable root category name, or null when unresolved. */
  matched_category_name: string | null;
  tags: string[];
  confidence: number;
  reasoning: string;
  image_url: string | null;
  images: Array<{ url: string }>;
  additional_data: Record<string, unknown>;
}

export interface ExtractMetadata {
  has_jsonld: boolean;
  jsonld_blocks: number;
  has_og: boolean;
  has_twitter: boolean;
  sources: string[];
  mapped_type: CanonicalEntityType | null;
  confidence: number | null;
  weak_signals: boolean;
}

// Phase 8.1B: deterministic JSON-LD Offer[] / AggregateOffer payload.
export interface ExtractedOfferItem {
  price: number;
  currency: string | null;
  selected: boolean;
  default: boolean;
}
export interface ExtractedAggregateOffer {
  low: number;
  high: number;
  currency: string | null;
}
export interface ExtractedOffers {
  offers: ExtractedOfferItem[];
  aggregate: ExtractedAggregateOffer | null;
}

export interface PageSignals {
  title: string | null;
  og_title: string | null;
  og_description: string | null;
  og_site_name: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  canonical: string | null;
  jsonld_product_name: string | null;
  jsonld_brand: string | null;
}

export interface ExtractResult {
  predictions: V2Predictions | null;
  metadata: ExtractMetadata;
  warnings: string[];
  /**
   * Phase 8.1B: deterministic Offer[] / AggregateOffer payload from JSON-LD.
   * Only populated for Product nodes. Never throws; null when nothing parsed.
   * Existing single-offer additional_data.price/currency unchanged.
   */
  extractedOffers?: ExtractedOffers | null;
  /**
   * Phase 1.7: real fetched-page identity signals. Reuses HTML already
   * parsed for the main extraction. Each field nullable. Used by index.ts
   * to feed Gemini and the Amazon dual-path identity guard. Never logged raw.
   */
  pageSignals?: PageSignals;
}

// ─── Phase 8.1B: JSON-LD offer parsing (defensive, deterministic) ────────

/**
 * Narrow, deterministic numeric-string parser. Accepts:
 *   "1499", "1499.00", "1,499", "12,499.50"
 * Rejects European formats ("1499,00"), currency-prefixed strings,
 * space-separated digits, NaN/Infinity/zero/negative. Never throws.
 */
const PHASE_8_1B_PRICE_RE =
  /^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/;

export function parseOfferPriceStrict(v: unknown): number | null {
  if (typeof v === "number") {
    if (!isFinite(v) || v <= 0) return null;
    return v;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (!PHASE_8_1B_PRICE_RE.test(s)) return null;
    const n = parseFloat(s.replace(/,/g, ""));
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }
  return null;
}

function parseOfferCurrency(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.toUpperCase();
}

/** Case-insensitive check that supports both string and array @type. */
export function jsonLdTypeMatches(node: unknown, typeName: string): boolean {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  const target = typeName.toLowerCase();
  if (typeof t === "string") return t.toLowerCase() === target;
  if (Array.isArray(t)) {
    for (const x of t) {
      if (typeof x === "string" && x.toLowerCase() === target) return true;
    }
  }
  return false;
}

function parseSingleOffer(node: Record<string, unknown>): ExtractedOfferItem | null {
  const price = parseOfferPriceStrict(node.price);
  if (price === null) return null;
  return {
    price,
    currency: parseOfferCurrency(node.priceCurrency),
    selected: node.selected === true,
    default: node.default === true,
  };
}

export function extractOffersFromJsonLd(offersField: unknown): ExtractedOffers | null {
  if (offersField === null || offersField === undefined) return null;

  const items: ExtractedOfferItem[] = [];
  let aggregate: ExtractedAggregateOffer | null = null;
  let visitedAny = false;

  const visit = (val: unknown): void => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      for (const v of val) visit(v);
      return;
    }
    if (typeof val !== "object") return;
    visitedAny = true;
    if (jsonLdTypeMatches(val, "AggregateOffer")) {
      const o = val as Record<string, unknown>;
      const low = parseOfferPriceStrict(o.lowPrice);
      const high = parseOfferPriceStrict(o.highPrice);
      if (low !== null && high !== null && aggregate === null) {
        aggregate = { low, high, currency: parseOfferCurrency(o.priceCurrency) };
      }
      if (o.offers !== undefined) visit(o.offers);
      return;
    }
    if (jsonLdTypeMatches(val, "Offer")) {
      const item = parseSingleOffer(val as Record<string, unknown>);
      if (item) items.push(item);
    }
    // unrelated types are silently skipped
  };

  try {
    visit(offersField);
  } catch {
    // never throw
  }

  if (!visitedAny) return null;
  if (items.length === 0 && aggregate === null) return null;
  return { offers: items, aggregate };
}

// ─── JSON-LD helpers ──────────────────────────────────────────────────────

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // skip malformed block
    }
  }
  return blocks;
}

function normalizeTypeArray(t: unknown): string[] {
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function pickFirstMappedType(
  types: string[],
): { schemaType: string; mapped: ExactPageExtractableType } | null {
  for (const t of types) {
    const mapped = JSONLD_TYPE_MAP[t];
    if (mapped) return { schemaType: t, mapped };
  }
  return null;
}

/**
 * Flatten @graph and yield candidate nodes (objects with an @type).
 */
function* flattenGraph(root: unknown): Generator<Record<string, unknown>> {
  if (!root || typeof root !== "object") return;
  const obj = root as Record<string, unknown>;
  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const node of graph) {
      if (node && typeof node === "object") {
        yield node as Record<string, unknown>;
      }
    }
    return;
  }
  yield obj;
}

/**
 * One-level wrapper unwrap. If `node`'s first @type is a wrapper and a child
 * exists at mainEntity / subjectOf / about with its own @type, return the
 * child plus the wrapper label. Otherwise return the node unchanged.
 */
function unwrapOnce(node: Record<string, unknown>): {
  node: Record<string, unknown>;
  wrapperLabel: string | null;
} {
  const types = normalizeTypeArray(node["@type"]);
  if (types.length === 0 || !WRAPPER_TYPES.has(types[0])) {
    return { node, wrapperLabel: null };
  }
  for (const key of ["mainEntity", "subjectOf", "about"] as const) {
    const child = node[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const childTypes = normalizeTypeArray((child as Record<string, unknown>)["@type"]);
      if (childTypes.length > 0) {
        return {
          node: child as Record<string, unknown>,
          wrapperLabel: types[0],
        };
      }
    }
  }
  return { node, wrapperLabel: null };
}

// ─── Meta / OG / title regex helpers ──────────────────────────────────────

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function readAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[2] ?? m[3] ?? "");
}

interface MetaIndex {
  og: Record<string, string>;
  twitter: Record<string, string>;
  meta: Record<string, string>;
  title: string | null;
  canonical: string | null;
}

function extractMeta(html: string): MetaIndex {
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const meta: Record<string, string> = {};

  const metaRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    const tag = m[0];
    const property = readAttr(tag, "property");
    const name = readAttr(tag, "name");
    const content = readAttr(tag, "content");
    if (!content) continue;
    if (property?.startsWith("og:")) og[property.slice(3)] = content;
    else if (name?.startsWith("twitter:")) twitter[name.slice(8)] = content;
    else if (name) meta[name.toLowerCase()] = content;
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;

  let canonical: string | null = null;
  const linkRe = /<link\b[^>]*>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null) {
    const rel = readAttr(lm[0], "rel");
    if (rel?.toLowerCase() === "canonical") {
      canonical = readAttr(lm[0], "href");
      if (canonical) break;
    }
  }

  return { og, twitter, meta, title, canonical };
}

// ─── additional_data builders ─────────────────────────────────────────────

function num(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function getName(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (v && typeof v === "object" && "name" in v) {
    const n = (v as Record<string, unknown>).name;
    if (typeof n === "string") return n.trim() || undefined;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const n = getName(item);
      if (n) return n;
    }
  }
  return undefined;
}

function buildAdditionalData(
  type: ExactPageExtractableType,
  node: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (type === "product") {
    const offers = node.offers;
    let price: number | undefined;
    let currency: string | undefined;
    let availability: string | undefined;
    const offerObj = Array.isArray(offers) ? offers[0] : offers;
    if (offerObj && typeof offerObj === "object") {
      const o = offerObj as Record<string, unknown>;
      price = num(o.price);
      currency = str(o.priceCurrency);
      availability = str(o.availability);
    }
    if (price !== undefined) out.price = price;
    if (currency) out.currency = currency;
    if (availability) out.availability = availability;

    const rating = node.aggregateRating;
    if (rating && typeof rating === "object") {
      const r = rating as Record<string, unknown>;
      const rv = num(r.ratingValue);
      const rc = num(r.ratingCount) ?? num(r.reviewCount);
      if (rv !== undefined) out.rating = rv;
      if (rc !== undefined) out.rating_count = rc;
    }

    const brand = getName(node.brand);
    if (brand) out.brand = brand;
    const sku = str(node.sku);
    if (sku) out.sku = sku;
    const gtin = str(node.gtin) ?? str(node.gtin13) ?? str(node.gtin12) ?? str(node.gtin8);
    if (gtin) out.gtin = gtin;
  }

  if (type === "book") {
    const author = getName(node.author);
    if (author) out.author = author;
    const isbn = str(node.isbn);
    if (isbn) out.isbn = isbn;
    const pub = str(node.datePublished);
    if (pub) out.published_date = pub;
    const pages = num(node.numberOfPages);
    if (pages !== undefined) out.page_count = pages;
  }

  if (type === "movie" || type === "tv_show") {
    const rd = str(node.datePublished) ?? str(node.dateCreated);
    if (rd) out.release_date = rd;
    const runtime = str(node.duration);
    if (runtime) out.runtime = runtime;
    const director = getName(node.director);
    if (director) out.director = director;
    const rating = node.aggregateRating;
    if (rating && typeof rating === "object") {
      const rv = num((rating as Record<string, unknown>).ratingValue);
      if (rv !== undefined) out.rating = rv;
    }
  }

  if (type === "course") {
    const provider = getName(node.provider);
    if (provider) out.provider = provider;
    const instructor = getName(node.instructor);
    if (instructor) out.instructor = instructor;
    const duration = str(node.timeRequired);
    if (duration) out.duration = duration;
  }

  if (type === "app") {
    const os = str(node.operatingSystem);
    if (os) out.operating_system = os;
    const cat = str(node.applicationCategory);
    if (cat) out.app_category = cat;
    const rating = node.aggregateRating;
    if (rating && typeof rating === "object") {
      const rv = num((rating as Record<string, unknown>).ratingValue);
      if (rv !== undefined) out.rating = rv;
    }
  }

  if (type === "game") {
    const platform = str(node.gamePlatform);
    if (platform) out.platform = platform;
    const genre = str(node.genre);
    if (genre) out.genre = genre;
    const rating = node.aggregateRating;
    if (rating && typeof rating === "object") {
      const rv = num((rating as Record<string, unknown>).ratingValue);
      if (rv !== undefined) out.rating = rv;
    }
  }

  if (type === "food") {
    const cuisine = str(node.recipeCuisine);
    if (cuisine) out.cuisine = cuisine;
    const totalTime = str(node.totalTime);
    if (totalTime) out.total_time = totalTime;
    const servings = str(node.recipeYield) ?? (typeof node.recipeYield === "number" ? String(node.recipeYield) : undefined);
    if (servings) out.servings = servings;
  }

  if (type === "place") {
    const address = node.address;
    if (typeof address === "string") {
      out.address = address;
    } else if (address && typeof address === "object") {
      const a = address as Record<string, unknown>;
      const parts = [
        str(a.streetAddress),
        str(a.addressLocality),
        str(a.addressRegion),
        str(a.postalCode),
        str(a.addressCountry),
      ].filter(Boolean);
      if (parts.length > 0) out.address = parts.join(", ");
    }
    const geo = node.geo;
    if (geo && typeof geo === "object") {
      const g = geo as Record<string, unknown>;
      const lat = num(g.latitude);
      const lng = num(g.longitude);
      if (lat !== undefined) out.latitude = lat;
      if (lng !== undefined) out.longitude = lng;
    }
    const phone = str(node.telephone);
    if (phone) out.phone = phone;
    const cuisine = str(node.servesCuisine);
    if (cuisine) out.cuisine = cuisine;
  }

  return out;
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function extractFromHtml(html: string, finalUrl: string): ExtractResult {
  const sources: string[] = [];
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const meta = extractMeta(stripScriptsAndStyles(html));
  const hasOg = Object.keys(meta.og).length > 0;
  const hasTwitter = Object.keys(meta.twitter).length > 0;

  // ── 1. Try JSON-LD ──────────────────────────────────────────────────────
  let chosen: {
    node: Record<string, unknown>;
    schemaType: string;
    mapped: ExactPageExtractableType;
    source: string;
  } | null = null;

  outer:
  for (const root of jsonLdBlocks) {
    for (const rawNode of flattenGraph(root)) {
      const { node, wrapperLabel } = unwrapOnce(rawNode);
      const types = normalizeTypeArray(node["@type"]);
      if (types.length === 0) continue;
      const picked = pickFirstMappedType(types);
      if (!picked) continue;
      const source = wrapperLabel
        ? `jsonld:${wrapperLabel}→${picked.schemaType}`
        : `jsonld:${picked.schemaType}`;
      chosen = { node, schemaType: picked.schemaType, mapped: picked.mapped, source };
      break outer;
    }
  }

  if (chosen) {
    const node = chosen.node;
    const name = str(node.name);
    if (!name) {
      return weakSignals({
        hasJsonld: jsonLdBlocks.length > 0,
        jsonldBlocks: jsonLdBlocks.length,
        hasOg,
        hasTwitter,
        sources,
      });
    }
    sources.push(chosen.source);

    const description =
      str(node.description) ?? str(meta.og.description) ?? str(meta.meta.description) ?? null;

    let imageUrl: string | null = null;
    const imgRaw = node.image;
    const imgCandidate =
      typeof imgRaw === "string"
        ? imgRaw
        : Array.isArray(imgRaw)
          ? (typeof imgRaw[0] === "string" ? imgRaw[0] : getName(imgRaw[0]))
          : (imgRaw && typeof imgRaw === "object" ? str((imgRaw as Record<string, unknown>).url) : undefined);
    imageUrl = safeAbsoluteUrl(imgCandidate, finalUrl);
    if (!imageUrl) {
      imageUrl = safeAbsoluteUrl(meta.og.image, finalUrl);
      if (imageUrl) sources.push("og:image");
    }

    const additional = buildAdditionalData(chosen.mapped, node);
    const canonical = safeAbsoluteUrl(meta.canonical, finalUrl);
    if (canonical) additional.canonical_url = canonical;

    // Phase 8.1B: deterministic Offer[] / AggregateOffer payload (product only).
    const extractedOffers =
      chosen.mapped === "product"
        ? extractOffersFromJsonLd(node.offers)
        : null;

    return {
      predictions: {
        type: chosen.mapped,
        name,
        description,
        category_id: null,
        suggested_category_path: chosen.schemaType,
        matched_category_name: null,
        tags: [],
        confidence: 0.9,
        reasoning: `Extracted from JSON-LD ${chosen.schemaType}`,
        image_url: imageUrl,
        images: imageUrl ? [{ url: imageUrl }] : [],
        additional_data: additional,
      },
      metadata: {
        has_jsonld: true,
        jsonld_blocks: jsonLdBlocks.length,
        has_og: hasOg,
        has_twitter: hasTwitter,
        sources,
        mapped_type: chosen.mapped,
        confidence: 0.9,
        weak_signals: false,
      },
      warnings: [],
      extractedOffers,
    };
  }

  // ── 2. Try OG ──────────────────────────────────────────────────────────
  const ogType = meta.og.type;
  if (ogType && OG_TYPE_MAP[ogType]) {
    const mapped = OG_TYPE_MAP[ogType];
    const name = str(meta.og.title) ?? str(meta.title);
    if (!name) {
      return weakSignals({
        hasJsonld: jsonLdBlocks.length > 0,
        jsonldBlocks: jsonLdBlocks.length,
        hasOg,
        hasTwitter,
        sources,
      });
    }
    sources.push(`og:type:${ogType}`);
    const description = str(meta.og.description) ?? str(meta.meta.description) ?? null;
    const imageUrl = safeAbsoluteUrl(meta.og.image, finalUrl);
    const canonical = safeAbsoluteUrl(meta.canonical, finalUrl);
    const additional: Record<string, unknown> = {};
    if (canonical) additional.canonical_url = canonical;

    return {
      predictions: {
        type: mapped,
        name,
        description,
        category_id: null,
        suggested_category_path: ogType,
        matched_category_name: null,
        tags: [],
        confidence: 0.8,
        reasoning: `Extracted from og:type=${ogType}`,
        image_url: imageUrl,
        images: imageUrl ? [{ url: imageUrl }] : [],
        additional_data: additional,
      },
      metadata: {
        has_jsonld: jsonLdBlocks.length > 0,
        jsonld_blocks: jsonLdBlocks.length,
        has_og: hasOg,
        has_twitter: hasTwitter,
        sources,
        mapped_type: mapped,
        confidence: 0.8,
        weak_signals: false,
      },
      warnings: [],
    };
  }

  // ── 3. Weak signals ─────────────────────────────────────────────────────
  // Mark canonical isCanonicalEntityType as used so the import isn't dropped.
  void isCanonicalEntityType;
  return weakSignals({
    hasJsonld: jsonLdBlocks.length > 0,
    jsonldBlocks: jsonLdBlocks.length,
    hasOg,
    hasTwitter,
    sources,
  });
}

function weakSignals(input: {
  hasJsonld: boolean;
  jsonldBlocks: number;
  hasOg: boolean;
  hasTwitter: boolean;
  sources: string[];
}): ExtractResult {
  return {
    predictions: null,
    metadata: {
      has_jsonld: input.hasJsonld,
      jsonld_blocks: input.jsonldBlocks,
      has_og: input.hasOg,
      has_twitter: input.hasTwitter,
      sources: input.sources,
      mapped_type: null,
      confidence: null,
      weak_signals: true,
    },
    warnings: ["weak_signals"],
  };
}
