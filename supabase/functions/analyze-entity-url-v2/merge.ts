// Phase 8: Merge deterministic extractor predictions with Gemini raw
// predictions under strict provenance rules. Also handles the Nykaa-class
// recovery path where deterministic extraction failed entirely but Gemini
// produced a usable prediction.
//
// Rules and rationale: see .lovable/plan.md (Phase 8).
//
// NEVER mutates `extract` or `gemini` inputs. Always returns a fresh
// `predictions` object so callers may safely mutate (e.g. for category
// resolution).

import type { V2Predictions } from "./schema.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";

// ─── Diagnostics ──────────────────────────────────────────────────────────

export type WinnerExtBasic = "extractor" | "gemini" | "none";
export type WinnerImage = "extractor" | "gemini" | "firecrawl" | "none";
export type WinnerCurrency = "extractor" | "gemini" | "firecrawl" | "none";
export type WinnerTags = "extractor" | "gemini" | "merged" | "none";

export interface MergeDiagnostics {
  path: "success" | "recovery";
  gemini_used: boolean;
  gemini_fields_used: number;
  field_winners: {
    type: WinnerExtBasic;
    name: WinnerExtBasic;
    description: WinnerExtBasic;
    image_url: WinnerImage;
    brand: WinnerExtBasic;
    price: WinnerExtBasic;
    currency: WinnerCurrency;
    tags: WinnerTags;
  };
  name_junk_override_applied: boolean;
  price_conflict_blocked_gemini: boolean;
  recovery_gate_passed?: boolean;
}

export interface MergeFlags {
  priceConflict: boolean;
  firecrawlCurrency: string | null;
  firecrawlImageUrl: string | null;
}

export interface MergeArgs {
  extract: V2Predictions | null;
  gemini: GeminiRawPrediction | null;
  flags: MergeFlags;
}

export interface MergeOutput {
  predictions: V2Predictions | null;
  diagnostics: MergeDiagnostics;
}

// ─── Validation helpers ───────────────────────────────────────────────────

const ALLOWED_RECOVERY_TYPES = new Set([
  "product", "book", "movie", "tv_show",
  "course", "app", "game", "food", "place",
]);

export function passesRecoveryGate(g: GeminiRawPrediction | null): boolean {
  if (!g) return false;
  if (!ALLOWED_RECOVERY_TYPES.has(g.type)) return false;
  const name = (g.name ?? "").trim();
  if (name.length < 2) return false;
  if (typeof g.confidence !== "number" || g.confidence < 0.6) return false;
  const hasDesc = !!(g.description && g.description.trim().length > 0);
  const hasImg = !!g.image_url;
  const hasBrand = !!(g.additional_data?.brand && String(g.additional_data.brand).trim());
  const hasTags = Array.isArray(g.tags) && g.tags.length >= 2;
  if (!hasDesc && !hasImg && !hasBrand && !hasTags) return false;
  return true;
}

const NAME_JUNK_PREFIX = /^(Buy|Shop|Order|Get)\b/i;
const NAME_JUNK_SUFFIX = /\bOnline\s*$/i;
const NAME_LONG_TAIL = /(For Him|For Her|Online|India)\s*$/i;

function isJunkName(n: string | null | undefined): boolean {
  if (!n) return true;
  const s = n.trim();
  if (!s) return true;
  if (NAME_JUNK_PREFIX.test(s)) return true;
  if (NAME_JUNK_SUFFIX.test(s)) return true;
  if (s.length > 120 && NAME_LONG_TAIL.test(s)) return true;
  return false;
}

function isValidDescription(d: string | null | undefined): d is string {
  if (!d) return false;
  const s = d.trim();
  if (s.length < 40 || s.length > 600) return false;
  if (s.includes("<") || s.includes("{")) return false;
  // all-caps reject
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length > 10 && letters === letters.toUpperCase()) return false;
  return true;
}

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function dedupeTags(...lists: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      if (typeof raw !== "string") continue;
      const t = raw.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= 12) return out;
    }
  }
  return out;
}

function dedupeImages(
  ...lists: Array<Array<{ url: string }> | undefined>
): Array<{ url: string }> {
  const out: Array<{ url: string }> = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list ?? []) {
      if (!item || typeof item.url !== "string") continue;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push({ url: item.url });
    }
  }
  return out;
}

// Clone V2Predictions structurally (no shared array/object refs).
function clonePredictions(p: V2Predictions): V2Predictions {
  return {
    type: p.type,
    name: p.name,
    description: p.description,
    category_id: p.category_id,
    suggested_category_path: p.suggested_category_path,
    matched_category_name: p.matched_category_name,
    tags: [...(p.tags ?? [])],
    confidence: p.confidence,
    reasoning: p.reasoning,
    image_url: p.image_url,
    images: (p.images ?? []).map((i) => ({ url: i.url })),
    additional_data: { ...(p.additional_data ?? {}) },
  };
}

// ─── Price policy (single source of truth) ────────────────────────────────

