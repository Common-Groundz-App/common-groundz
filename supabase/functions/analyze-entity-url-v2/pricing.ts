// Phase 8.1A: Additive pricing block.
//
// Builds an additional_data.pricing diagnostic + display block from
// already-merged Phase 8 outputs. NEVER changes additional_data.price.
//
// Invariants (see .lovable/plan.md Phase 8.1):
//  1. additional_data.price is never written, recomputed, or deleted here.
//  2. The block is attached whenever it carries useful info (see
//     `pricingBlockHasContent`).
//  3. Gemini never creates or widens a public price range. Disagreement is
//     diagnostic-only via gemini_observed_price.
//  4. formatPriceDisplay never throws and falls back to "<CODE> <amount>".

export type PriceSource =
  | "extractor_jsonld_offer"
  | "extractor_meta_og"
  | "firecrawl_metadata"
  | "firecrawl_markdown_single"
  | "gemini"
  | "unknown"
  | "omitted"
  // Phase 8.1B
  | "extractor_jsonld_aggregate"
  | "extractor_jsonld_offers_merged_range"
  | "extractor_jsonld_offers_selected";

export type PriceSourceUsed = "exact" | "inferred" | "unknown";

export type PriceSourceHint =
  | "jsonld"
  | "og"
  | "firecrawl_metadata"
  | "firecrawl_markdown"
  | "gemini"
  | "unknown"
  | null;

// Phase 8.1B: deterministic offer payload accepted by buildPricing.
export interface ExtractedOffersInput {
  offers: Array<{
    price: number;
    currency: string | null;
    selected: boolean;
    default: boolean;
  }>;
  aggregate: { low: number; high: number; currency: string | null } | null;
}

export interface PricingBlock {
  currency: string | null;
  list_price: number | null;
  sale_price: number | null;
  selected_variant_price: number | null;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
  price_source: PriceSource;
  price_confidence: number;
  price_conflict: boolean;
  /** Phase 8.1B: mixed-currency Offer[] conflict. Pricing-block-scoped. */
  range_conflict: boolean;
  gemini_observed_price?: number | null;
  gemini_observed_currency?: string | null;
}

export interface MetadataPricingBlock {
  source: PriceSource;
  confidence: number;
  conflict: boolean;
  has_range: boolean;
  has_list_sale: boolean;
  gemini_diagnostic_only: boolean;
  /** Phase 8.1B */
  range_conflict: boolean;
  price_source_used?: PriceSourceUsed;
}

export interface BuildPricingInput {
  /** Phase 8's final price written to additional_data.price, or undefined. */
  legacyPrice: number | undefined;
  /** Phase 8's final currency on additional_data.currency, or null. */
  currency: string | null;
  /** Phase 8 priceConflict flag. */
  priceConflict: boolean;
  /** Merge winner for price ("extractor" | "gemini" | "none"). */
  priceWinner: "extractor" | "gemini" | "none";
  /** Pre-resolved hint about *where* the price came from. */
  priceSourceHint: PriceSourceHint;
  /** Gemini's reported price (raw, ungated). */
  geminiPrice?: number | null;
  /** Gemini's reported currency (raw, ungated). */
  geminiCurrency?: string | null;
  /** Gemini's field_confidence.price (0..1). */
  geminiPriceConfidence?: number | null;
  /** Phase 8.1B: deterministic JSON-LD offer payload. */
  offers?: ExtractedOffersInput | null;
}

/** Phase 8.1B: hints backed by deterministic page evidence. */
export function isDeterministicHint(h: PriceSourceHint): boolean {
  return (
    h === "jsonld" ||
    h === "og" ||
    h === "firecrawl_metadata" ||
    h === "firecrawl_markdown"
  );
}

// ─── Source resolution ────────────────────────────────────────────────────

/**
 * Compute a conservative source hint from Phase 8 diagnostics.
 * Returns null when no signal exists at all.
 */
