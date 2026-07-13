// Phase 3.5a — applyEntityDraft
//
// Given a search candidate (Gemini grounded draft + minimal candidate
// summary), build the aiPredictions object that CreateEntityDialog already
// feeds into <AutoFillPreviewModal useDraftReview />. Reusing that path
// means the entire brand-picker / image-picker / prefill flow is shared
// with the URL analyze path — no duplicate review UI.

import type { EntityDraft, BrandCandidate } from '@/types/entityDraft';
import { supabase } from '@/integrations/supabase/client';

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
    website_url?: string;
  };
  entityDraft: EntityDraft;
  metadata: {
    analyzed_url: string;
  };
}

export function buildSearchPredictions(payload: SearchCandidatePayload): SearchPredictionsShape {
  const { candidate, draft } = payload;
  return {
    __fromSearch: true,
    predictions: {
      name: candidate.name,
      type: candidate.type,
      description: candidate.description ?? '',
      // We deliberately do NOT pre-fill website_url with the citation URL —
      // it's usually a review/list page, not the entity's website. The
      // reviewer can paste one before Save.
    },
    entityDraft: draft,
    metadata: {
      analyzed_url: candidate.sourceUrl,
    },
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
