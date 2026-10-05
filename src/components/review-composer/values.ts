/**
 * The canonical, strongly typed value model of the review composer.
 *
 * Every section owns exactly one key of `ReviewComposerValues`; the value type
 * of each section is fixed here so no section state is ever `unknown`.
 */
import type { MediaItem } from '@/types/media';
import type { CanonicalEntityType } from '@/services/entityType';
import type { CuratedTagAnswer } from '@/components/profile/reviews/questionnaire/curatedTagInput';

export type ReviewVisibility = 'public' | 'private' | 'circle_only';
export const REVIEW_VISIBILITIES: readonly ReviewVisibility[] = ['public', 'circle_only', 'private'];

export type RecommendationChoice = 'yes' | 'maybe' | 'no';

/** Timeline recommendation as the author expressed it. */
export interface RecommendationDraft {
  /** "Base recommendation on rating" — the explicit `'auto'` state. */
  baseOnRating: boolean;
  choice: RecommendationChoice | null;
}

/** A persisted subject (always has a real entity id). */
export interface ComposerSubject {
  id: string;
  name: string;
  /** Raw type as stored/returned; parsed at the boundary by the questionnaire resolver. */
  type: CanonicalEntityType | string | null;
  venue?: string | null;
  metadata?: { formatted_address?: string | null } | null;
  /** Provider (parent) name resolved from the hierarchy, when applicable. */
  providerName?: string | null;
}

export interface QuestionnaireDraft {
  choices: Record<string, string>;
  curated: Record<string, CuratedTagAnswer>;
}

export interface ReviewComposerValues {
  rating: number | null;
  subject: ComposerSubject | null;
  headline: string;
  text: string;
  media: MediaItem[];
  experienceDate: string | null;
  questionnaire: QuestionnaireDraft;
  foodTags: string[];
  visibility: ReviewVisibility;
  recommendation: RecommendationDraft;
}

export type SectionId = keyof ReviewComposerValues;
export type SectionValueMap = { [K in SectionId]: ReviewComposerValues[K] };

export const SECTION_IDS: readonly SectionId[] = [
  'rating',
  'subject',
  'headline',
  'text',
  'media',
  'experienceDate',
  'questionnaire',
  'foodTags',
  'visibility',
  'recommendation',
];

export function emptyComposerValues(): ReviewComposerValues {
  return {
    rating: null,
    subject: null,
    headline: '',
    text: '',
    media: [],
    experienceDate: null,
    questionnaire: { choices: {}, curated: {} },
    foodTags: [],
    visibility: 'public',
    recommendation: { baseOnRating: false, choice: null },
  };
}

/* ---------------- persisted shapes the composer hydrates from ---------------- */

export interface StoredReviewRecord {
  id: string;
  user_id: string;
  entity_id: string | null;
  category: string | null;
  title: string | null;
  venue: string | null;
  subtitle: string | null;
  description: string | null;
  rating: number | null;
  media: MediaItem[] | null;
  visibility: ReviewVisibility;
  experience_date: string | null;
  metadata: unknown;
  status?: string | null;
  /** Hydrated subject; null for legacy-unlinked reviews. */
  entity: ComposerSubject | null;
}

export interface StoredTimelineUpdateRecord {
  id: string;
  review_id: string;
  user_id: string;
  rating: number | null;
  comment: string;
  media: MediaItem[] | null;
  would_recommend: 'yes' | 'maybe' | 'no' | 'auto' | null;
  created_at?: string;
}

/** Order-insensitive-for-keys structural equality for dirty tracking. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => valuesEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (ao[k] === undefined && bo[k] === undefined) continue;
    if (!valuesEqual(ao[k], bo[k])) return false;
  }
  return true;
}
