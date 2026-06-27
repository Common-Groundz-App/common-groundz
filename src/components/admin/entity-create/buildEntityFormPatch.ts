// Phase 3.2 bugfix — pure patch builder.
//
// Given predictions (V2) + the lightweight urlMetadata fetched alongside,
// produce a complete EntityFormPatch covering every field the legacy
// `applyPredictionsToForm` would have written into React state. Pure: no
// React hooks, no side effects. Consumed by DraftReviewBody to bypass
// React state races when committing a Draft Apply & Save.

import { entityTypeConfig, type EntityFieldConfig } from '../../../../shared/config/entityTypeConfig';
// NOTE: CreateEntityDialog.tsx (one level up) imports the same module via
// '../../../shared/config/entityTypeConfig'. This file is one level deeper
// (entity-create/), hence the extra '../'.

export interface EntityFormPatch {
  name?: string;
  type?: string;
  description?: string;
  website_url?: string;
  image_url?: string;
  category_id?: string | null;
  authors?: string[];
  languages?: string[];
  isbn?: string;
  publication_year?: number | null;
  ingredients?: string[];
  metadata?: Record<string, any>;
  cast_crew?: Record<string, any>;
  specifications?: Record<string, any>;
  price_info?: Record<string, any>;
  nutritional_info?: Record<string, any>;
  external_ratings?: Record<string, any>;
  // Tags are stored outside formData in the host dialog; surfaced here so
  // DraftReviewBody can ship a single override bundle.
  tags?: string[];
}

export interface BuildPatchInput {
  predictions?: any | null;
  urlMetadata?: any | null;
  /** URL snapshot captured at modal-open time (never live input). */
  analyzedUrl?: string | null;
}

export function buildEntityFormPatchFromPredictions(input: BuildPatchInput): EntityFormPatch {
  const patch: EntityFormPatch = {};
  const pred = input.predictions ?? null;
  const meta = input.urlMetadata ?? null;

  // Type — predictions only (metadata cannot infer type)
  if (pred?.type && typeof pred.type === 'string') patch.type = pred.type;

  // Name — predictions first, fall back to metadata title
  if (pred?.name && typeof pred.name === 'string') {
    patch.name = pred.name;
  } else if (typeof meta?.title === 'string' && meta.title.trim()) {
    patch.name = meta.title.trim();
  }

  // Description — predictions first, fall back to metadata
  if (pred?.description && typeof pred.description === 'string') {
    patch.description = pred.description;
  } else if (typeof meta?.description === 'string' && meta.description.trim()) {
    patch.description = meta.description.trim();
  }

  if (pred?.category_id) patch.category_id = pred.category_id;
  if (Array.isArray(pred?.tags)) patch.tags = pred.tags;

  // Primary image — predictions image_url first, then first valid metadata image
  if (pred?.image_url && typeof pred.image_url === 'string') {
    patch.image_url = pred.image_url;
  } else {
    const metaImages: any[] = Array.isArray(meta?.images)
      ? meta.images
      : meta?.image ? [meta.image] : [];
    for (const item of metaImages) {
      const url = typeof item === 'string' ? item : item?.url;
      if (typeof url === 'string' && url.trim()) {
        patch.image_url = url.trim();
        break;
      }
    }
  }

  // Type-specific structured fields from additional_data
  if (pred?.additional_data && pred?.type) {
    const cfg = entityTypeConfig[pred.type];
    if (cfg?.fields) {
      for (const f of cfg.fields as EntityFieldConfig[]) {
        const v = (pred.additional_data as Record<string, any>)[f.key];
        if (v === undefined || v === null) continue;
        const col = f.storageColumn || 'metadata';
        switch (col) {
          case 'metadata':
            patch.metadata = { ...(patch.metadata || {}), [f.key]: v };
            break;
          case 'cast_crew':
            patch.cast_crew = { ...(patch.cast_crew || {}), [f.key]: v };
            break;
          case 'specifications':
            patch.specifications = { ...(patch.specifications || {}), [f.key]: v };
            break;
          case 'price_info':
            patch.price_info = { ...(patch.price_info || {}), [f.key]: v };
            break;
          case 'nutritional_info':
            patch.nutritional_info = { ...(patch.nutritional_info || {}), [f.key]: v };
            break;
          case 'external_ratings':
            patch.external_ratings = { ...(patch.external_ratings || {}), [f.key]: v };
            break;
          default:
            (patch as any)[col] = v;
        }
      }
    }
  }

  // website_url — prefer the captured analyzed URL snapshot, then
  // predictions.metadata.analyzed_url. Never falls back to live state.
  if (input.analyzedUrl && input.analyzedUrl.trim()) {
    patch.website_url = input.analyzedUrl.trim();
  } else if (pred?.metadata?.analyzed_url && typeof pred.metadata.analyzed_url === 'string') {
    patch.website_url = pred.metadata.analyzed_url;
  }

  return patch;
}
