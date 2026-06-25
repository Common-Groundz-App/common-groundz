// Re-export of the shared EntityDraft contract so frontend code can import
// from `@/types/entityDraft` without reaching into the edge-function folder.
//
// The single source of truth still lives at
// `supabase/functions/_shared/contracts/entityDraft.types.ts`. Keep them
// in sync — if you add a field there, add it there. This file only
// re-exports types; it has no runtime code.

export type {
  BrandCandidate,
  ImageCandidate,
  EntityDraft,
  EntityDraftStatus,
  EntityDraftInputMethod,
  BrandStatus,
  CandidateSource,
  SourceEvidence,
} from '../../supabase/functions/_shared/contracts/entityDraft.types';
