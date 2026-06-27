// Phase 3.1 — EntityDraft assembly for analyze-entity-url-v2.
//
// READ-ONLY: this module makes ZERO DB writes, storage writes, or
// enrichment writes. It receives already-collected analysis output
// (predictions + an existing-brand lookup result) and shapes it into
// the shared EntityDraft contract for dark-shipping alongside the
// current response. Phase 3.2 will consume it; until then it is
// purely diagnostic.

import type {
  BrandCandidate,
  EntityDraft,
  EntityDraftInputMethod,
  ImageCandidate,
  SourceEvidence,
} from "../_shared/contracts/entityDraft.types.ts";
import { ENTITY_DRAFT_SCHEMA_VERSION } from "../_shared/contracts/entityDraft.types.ts";
import type { V2Predictions } from "./schema.ts";

const MAX_EVIDENCE_VALUE_CHARS = 200;
const MAX_IMAGE_CANDIDATES = 12;

/** Sanitize a single `sourceEvidence.value` string:
 *  - strip control chars + collapse whitespace
 *  - strip query string for URL-valued evidence (no signatures/tokens)
 *  - hard cap at 200 chars with ellipsis */
export function sanitizeEvidenceValue(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw);
  // Drop ASCII control chars (keep printable + basic whitespace which is collapsed next)
  s = s.replace(/[\u0000-\u001F\u007F]/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // If it looks like an HTTP(S) URL, strip the query string
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      u.search = "";
      u.hash = "";
      s = u.toString();
    } catch {
      // leave as-is
    }
  }
  if (s.length > MAX_EVIDENCE_VALUE_CHARS) {
    s = s.slice(0, MAX_EVIDENCE_VALUE_CHARS - 1) + "…";
  }
  return s;
}

/** Internal dedupe key for image candidates — DOES NOT mutate the
 *  original URL stored on the candidate. */
function imageDedupeKey(url: string): string | null {
  try {
    const u = new URL(url);
    // Strip fragment and known tracking/sizing params
    u.hash = "";
    const STRIP = new Set([
      "w", "h", "width", "height", "quality", "q", "format", "fm",
      "auto", "fit", "crop", "dpr", "ssl", "v", "ver", "version",
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "_gl",
    ]);
    const next = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!STRIP.has(k.toLowerCase())) next.append(k, v);
    }
    u.search = next.toString();
    return `${u.host.toLowerCase()}${u.pathname}${u.search ? "?" + u.search : ""}`;
  } catch {
    return null;
  }
}

function isValidHttpUrl(s: unknown): s is string {
  if (typeof s !== "string" || s.length === 0) return false;
  if (s.startsWith("data:")) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.host;
  } catch {
    return false;
  }
}

export interface ExistingBrandMatch {
  id: string;
  name: string;
  image_url: string | null;
  slug: string | null;
  website_url?: string | null;
}

export interface BuildEntityDraftInput {
  inputMethod: EntityDraftInputMethod;
  inputRef: string;
  predictions: V2Predictions | null;
  /** Pre-fetched read-only lookup of existing brand entities matching
   *  predictions.additional_data.brand (case-insensitive ilike). May be
   *  empty. Caller must NOT create or modify any rows. */
  existingBrandMatches: ExistingBrandMatch[];
  /** Optional extra image URLs already collected by the pipeline
   *  (page metadata, Firecrawl). Predictions.images is always included. */
  extraImageUrls?: Array<{ url: string; source: ImageCandidate["source"]; confidence?: number }>;
}

