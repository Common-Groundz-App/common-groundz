// Phase 1.8c.6-A — Page-metadata fallback floor.
//
// When the full pipeline (extractor → Firecrawl → Gemini → search-only fallback)
// fails to produce a merged prediction, this module attempts to synthesize a
// LOW-CONFIDENCE prediction from page-owned signals only (JSON-LD / OG /
// Twitter / HTML title + extract.metadata.mapped_type).
//
// TYPE SAFETY: never invents a type. Only fires when `extract.metadata.
// mapped_type` is non-null, which means the deterministic extractor already
// resolved the type from JSON-LD @type or og:type. We never set
// `type: "others"` as an unknown sentinel and never guess type from title,
// URL slug, domain, or model output.
//
// Pure function — no I/O, no model, no DB. Telemetry-friendly enums only.

import type { PageSignals } from "./extractor.ts";
import { safeAbsoluteUrl } from "./extractor.ts";
import type { ExtractMetadata, V2Predictions } from "./schema.ts";

export type PageMetadataFieldSource =
  | "jsonld"
  | "og"
  | "twitter"
  | "html_title"
  | "none";

export type PageMetadataTypeSource = "type_resolver";

export type PageMetadataFallbackSkipReason =
  | "missing_name"
  | "missing_supporting_field"
  | "type_unresolved"
  | "image_invalid"
  | null;

export interface PageMetadataFallbackDiagnostics {
  used: boolean;
  skip_reason: PageMetadataFallbackSkipReason;
  field_source: {
    name: PageMetadataFieldSource;
    description: PageMetadataFieldSource;
    image_url: PageMetadataFieldSource;
    type: PageMetadataTypeSource | "none";
  };
  image_candidate_count: number;
}

export interface PageMetadataFallbackResult {
  predictions: V2Predictions | null;
  diagnostics: PageMetadataFallbackDiagnostics;
}

export interface PageMetadataFallbackArgs {
  pageSignals: PageSignals | null | undefined;
  extractMetadata: ExtractMetadata;
  /** Absolute URL used to resolve relative og:image candidates. */
  baseUrl: string;
}

function emptyDiagnostics(skip: PageMetadataFallbackSkipReason): PageMetadataFallbackDiagnostics {
  return {
    used: false,
    skip_reason: skip,
    field_source: { name: "none", description: "none", image_url: "none", type: "none" },
    image_candidate_count: 0,
  };
}

function cleanString(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Pick the first non-empty name candidate and return both value + source.
 * Precedence: JSON-LD product name → og:title → twitter:title → HTML <title>.
 */
function pickName(ps: PageSignals): { value: string | null; source: PageMetadataFieldSource } {
  const jsonld = cleanString(ps.jsonld_product_name);
  if (jsonld) return { value: jsonld, source: "jsonld" };
  const og = cleanString(ps.og_title);
  if (og) return { value: og, source: "og" };
  const tw = cleanString(ps.twitter_title);
  if (tw) return { value: tw, source: "twitter" };
  const title = cleanString(ps.title);
  if (title) return { value: title, source: "html_title" };
  return { value: null, source: "none" };
}

/** Precedence: og:description → twitter:description. */
function pickDescription(ps: PageSignals): { value: string | null; source: PageMetadataFieldSource } {
  const og = cleanString(ps.og_description);
  if (og) return { value: og, source: "og" };
  const tw = cleanString(ps.twitter_description);
  if (tw) return { value: tw, source: "twitter" };
  return { value: null, source: "none" };
}

/** og:image only (pageSignals does not expose JSON-LD image / twitter:image). */
function pickImage(
  ps: PageSignals,
  baseUrl: string,
): { value: string | null; source: PageMetadataFieldSource; candidateCount: number } {
  const raw = cleanString(ps.og_image);
  if (!raw) return { value: null, source: "none", candidateCount: 0 };
  const abs = safeAbsoluteUrl(raw, baseUrl);
  if (!abs) return { value: null, source: "none", candidateCount: 1 };
  return { value: abs, source: "og", candidateCount: 1 };
}

/**
 * Build a low-confidence page-metadata fallback prediction.
 *
 * Activation rule (all must hold):
 *   - extract.metadata.mapped_type !== null (deterministic type resolved)
 *   - pageSignals provides a validated name
 *   - at least one of description OR image_url is present and valid
 *
 * Otherwise returns predictions === null with a skip_reason for telemetry.
 *
 * The returned prediction is deliberately conservative:
 *   - confidence = 0.3 (≤ 0.4 floor per plan)
 *   - tags: []
 *   - additional_data: {} (no brand inference)
 *   - reasoning: constant string
 *   - category_id / matched_category_name: null (caller may resolve)
 *   - suggested_category_path: null (not derived here)
 */
export function buildPageMetadataFallback(
  args: PageMetadataFallbackArgs,
): PageMetadataFallbackResult {
  const ps = args.pageSignals ?? null;
  const mappedType = args.extractMetadata.mapped_type;

  // Type-safety gate: never invent a type. mapped_type comes from JSON-LD
  // @type or og:type via the deterministic resolver in extractor.ts.
  if (mappedType === null || mappedType === undefined) {
    return { predictions: null, diagnostics: emptyDiagnostics("type_unresolved") };
  }

  if (!ps) {
    return { predictions: null, diagnostics: emptyDiagnostics("missing_name") };
  }

  const name = pickName(ps);
  if (!name.value) {
    return { predictions: null, diagnostics: emptyDiagnostics("missing_name") };
  }

  const desc = pickDescription(ps);
  const img = pickImage(ps, args.baseUrl);

  // Require at least one supporting field.
  if (!desc.value && !img.value && img.candidateCount === 0) {
    return {
      predictions: null,
      diagnostics: {
        used: false,
        skip_reason: "missing_supporting_field",
        field_source: {
          name: name.source,
          description: "none",
          image_url: "none",
          type: "type_resolver",
        },
        image_candidate_count: 0,
      },
    };
  }

  // If the only supporting signal was an og:image that failed validation,
  // report it distinctly so we don't silently drop the fallback.
  if (!desc.value && !img.value && img.candidateCount > 0) {
    return {
      predictions: null,
      diagnostics: {
        used: false,
        skip_reason: "image_invalid",
        field_source: {
          name: name.source,
          description: "none",
          image_url: "none",
          type: "type_resolver",
        },
        image_candidate_count: img.candidateCount,
      },
    };
  }

  const predictions: V2Predictions = {
    type: mappedType,
    name: name.value,
    description: desc.value,
    category_id: null,
    suggested_category_path: null,
    matched_category_name: null,
    tags: [],
    confidence: 0.3,
    reasoning: "page_metadata_fallback",
    image_url: img.value,
    images: img.value ? [{ url: img.value }] : [],
    additional_data: {},
  };

  return {
    predictions,
    diagnostics: {
      used: true,
      skip_reason: null,
      field_source: {
        name: name.source,
        description: desc.source,
        image_url: img.source,
        type: "type_resolver",
      },
      image_candidate_count: img.candidateCount,
    },
  };
}