/**
 * Centralized policy: should the Gemini-provided price be trusted at all?
 * Used by both success and recovery merge paths. The only place that decides
 * whether a Gemini price may be written into final predictions.
 *
 * Rules:
 *  - priceConflict true  → never
 *  - price not a finite number → never
 *  - field_confidence.price < 0.7 → never
 *  - otherwise allowed (caller still respects extractor-wins precedence)
 */
export function geminiPriceTrusted(
  gemini: GeminiRawPrediction | null,
  flags: MergeFlags,
): boolean {
  if (!gemini) return false;
  if (flags.priceConflict) return false;
  const p = gemini.additional_data?.price;
  if (typeof p !== "number" || !isFinite(p)) return false;
  const conf = gemini.field_confidence?.price ?? 0;
  return conf >= 0.7;
}

// ─── GeminiRawPrediction → V2Predictions ──────────────────────────────────

/**
 * Recovery path base: turn a Gemini raw prediction into a V2Predictions.
 * Category fields are left null; caller runs `resolveCategory`.
 *
 * POLICY-FREE: never writes `additional_data.price`. All price decisions are
 * centralized in `mergePredictions` via `geminiPriceTrusted`. This keeps the
 * converter safe for direct use without leaking ungated prices.
 */
export function geminiToV2Predictions(
  raw: GeminiRawPrediction,
  flags: MergeFlags,
): V2Predictions {
  const ad: Record<string, unknown> = {};

  const brand = raw.additional_data?.brand;
  if (nonEmpty(brand)) ad.brand = brand.trim();

  // Currency: gemini > firecrawl
  const gemCur = raw.additional_data?.currency;
  if (nonEmpty(gemCur)) {
    ad.currency = gemCur.trim().toUpperCase();
  } else if (nonEmpty(flags.firecrawlCurrency)) {
    ad.currency = flags.firecrawlCurrency.trim().toUpperCase();
  }

  // NOTE: price intentionally omitted here — mergePredictions owns price policy.

  // Recovery image: firecrawl > gemini
  const image_url = flags.firecrawlImageUrl ?? raw.image_url ?? null;
  const images = dedupeImages(
    image_url ? [{ url: image_url }] : [],
    raw.images,
  );

  return {
    type: raw.type,
    name: raw.name.trim(),
    description: nonEmpty(raw.description) ? raw.description.trim() : null,
    category_id: null,
    suggested_category_path: null,
    matched_category_name: null,
    tags: dedupeTags(raw.tags ?? []),
    confidence: raw.confidence,
    reasoning: `[gemini] ${raw.reasoning ?? "Recovered from Gemini"}`,
    image_url,
    images,
    additional_data: ad,
  };
}

// ─── Main merge ───────────────────────────────────────────────────────────

