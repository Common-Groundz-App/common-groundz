// Phase 3.5a — applyEntityDraft
//
// Given a search candidate (Gemini grounded draft + minimal candidate
// summary), build the aiPredictions object that CreateEntityDialog already
// feeds into <AutoFillPreviewModal useDraftReview />. Reusing that path
// means the entire brand-picker / image-picker / prefill flow is shared
// with the URL analyze path — no duplicate review UI.

import type { EntityDraft, BrandCandidate, ImageCandidate } from '@/types/entityDraft';
import { supabase } from '@/integrations/supabase/client';

export type EnrichedImageMethod =
  | 'og'
  | 'twitter'
  | 'image_src'
  | 'json_ld'
  | 'firecrawl_metadata';

/** Phase 3.5b — Prepend an enriched image to an EntityDraft's imageCandidates.
 *  v8b — accepts an optional `source` so Firecrawl-rendered images can be
 *  labeled distinctly in the picker ("Rendered page"). Defaults to
 *  'page_metadata' for backward compatibility.
 *  Idempotent: no-op if the same URL is already present. Never mutates input. */
export function mergeEnrichedImage(
  draft: EntityDraft,
  imageUrl: string,
  method: EnrichedImageMethod,
  source: 'page_metadata' | 'firecrawl' = 'page_metadata',
): EntityDraft {
  if (!imageUrl) return draft;
  const existing = draft.imageCandidates ?? [];
  if (existing.some((c) => c.url === imageUrl)) return draft;
  const reasonByMethod: Record<EnrichedImageMethod, string> = {
    og: 'og:image from source page',
    twitter: 'twitter:image from source page',
    image_src: 'link rel=image_src from source page',
    json_ld: 'JSON-LD image from source page',
    firecrawl_metadata: 'og:image from Firecrawl-rendered page',
  };
  const enriched: ImageCandidate = {
    url: imageUrl,
    source,
    confidence: source === 'firecrawl' ? 0.7 : 0.75,
    reason: reasonByMethod[method],
  };
  return {
    ...draft,
    imageCandidates: [enriched, ...existing],
    recommendedImageIndex: 0,
  };
}

export interface SearchCandidatePayload {
  draft: EntityDraft;
  candidate: {
    name: string;
    type: string;
    brand: string | null;
    variant: string | null;
    category: string | null;
    description: string;
    imageUrl: string | null;
    sourceUrl: string;
    sourceTitle: string | null;
    displayDomain: string;
    confidence: number;
  };
}

/** Shape the AutoFillPreviewModal already expects on `predictions`. */
export interface SearchPredictionsShape {
  __fromSearch: true;
  predictions: {
    name: string;
    type: string;
    description: string;
  };
  entityDraft: EntityDraft;
  /** Full citation URL — kept for diagnostics / continuation only. Never
   *  passed to the DraftReviewBody as `analyzed_url`, because citation
   *  pages are usually review/list URLs, not the entity's real website. */
  searchSourceUrl: string;
}

export function buildSearchPredictions(payload: SearchCandidatePayload): SearchPredictionsShape {
  const { candidate, draft } = payload;
  return {
    __fromSearch: true,
    predictions: {
      name: candidate.name,
      type: candidate.type,
      description: candidate.description ?? '',
    },
    entityDraft: draft,
    searchSourceUrl: candidate.sourceUrl,
  };
}

/** Runs a lightweight duplicate check for each `suggested_new` brand and
 *  upgrades matched ones to `matched_existing` (with id/logo) so BrandPicker
 *  offers "use existing" instead of "create new". */
export async function enrichBrandCandidatesWithExistingMatch(
  candidates: BrandCandidate[],
): Promise<BrandCandidate[]> {
  if (candidates.length === 0) return candidates;

  const results = await Promise.all(
    candidates.map(async (c) => {
      if (c.status !== 'suggested_new' || !c.name) return c;
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('id, name, image_url, website_url')
          .eq('type', 'brand')
          .eq('is_deleted', false)
          .neq('approval_status', 'rejected')
          .ilike('name', c.name.trim())
          .limit(1)
          .maybeSingle();
        if (error || !data) return c;
        return {
          ...c,
          id: data.id,
          logoUrl: (data as any).image_url ?? c.logoUrl,
          websiteUrl: (data as any).website_url ?? c.websiteUrl,
          status: 'matched_existing' as const,
        };
      } catch {
        return c;
      }
    }),
  );
  return results;
}