export function resolvePriceSourceHint(input: {
  extractSources?: string[] | null;
  firecrawlRecoveryPriceSource?: "metadata" | "markdown" | "omitted" | "none" | null;
  priceCameFromGemini?: boolean;
}): PriceSourceHint {
  if (input.priceCameFromGemini) return "gemini";

  const rec = input.firecrawlRecoveryPriceSource;
  if (rec === "metadata") return "firecrawl_metadata";
  if (rec === "markdown") return "firecrawl_markdown";

  const sources = input.extractSources ?? [];
  const hasJsonLd = sources.some((s) => typeof s === "string" && s.startsWith("jsonld:"));
  if (hasJsonLd) return "jsonld";
  const hasFcMeta = sources.some((s) => typeof s === "string" && s.startsWith("firecrawl:metadata:"));
  if (hasFcMeta) return "firecrawl_metadata";
  const hasFcMd = sources.some((s) => typeof s === "string" && s.startsWith("firecrawl:markdown:"));
  if (hasFcMd) return "firecrawl_markdown";
  const hasOg = sources.some((s) => typeof s === "string" && s.startsWith("og:"));
  if (hasOg) return "og";
  return null;
}

// ─── Display formatting (fail-safe) ───────────────────────────────────────

/**
 * Format an amount for display. Never throws. Falls back to "<CODE> <amount>"
 * when Intl cannot resolve the currency symbol or input is unusable.
 */
export function formatPriceDisplay(
  amount: number | null,
  currency: string | null,
): string | null {
  if (amount === null || amount === undefined) return null;
  if (typeof amount !== "number" || !isFinite(amount) || amount < 0) return null;
  const cur = currency ? String(currency).trim().toUpperCase() : null;
  if (cur && /^[A-Z]{3}$/.test(cur)) {
    try {
      const f = new Intl.NumberFormat("en", {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 2,
      });
      const out = f.format(amount);
      if (typeof out === "string" && out.length > 0) return out;
    } catch (_) {
      // fall through to plain fallback
    }
    return `${cur} ${formatPlainNumber(amount)}`;
  }
  return formatPlainNumber(amount);
}

function formatPlainNumber(n: number): string {
  try {
    return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
  } catch (_) {
    return String(n);
  }
}

// ─── Source / confidence resolution ───────────────────────────────────────

interface ResolvedSource {
  price_source: PriceSource;
  price_source_used: PriceSourceUsed;
  price_confidence: number;
}

function resolveSourceAndConfidence(
  hint: PriceSourceHint,
  priceWinner: "extractor" | "gemini" | "none",
  legacyPriceDefined: boolean,
  geminiPriceConfidence: number,
): ResolvedSource {
  if (!legacyPriceDefined) {
    return { price_source: "omitted", price_source_used: "exact", price_confidence: 0 };
  }
  if (priceWinner === "gemini" || hint === "gemini") {
    return {
      price_source: "gemini",
      price_source_used: "exact",
      price_confidence: Math.min(0.70, Math.max(0, geminiPriceConfidence || 0)),
    };
  }
  switch (hint) {
    case "jsonld":
      return { price_source: "extractor_jsonld_offer", price_source_used: "exact", price_confidence: 0.90 };
    case "og":
      return { price_source: "extractor_meta_og", price_source_used: "exact", price_confidence: 0.80 };
    case "firecrawl_metadata":
      return { price_source: "firecrawl_metadata", price_source_used: "exact", price_confidence: 0.75 };
    case "firecrawl_markdown":
      return { price_source: "firecrawl_markdown_single", price_source_used: "exact", price_confidence: 0.65 };
    case "unknown":
    case null:
    default:
      return { price_source: "unknown", price_source_used: "inferred", price_confidence: 0.50 };
  }
}

// ─── Build ────────────────────────────────────────────────────────────────

const EMPTY: PricingBlock = {
  currency: null,
  list_price: null,
  sale_price: null,
  selected_variant_price: null,
  price_min: null,
  price_max: null,
  price_display: null,
  price_source: "omitted",
  price_confidence: 0,
  price_conflict: false,
};

