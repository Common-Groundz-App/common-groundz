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
import { normalizeBrandName } from "../_shared/brand_normalize.ts";
import {
  findOfficialBrandWebsite,
  searchBrandLogoV2,
} from "./brand_logo_lookup.ts";

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

// ─── V2-only logo URL normalization + filter (Fix Pack v3.3) ─────────────
// Scope-locked to analyze-entity-url-v2 — do NOT export/import from _shared.

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

/** Normalize a logo URL: unwrap redirect wrappers, strip tracking params.
 *  Returns cleaned URL, or null when the wrapper had no inner URL. */
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

  // Unwrap known redirect wrappers.
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

/** Returns a reject reason if this normalized URL should be dropped, else null. */
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

/** Accept helper: same-origin OR trusted extractor OR image-like URL. */
function isAcceptableLogo(
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

/** Try same-origin favicon fallback under a shared abort signal. */
async function tryOwnOriginFavicon(
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

/** Internal dedupe key for image candidates — DOES NOT mutate the
 *  original URL stored on the candidate. */
function imageDedupeKey(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = "";
    const STRIP = new Set([
      "w", "h", "width", "height", "quality", "q", "format", "fm",
      "auto", "fit", "crop", "dpr", "ssl", "v", "ver", "version",
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "_gl", "srsltid", "fbclid", "gclid", "mc_cid", "mc_eid",
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
  /** V2 Brand Logo Parity — optional Google CSE credentials + flag. When
   *  omitted or `enabled=false` or missing creds, the enrichment stage
   *  no-ops. Only the own-origin favicon fallback runs (as before). */
  logoLookup?: {
    enabled: boolean;
    googleApiKey?: string | null;
    googleCxId?: string | null;
    /** Hard global budget for website + image + favicon combined. */
    totalBudgetMs?: number;
  };
}

export async function buildEntityDraft(input: BuildEntityDraftInput): Promise<EntityDraft> {
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
      // Fix Pack v3.3 — filter stored logo URL through V2 normalizer.
      let filteredLogo: string | undefined = undefined;
      if (b.image_url) {
        const normalized = normalizeLogoUrl(b.image_url);
        if (!normalized) {
          console.log(JSON.stringify({
            event: "v2_logo_rejected",
            reason: "redirect_wrapper_empty",
            brand: b.name,
            rawHost: (() => { try { return new URL(b.image_url!).hostname; } catch { return "unknown"; } })(),
          }));
        } else {
          const rejectReason = isRejectedLogoUrl(normalized);
          if (rejectReason) {
            console.log(JSON.stringify({
              event: "v2_logo_rejected", reason: rejectReason, brand: b.name,
              rawHost: (() => { try { return new URL(normalized).hostname; } catch { return "unknown"; } })(),
            }));
          } else if (!isAcceptableLogo(normalized, b.website_url, "existing_entity")) {
            console.log(JSON.stringify({
              event: "v2_logo_rejected", reason: "non_image_url", brand: b.name,
              rawHost: (() => { try { return new URL(normalized).hostname; } catch { return "unknown"; } })(),
            }));
          } else {
            filteredLogo = normalized;
          }
        }
      }
      brandCandidates.push({
        id: b.id,
        name: b.name,
        logoUrl: filteredLogo,
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
    const slugBrandResult = inferBrandFromUrlSlug(inputRef);
    const slugBrand = slugBrandResult?.name ?? null;
    const slugSource = slugBrandResult?.source ?? "slug";
    const titleBrand = inferBrandFromTitleAmpersand(predictions?.name ?? null);

    // Normalize agreement: if slug brand and title-ampersand brand slugify to
    // the same value, keep only the title version (nicer display) and tag
    // the source as both. Avoids emitting duplicate fallback candidates.
    let merged: { name: string; sources: string[]; confidence: number } | null = null;
    if (slugBrand && titleBrand && slugifyForCompare(titleBrand) === slugifyForCompare(slugBrand)) {
      merged = { name: titleBrand, sources: [slugSource, "title_ampersand"], confidence: 0.4 };
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
        brandFallbackSources.push(slugSource);
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

  // === V2 Brand Logo Parity — global 4s enrichment stage =================
  // Sequence (all under ONE shared AbortController):
  //   1. Retailer/source-site suppression (pick correct brand candidate).
  //   2. Skip if picked candidate already has a valid logo (curated wins).
  //   3. Skip if normalized-dupe of an existing DB brand match.
  //   4. Google CSE website lookup (if picked has no websiteUrl).
  //   5. Google CSE image lookup (if picked has no logoUrl).
  //   6. Own-origin favicon fallback (last resort).
  // Any error / abort / missing creds / flag off → candidate keeps prior
  // state. Analyze never fails because of this stage.
  const totalBudgetMs = input.logoLookup?.totalBudgetMs ?? 4000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), totalBudgetMs);
  const enrichStart = Date.now();
  const remainingMs = () => Math.max(0, totalBudgetMs - (Date.now() - enrichStart));

  try {
    // ── Step 1: pick target candidate (retailer suppression) ─────────────
    let picked = pickTopBrandCandidate(brandCandidates, inputRef);
    if (picked) {
      const pickedIdx = brandCandidates.indexOf(picked);

      // ── Step 2: never override curated existing logo ───────────────────
      const alreadyHasValidLogo = !!picked.logoUrl;
      if (alreadyHasValidLogo) {
        console.log(JSON.stringify({
          event: "v2_brand_logo_skipped", reason: "already_has_logo",
          candidateSource: picked.source,
        }));
      } else {
        // ── Step 3: skip if normalized-dupe of an existing DB brand ─────
        const pickedNorm = normalizeBrandName(picked.name);
        const isDupe =
          picked.status === "suggested_new" &&
          existingBrandMatches.some(
            (b) => normalizeBrandName(b.name || "") === pickedNorm && !!b.image_url,
          );
        if (isDupe) {
          console.log(JSON.stringify({
            event: "v2_brand_logo_skipped", reason: "normalized_dupe",
          }));
        } else {
          console.log(JSON.stringify({
            event: "v2_brand_logo_stage_start",
            candidateSource: picked.source,
            hasWebsite: !!picked.websiteUrl,
            hasLogo: !!picked.logoUrl,
          }));

          const lookupCfg = input.logoLookup;
          const canUseGoogle =
            !!lookupCfg?.enabled && !!lookupCfg.googleApiKey && !!lookupCfg.googleCxId;
          if (lookupCfg && !lookupCfg.enabled) {
            console.log(JSON.stringify({ event: "v2_brand_logo_skipped", reason: "flag_off" }));
          } else if (lookupCfg?.enabled && !canUseGoogle) {
            console.log(JSON.stringify({ event: "v2_brand_logo_skipped", reason: "no_google_creds" }));
          }

          // ── Step 4: website lookup ──────────────────────────────────
          if (canUseGoogle && !picked.websiteUrl && remainingMs() > 0) {
            const t = Date.now();
            try {
              const w = await findOfficialBrandWebsite(
                picked.name, lookupCfg!.googleApiKey!, lookupCfg!.googleCxId!, controller.signal,
              );
              const ms = Date.now() - t;
              if (w) {
                picked.websiteUrl = w;
                evidence.push({
                  field: "website", value: sanitizeEvidenceValue(w),
                  source: "google_cse", confidence: 0.6,
                });
              }
              console.log(JSON.stringify({ event: "v2_brand_website_lookup", ok: !!w, ms }));
            } catch {
              console.log(JSON.stringify({ event: "v2_brand_website_lookup", ok: false, ms: Date.now() - t }));
            }
          }

          // ── Step 5: logo image lookup ───────────────────────────────
          if (canUseGoogle && !picked.logoUrl && remainingMs() > 0) {
            const t = Date.now();
            const filterPipeline = (raw: string): string | null => {
              const n = normalizeLogoUrl(raw);
              if (!n) return null;
              if (isRejectedLogoUrl(n)) return null;
              if (!isAcceptableLogo(n, picked!.websiteUrl, "google_images")) return null;
              return n;
            };
            try {
              const res = await searchBrandLogoV2(
                picked.name, picked.websiteUrl ?? null,
                lookupCfg!.googleApiKey!, lookupCfg!.googleCxId!,
                controller.signal, filterPipeline,
              );
              const ms = Date.now() - t;
              if (res.url) {
                picked.logoUrl = res.url;
                evidence.push({
                  field: "logo", value: sanitizeEvidenceValue(res.url),
                  source: "google_images", confidence: 0.6,
                });
                console.log(JSON.stringify({
                  event: "v2_brand_logo_lookup", ok: true, ms,
                  source: "google_images", phase: res.phase,
                  scoreBucket: res.score >= 20 ? "high" : res.score >= 10 ? "med" : "low",
                }));
              } else {
                console.log(JSON.stringify({
                  event: "v2_brand_logo_lookup", ok: false, ms, source: "none",
                }));
              }
            } catch {
              console.log(JSON.stringify({
                event: "v2_brand_logo_lookup", ok: false, ms: Date.now() - t, source: "none",
              }));
            }
          }

          // ── Step 6: own-origin favicon fallback (shared signal) ─────
          if (!picked.logoUrl && picked.websiteUrl && remainingMs() > 0) {
            try {
              const found = await tryOwnOriginFavicon(picked.websiteUrl, controller.signal);
              if (found) {
                picked.logoUrl = found;
                console.log(JSON.stringify({
                  event: "v2_brand_logo_lookup", ok: true, source: "favicon",
                }));
              }
            } catch { /* ignore */ }
          }

          // Reflect any brand picker index change (retailer suppression may
          // have swapped a lower-ranked candidate to the front).
          void pickedIdx;
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
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

/** Format a hyphenated slug fragment for display. Short brand-style tokens
 *  like `axis-y` (each side ≤ 4 chars, alphabetic) → `AXIS-Y`. Anything
 *  longer → Title Case with spaces. */
function formatSlugBrand(slugFragment: string): string {
  const tokens = slugFragment.split(/-+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const allShort = tokens.every((t) => t.length <= 4 && /^[a-z][a-z0-9]*$/i.test(t));
  if (allShort && tokens.length >= 2) {
    return tokens.map((t) => t.toUpperCase()).join("-");
  }
  return toTitleCase(tokens.join(" "));
}

/** Extract a plausible brand from the URL slug. Two strategies:
 *  1. If the last non-numeric path segment contains `_`, take the substring
 *     before the first `_` as the brand slug candidate (e.g.
 *     `axis-y_dark-spot-...` → `AXIS-Y`). Source = `slug_before_underscore`.
 *  2. Otherwise take the first 1–2 hyphen tokens as the brand. Source = `slug`.
 *  Returns null for anything ambiguous. */
function inferBrandFromUrlSlug(
  inputRef: string,
): { name: string; source: "slug" | "slug_before_underscore" } | null {
  try {
    const u = new URL(inputRef);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    let slug: string | null = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!/^\d+$/.test(parts[i])) { slug = parts[i]; break; }
    }
    if (!slug) return null;

    // Strategy 1: split on first underscore — segment-before-underscore is brand.
    if (slug.includes("_")) {
      const head = slug.split("_")[0];
      const cleaned = head.replace(/^-+|-+$/g, "");
      if (cleaned && /[a-z]/i.test(cleaned)) {
        return { name: formatSlugBrand(cleaned), source: "slug_before_underscore" };
      }
    }

    // Strategy 2: legacy — first 1–2 hyphen tokens.
    slug = slug.replace(/[-_]\d+$/g, "");
    const tokens = slug.split(/[-_]+/).filter((t) => /^[a-z][a-z0-9]+$/i.test(t));
    if (tokens.length === 0) return null;
    const STOP = new Set(["the", "and", "for", "with", "buy", "shop", "product", "products", "en", "in"]);
    const head = tokens.filter((t) => !STOP.has(t.toLowerCase())).slice(0, 2);
    if (head.length === 0) return null;
    if (!head.some((t) => t.length >= 3)) return null;
    return { name: toTitleCase(head.join(" ")), source: "slug" };
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