export function buildEntityDraft(input: BuildEntityDraftInput): EntityDraft {
  const { predictions, existingBrandMatches, inputMethod, inputRef } = input;

  const aiBrandName: string | null =
    (predictions?.additional_data as { brand?: unknown } | undefined)?.brand &&
    typeof (predictions!.additional_data as { brand?: unknown }).brand === "string"
      ? ((predictions!.additional_data as { brand: string }).brand).trim()
      : null;

  // === Brand candidates ===
  const brandCandidates: BrandCandidate[] = [];
  let recommendedBrandIndex: number | undefined;

  if (aiBrandName && aiBrandName.length >= 2) {
    // Existing matches first (these are the safe picks).
    const lowerBrand = aiBrandName.toLowerCase();
    const exact = existingBrandMatches.find(
      (b) => (b.name || "").toLowerCase() === lowerBrand,
    );
    const ordered = exact
      ? [exact, ...existingBrandMatches.filter((b) => b.id !== exact.id)]
      : existingBrandMatches;

    for (const b of ordered.slice(0, 5)) {
      brandCandidates.push({
        id: b.id,
        name: b.name,
        logoUrl: b.image_url ?? undefined,
        websiteUrl: b.website_url ?? undefined,
        source: "existing_entity",
        confidence: exact && b.id === exact.id ? 0.95 : 0.6,
        reason:
          exact && b.id === exact.id
            ? "Exact name match in entities table"
            : "Partial name match in entities table",
        status: "matched_existing",
      });
    }

    // Always include the AI-suggested name as a "suggested_new" candidate
    // so Phase 3.2 UI can offer the explicit create path.
    const alreadyExact = brandCandidates.some(
      (c) => c.name.toLowerCase() === lowerBrand && c.status === "matched_existing",
    );
    if (!alreadyExact) {
      brandCandidates.push({
        name: aiBrandName,
        source: "ai_inference",
        confidence: 0.5,
        reason: "Extracted by AI from page; no existing brand entity matched",
        status: "suggested_new",
      });
    }

    // Recommend the exact existing match if present, otherwise leave undefined
    // so Phase 3.2 forces the user to choose explicitly.
    if (exact) {
      recommendedBrandIndex = brandCandidates.findIndex(
        (c) => c.id === exact.id && c.status === "matched_existing",
      );
      if (recommendedBrandIndex < 0) recommendedBrandIndex = undefined;
    }
  } else if (predictions && predictions.type === "brand") {
    // The entity itself IS a brand — no parent-brand picker needed.
    // Leave brandCandidates empty; Phase 3.2 treats this as not_applicable.
  }

  // === Brand fallback chain (only when no candidates yet AND not a brand) ===
  // Conservative: structured signals were already tried above. Here we try
  // slug-based then title-ampersand patterns. Both produce `suggested_new`
  // candidates with confidence ≤ 0.4 and NEVER set recommendedBrandIndex —
  // the admin must explicitly confirm in BrandPicker.
  const brandFallbackSources: string[] = [];
  if (brandCandidates.length === 0 && predictions?.type && predictions.type !== "brand") {
    const slugBrand = inferBrandFromUrlSlug(inputRef);
    const titleBrand = inferBrandFromTitleAmpersand(predictions?.name ?? null);

    // Normalize agreement: if slug brand and title-ampersand brand slugify to
    // the same value, keep only the title version (nicer display) and tag
    // the source as both. Avoids emitting duplicate fallback candidates.
    let merged: { name: string; sources: string[]; confidence: number } | null = null;
    if (slugBrand && titleBrand && slugifyForCompare(titleBrand) === slugifyForCompare(slugBrand)) {
      merged = { name: titleBrand, sources: ["slug", "title_ampersand"], confidence: 0.4 };
    }

    if (merged) {
      brandCandidates.push({
        name: merged.name,
        source: "ai_inference",
        confidence: merged.confidence,
        reason: "Inferred from URL slug and title (low confidence — please confirm)",
        status: "suggested_new",
      });
      brandFallbackSources.push(...merged.sources);
    } else {
      if (slugBrand) {
        brandCandidates.push({
          name: slugBrand,
          source: "ai_inference",
          confidence: 0.35,
          reason: "Inferred from URL slug (low confidence — please confirm)",
          status: "suggested_new",
        });
        brandFallbackSources.push("slug");
      }
      if (titleBrand) {
        brandCandidates.push({
          name: titleBrand,
          source: "ai_inference",
          confidence: 0.35,
          reason: "Inferred from product title ampersand pattern (low confidence — please confirm)",
          status: "suggested_new",
        });
        brandFallbackSources.push("title_ampersand");
      }
    }
  }



  // === Image candidates ===
  const rawImages: ImageCandidate[] = [];

  // From predictions.images (final merged source — highest confidence)
  if (predictions?.images?.length) {
    for (const img of predictions.images) {
      if (isValidHttpUrl(img?.url)) {
        rawImages.push({
          url: img.url,
          source: "page_metadata",
          confidence: 0.8,
        });
      }
    }
  }
  // From predictions.image_url (primary pick)
  if (isValidHttpUrl(predictions?.image_url)) {
    rawImages.unshift({
      url: predictions!.image_url as string,
      source: "page_metadata",
      confidence: 0.9,
      reason: "Primary image selected by extractor/merge",
    });
  }
  // From caller-provided extras
  if (input.extraImageUrls?.length) {
    for (const extra of input.extraImageUrls) {
      if (isValidHttpUrl(extra.url)) {
        rawImages.push({
          url: extra.url,
          source: extra.source,
          confidence: extra.confidence ?? 0.5,
        });
      }
    }
  }

  // Dedupe by normalized key, KEEPING the original url string on each candidate
  const seen = new Set<string>();
  const deduped: ImageCandidate[] = [];
  for (const cand of rawImages) {
    const key = imageDedupeKey(cand.url);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cand);
  }

  // Cap at MAX_IMAGE_CANDIDATES sorted by confidence desc (stable)
  const ranked = deduped
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.confidence - a.c.confidence || a.i - b.i)
    .slice(0, MAX_IMAGE_CANDIDATES)
    .map((x) => x.c);

  // Recompute recommended image index against survivors
  let recommendedImageIndex: number | undefined;
  if (ranked.length > 0) {
    if (isValidHttpUrl(predictions?.image_url)) {
      const idx = ranked.findIndex((c) => c.url === predictions!.image_url);
      recommendedImageIndex = idx >= 0 ? idx : 0;
    } else {
      recommendedImageIndex = 0;
    }
  }

  // === Source evidence (sanitized) ===
  const evidence: SourceEvidence[] = [];
  if (predictions?.name) {
    evidence.push({
      field: "name",
      value: sanitizeEvidenceValue(predictions.name),
      source: "ai_inference",
      confidence: predictions.confidence ?? 0.5,
    });
  }
  if (predictions?.description) {
    evidence.push({
      field: "description",
      value: sanitizeEvidenceValue(predictions.description),
      source: "ai_inference",
      confidence: predictions.confidence ?? 0.5,
    });
  }
  if (aiBrandName) {
    evidence.push({
      field: "brand",
      value: sanitizeEvidenceValue(aiBrandName),
      source: "ai_inference",
      confidence: 0.6,
    });
  }
  if (isValidHttpUrl(predictions?.image_url)) {
    evidence.push({
      field: "image",
      value: sanitizeEvidenceValue(predictions!.image_url),
      source: "page_metadata",
      confidence: 0.8,
    });
  }

  const draft: EntityDraft = {
    schemaVersion: ENTITY_DRAFT_SCHEMA_VERSION,
    inputMethod,
    inputRef,
    nameGuess: predictions?.name ?? undefined,
    typeGuess: predictions?.type ?? undefined,
    descriptionGuess: predictions?.description ?? undefined,
    categoryHint:
      predictions?.category_id || predictions?.matched_category_name
        ? {
            id: predictions?.category_id ?? undefined,
            path: predictions?.matched_category_name ?? undefined,
          }
        : undefined,
    structuredHints: predictions?.additional_data
      ? (predictions.additional_data as Record<string, unknown>)
      : undefined,
    brandCandidates,
    imageCandidates: ranked,
    recommendedBrandIndex,
    recommendedImageIndex,
    sourceEvidence: evidence,
    warnings: brandFallbackSources.length
      ? brandFallbackSources.map((s) => `brand_fallback_source:${s}`)
      : undefined,
  };

  return draft;
}