export function buildPricing(input: BuildPricingInput): PricingBlock {
  const currency = nonEmptyString(input.currency)
    ? input.currency!.trim().toUpperCase()
    : null;
  const legacyPriceDefined =
    typeof input.legacyPrice === "number" && isFinite(input.legacyPrice);

  const resolved = resolveSourceAndConfidence(
    input.priceSourceHint,
    input.priceWinner,
    legacyPriceDefined,
    typeof input.geminiPriceConfidence === "number" ? input.geminiPriceConfidence : 0,
  );

  const salePrice = legacyPriceDefined ? (input.legacyPrice as number) : null;

  // Gemini disagreement diagnostic (only when extractor won AND gemini
  // independently reported a different finite price with confidence >= 0.7).
  let geminiObservedPrice: number | null | undefined;
  let geminiObservedCurrency: string | null | undefined;
  const gp = input.geminiPrice;
  const gpc = typeof input.geminiPriceConfidence === "number" ? input.geminiPriceConfidence : 0;
  if (
    legacyPriceDefined &&
    input.priceWinner === "extractor" &&
    typeof gp === "number" && isFinite(gp) &&
    gpc >= 0.7 &&
    gp !== salePrice
  ) {
    geminiObservedPrice = gp;
    geminiObservedCurrency = nonEmptyString(input.geminiCurrency)
      ? input.geminiCurrency!.trim().toUpperCase()
      : null;
  }

  // Conflict: mirror Phase 8 flag. When conflict is true, never carry a sale
  // price even if Phase 8 somehow left one. Phase 8 already drops the legacy
  // price in this case; we mirror that.
  const conflict = !!input.priceConflict;
  const finalSale = conflict ? null : salePrice;
  const finalSource: PriceSource = conflict || !legacyPriceDefined ? "omitted" : resolved.price_source;
  const finalConfidence = conflict || !legacyPriceDefined ? 0 : resolved.price_confidence;

  return {
    ...EMPTY,
    currency,
    sale_price: finalSale,
    price_display: formatPriceDisplay(finalSale, currency),
    price_source: finalSource,
    price_confidence: finalConfidence,
    price_conflict: conflict,
    ...(geminiObservedPrice !== undefined
      ? { gemini_observed_price: geminiObservedPrice, gemini_observed_currency: geminiObservedCurrency ?? null }
      : {}),
  };
}

/**
 * True when the block carries diagnostic value worth attaching.
 * Per invariant #2 of the plan.
 */
export function pricingBlockHasContent(p: PricingBlock): boolean {
  if (p.price_source !== "omitted") return true;
  if (p.price_conflict) return true;
  if (p.currency !== null) return true;
  if (p.list_price !== null) return true;
  if (p.sale_price !== null) return true;
  if (p.price_min !== null) return true;
  if (p.price_max !== null) return true;
  if (p.selected_variant_price !== null) return true;
  return false;
}

/**
 * Summarize a pricing block for metadata.pricing.
 * `priceSourceUsed` is the internal honesty signal from merge resolution.
 */
export function summarizePricing(
  p: PricingBlock,
  priceSourceUsed?: PriceSourceUsed,
): MetadataPricingBlock {
  const hasRange = p.price_min !== null && p.price_max !== null;
  const hasListSale = p.list_price !== null && p.sale_price !== null;
  const geminiDiag =
    typeof p.gemini_observed_price === "number" && p.price_source !== "gemini";
  const out: MetadataPricingBlock = {
    source: p.price_source,
    confidence: p.price_confidence,
    conflict: p.price_conflict,
    has_range: hasRange,
    has_list_sale: hasListSale,
    gemini_diagnostic_only: geminiDiag,
  };
  if (priceSourceUsed) out.price_source_used = priceSourceUsed;
  return out;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function nonEmptyString(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}
