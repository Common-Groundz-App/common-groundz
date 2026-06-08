// Phase 7: GeminiRawPrediction type + Zod validator.
//
// Canonical 9-type enum (no `other`/`others`), NO category fields.
// File named `response_schema.ts` for clarity even though we do NOT send
// `responseSchema` in the Gemini body in Phase 7 (JSON mode only — see gemini.ts).
// In Phase 8 this raw shape is converted to V2Predictions.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const GEMINI_ALLOWED_TYPES = [
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

export type GeminiAllowedType = typeof GEMINI_ALLOWED_TYPES[number];

/**
 * Phase 7 raw Gemini candidate. NOT V2Predictions.
 * Category fields intentionally absent so Gemini cannot invent taxonomy.
 * Phase 8 will convert this into V2Predictions, filling category_id /
 * matched_category_name / suggested_category_path via deterministic matching
 * (or leaving them null).
 */
export interface GeminiRawPrediction {
  type: GeminiAllowedType;
  name: string;
  description: string | null;
  tags: string[];
  confidence: number;
  reasoning: string | null;
  image_url: string | null;
  images: Array<{ url: string }>;
  additional_data: {
    brand?: string | null;
    price?: number | null;
    currency?: string | null;
  };
  field_confidence: {
    name?: number;
    description?: number;
    image_url?: number;
    brand?: number;
    price?: number;
  };
}

/**
 * Normalize-then-validate one URL value against evidenceBaseUrl.
 * Returns the absolute http(s) URL, or null on any failure.
 * Never throws.
 */
export function normalizeImageUrl(
  value: unknown,
  evidenceBaseUrl: string,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Quick reject — opaque/dangerous schemes seen as bare strings.
  const lowered = trimmed.toLowerCase();
  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("mailto:") ||
    lowered.startsWith("file:") ||
    lowered.startsWith("about:") ||
    lowered.startsWith("blob:")
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(trimmed);
  } catch {
    try {
      resolved = new URL(trimmed, evidenceBaseUrl);
    } catch {
      return null;
    }
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return null;
  }
  return resolved.toString();
}

/**
 * Build a Zod validator bound to a specific evidenceBaseUrl.
 * Image URLs are normalized and dropped if invalid; invalid `image_url`
 * becomes null but does NOT fail validation. Zero valid images is OK.
 */
export function buildGeminiRawPredictionSchema(evidenceBaseUrl: string) {
  return z
    .object({
      type: z.enum(GEMINI_ALLOWED_TYPES),
      name: z.string().min(1),
      description: z.union([z.string(), z.null()]).optional().default(null),
      tags: z.array(z.string()).optional().default([]),
      confidence: z.number().min(0).max(1),
      reasoning: z.union([z.string(), z.null()]).optional().default(null),
      image_url: z.unknown().optional(),
      images: z.array(z.unknown()).optional().default([]),
      additional_data: z
        .object({
          brand: z.union([z.string(), z.null()]).optional(),
          price: z.union([z.number(), z.null()]).optional(),
          currency: z.union([z.string(), z.null()]).optional(),
        })
        .partial()
        .optional()
        .default({}),
      field_confidence: z
        .object({
          name: z.number().min(0).max(1).optional(),
          description: z.number().min(0).max(1).optional(),
          image_url: z.number().min(0).max(1).optional(),
          brand: z.number().min(0).max(1).optional(),
          price: z.number().min(0).max(1).optional(),
        })
        .partial()
        .optional()
        .default({}),
    })
    .passthrough()
    .transform((raw): GeminiRawPrediction => {
      const image_url = normalizeImageUrl(raw.image_url, evidenceBaseUrl);
      const images: Array<{ url: string }> = [];
      for (const item of raw.images ?? []) {
        let candidate: unknown = null;
        if (typeof item === "string") candidate = item;
        else if (item && typeof item === "object" && "url" in item) {
          candidate = (item as { url: unknown }).url;
        }
        const norm = normalizeImageUrl(candidate, evidenceBaseUrl);
        if (norm) images.push({ url: norm });
      }
      return {
        type: raw.type,
        name: raw.name,
        description: raw.description ?? null,
        tags: raw.tags ?? [],
        confidence: raw.confidence,
        reasoning: raw.reasoning ?? null,
        image_url,
        images,
        additional_data: raw.additional_data ?? {},
        field_confidence: raw.field_confidence ?? {},
      };
    });
}