export function mergePredictions(args: MergeArgs): MergeOutput {
  const { extract, gemini, flags } = args;

  const baseDiag: MergeDiagnostics = {
    path: "success",
    gemini_used: false,
    gemini_fields_used: 0,
    field_winners: {
      type: "none",
      name: "none",
      description: "none",
      image_url: "none",
      brand: "none",
      price: "none",
      currency: "none",
      tags: "none",
    },
    name_junk_override_applied: false,
    price_conflict_blocked_gemini: false,
  };

  // ── Recovery path ─────────────────────────────────────────────────────
  if (!extract) {
    if (!gemini || !passesRecoveryGate(gemini)) {
      return {
        predictions: null,
        diagnostics: {
          ...baseDiag,
          path: "recovery",
          recovery_gate_passed: false,
          price_conflict_blocked_gemini: flags.priceConflict &&
            !!gemini?.additional_data?.price,
        },
      };
    }

    const predictions = geminiToV2Predictions(gemini, flags);
    const diag: MergeDiagnostics = {
      ...baseDiag,
      path: "recovery",
      gemini_used: true,
      recovery_gate_passed: true,
      price_conflict_blocked_gemini: flags.priceConflict &&
        typeof gemini.additional_data?.price === "number",
      field_winners: {
        type: "gemini",
        name: "gemini",
        description: nonEmpty(predictions.description) ? "gemini" : "none",
        image_url: predictions.image_url
          ? (flags.firecrawlImageUrl && predictions.image_url === flags.firecrawlImageUrl
            ? "firecrawl"
            : "gemini")
          : "none",
        brand: predictions.additional_data.brand ? "gemini" : "none",
        price: typeof predictions.additional_data.price === "number" ? "gemini" : "none",
        currency: predictions.additional_data.currency
          ? (gemini.additional_data?.currency
            ? "gemini"
            : "firecrawl")
          : "none",
        tags: predictions.tags.length > 0 ? "gemini" : "none",
      },
      name_junk_override_applied: false,
    };
    diag.gemini_fields_used = countGeminiFields(diag.field_winners);
    return { predictions, diagnostics: diag };
  }

  // ── Success path ──────────────────────────────────────────────────────
  const out = clonePredictions(extract);
  const diag: MergeDiagnostics = {
    ...baseDiag,
    path: "success",
    field_winners: {
      type: "extractor",
      name: "extractor",
      description: nonEmpty(out.description) ? "extractor" : "none",
      image_url: out.image_url ? "extractor" : "none",
      brand: typeof out.additional_data.brand === "string" && (out.additional_data.brand as string).trim()
        ? "extractor"
        : "none",
      price: typeof out.additional_data.price === "number" ? "extractor" : "none",
      currency: typeof out.additional_data.currency === "string" && (out.additional_data.currency as string).trim()
        ? "extractor"
        : "none",
      tags: (out.tags ?? []).length > 0 ? "extractor" : "none",
    },
    name_junk_override_applied: false,
    price_conflict_blocked_gemini: false,
  };

  if (!gemini) {
    return { predictions: out, diagnostics: diag };
  }

  diag.gemini_used = true;

  // ── name: extractor unless junk + high gemini confidence
  if (isJunkName(out.name) && nonEmpty(gemini.name) && (gemini.field_confidence?.name ?? 0) >= 0.7) {
    out.name = gemini.name.trim();
    diag.field_winners.name = "gemini";
    diag.name_junk_override_applied = true;
  }

  // ── description: Gemini if valid, else extractor (no markdown fallback)
  if (isValidDescription(gemini.description)) {
    out.description = gemini.description.trim();
    diag.field_winners.description = "gemini";
  }

  // ── image: extractor > Gemini (success path)
  if (!out.image_url && gemini.image_url) {
    out.image_url = gemini.image_url;
    diag.field_winners.image_url = "gemini";
  }

  // ── images: union dedupe
  const extImgs = out.images ?? [];
  const gemImgs = gemini.images ?? [];
  out.images = dedupeImages(
    out.image_url ? [{ url: out.image_url }] : [],
    extImgs,
    gemImgs,
  );

  // ── tags: union, mark merged when both contributed
  const extTags = extract.tags ?? [];
  const gemTags = gemini.tags ?? [];
  const extHas = extTags.some((t) => typeof t === "string" && t.trim());
  const gemHas = gemTags.some((t) => typeof t === "string" && t.trim());
  out.tags = dedupeTags(extTags, gemTags);
  if (out.tags.length > 0) {
    if (extHas && gemHas) diag.field_winners.tags = "merged";
    else if (gemHas) diag.field_winners.tags = "gemini";
    else diag.field_winners.tags = "extractor";
  }

  // ── brand: Gemini > extractor (value-bearing only)
  const gemBrand = gemini.additional_data?.brand;
  if (nonEmpty(gemBrand)) {
    out.additional_data.brand = gemBrand.trim();
    diag.field_winners.brand = "gemini";
  }

  // ── currency: extractor > firecrawl > gemini
  if (!nonEmpty(out.additional_data.currency as string | null | undefined)) {
    if (nonEmpty(flags.firecrawlCurrency)) {
      out.additional_data.currency = flags.firecrawlCurrency.trim().toUpperCase();
      diag.field_winners.currency = "firecrawl";
    } else if (nonEmpty(gemini.additional_data?.currency)) {
      out.additional_data.currency = gemini.additional_data.currency!.trim().toUpperCase();
      diag.field_winners.currency = "gemini";
    }
  }

  // ── price: conflict blocks; else extractor > gemini (gated)
  if (flags.priceConflict) {
    if (typeof out.additional_data.price === "number") {
      delete out.additional_data.price;
    }
    diag.field_winners.price = "none";
    if (typeof gemini.additional_data?.price === "number") {
      diag.price_conflict_blocked_gemini = true;
    }
  } else if (typeof out.additional_data.price !== "number") {
    const gemPrice = gemini.additional_data?.price;
    const conf = gemini.field_confidence?.price ?? 0;
    if (typeof gemPrice === "number" && isFinite(gemPrice) && conf >= 0.7) {
      out.additional_data.price = gemPrice;
      diag.field_winners.price = "gemini";
    }
  }

  // ── confidence: min of both
  if (typeof gemini.confidence === "number") {
    out.confidence = Math.min(out.confidence, gemini.confidence);
  }

  // ── reasoning: concat
  const extReason = extract.reasoning ? `[extractor] ${extract.reasoning}` : "";
  const gemReason = gemini.reasoning ? `[gemini] ${gemini.reasoning}` : "";
  out.reasoning = [extReason, gemReason].filter(Boolean).join(" ") || out.reasoning;

  diag.gemini_fields_used = countGeminiFields(diag.field_winners);
  return { predictions: out, diagnostics: diag };
}

function countGeminiFields(w: MergeDiagnostics["field_winners"]): number {
  let n = 0;
  if (w.type === "gemini") n++;
  if (w.name === "gemini") n++;
  if (w.description === "gemini") n++;
  if (w.image_url === "gemini") n++;
  if (w.brand === "gemini") n++;
  if (w.price === "gemini") n++;
  if (w.currency === "gemini") n++;
  if (w.tags === "gemini" || w.tags === "merged") n++;
  return n;
}