// ─── Brand fallback helpers (Phase 3.2 bugfix) ─────────────────────────────
// Phrase-level descriptor stoplist. Token-level blocks (e.g. blocking any
// phrase containing "Black") would reject real brands like "Black & Decker".
const AMP_DESCRIPTOR_STOPLIST: ReadonlySet<string> = new Set([
  "salt & pepper", "bed & bath", "peace & love", "sun & sand",
  "hugs & kisses", "health & beauty", "arts & crafts", "rock & roll",
  "tried & true", "rules & regulations", "food & drink", "men & women",
  "mom & baby", "wear & tear", "trial & error", "cause & effect",
  "tea & coffee", "wine & dine", "hide & seek", "rise & shine",
  "give & take", "now & then", "back & forth", "up & down",
  "in & out", "give & receive", "buy & sell",
]);

function slugifyForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(s: string): string {
  return s.replace(/\b([a-z])([a-z0-9]*)\b/gi, (_m, a: string, b: string) =>
    a.toUpperCase() + b.toLowerCase()
  );
}

/** Extract a plausible brand from the URL slug. Conservative: the LAST
 *  non-numeric path segment is assumed to be the product slug; brand is
 *  taken as its first 1–2 hyphen tokens (each ≥ 3 chars, alphabetic).
 *  Returns null for anything ambiguous. */
function inferBrandFromUrlSlug(inputRef: string): string | null {
  try {
    const u = new URL(inputRef);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    let slug: string | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!/^\d+$/.test(parts[i])) { slug = parts[i]; break; }
    }
    if (!slug) return null;
    // Strip trailing -<digits> (often product IDs)
    slug = slug.replace(/[-_]\d+$/g, "");
    const tokens = slug.split(/[-_]+/).filter((t) => /^[a-z][a-z0-9]+$/i.test(t));
    if (tokens.length === 0) return null;
    const STOP = new Set(["the", "and", "for", "with", "buy", "shop", "product", "products", "en", "in"]);
    const head = tokens.filter((t) => !STOP.has(t.toLowerCase())).slice(0, 2);
    if (head.length === 0) return null;
    // Require at least one token ≥ 3 chars to avoid junk
    if (!head.some((t) => t.length >= 3)) return null;
    return toTitleCase(head.join(" "));
  } catch {
    return null;
  }
}

/** Detect a `Foo & Bar` (or `Foo and Bar`) ampersand brand pattern at the
 *  START of the product title. Phrase-level descriptor stoplist applies. */
function inferBrandFromTitleAmpersand(title: string | null): string | null {
  if (!title) return null;
  const m = title.match(/^\s*([A-Z][A-Za-z0-9]+)\s*(?:&|and)\s*([A-Z][A-Za-z0-9]+)\b/);
  if (!m) return null;
  const phrase = `${m[1]} & ${m[2]}`;
  if (AMP_DESCRIPTOR_STOPLIST.has(phrase.toLowerCase())) return null;
  return phrase;
}

