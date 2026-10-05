/**
 * Section registry. Each section owns ONE value: how it hydrates from a stored
 * record, how it validates, and whether it is available. Sections never build
 * save payloads — that belongs exclusively to `saveBuilders.ts`.
 */
import type { ComposerCapabilities, ComposerMode } from '../modes';
import {
  REVIEW_VISIBILITIES,
  emptyComposerValues,
  type ReviewComposerValues,
  type SectionId,
  type SectionValueMap,
  type StoredReviewRecord,
  type StoredTimelineUpdateRecord,
} from '../values';
import {
  resolveQuestionnaire,
  type QuestionnaireResolution,
} from '@/components/profile/reviews/questionnaire/resolve';
import {
  hydrateQuestionnaireAnswers,
  isQuestionnaireWritable,
  readQuestionnaireEnvelope,
} from '@/components/profile/reviews/questionnaire/envelope';
import { resolvePersistedCategory, type SubjectOrigin } from '@/components/profile/reviews/categoryPersistence';
import { isPlainMetadataObject } from '@/components/profile/reviews/questionnaire/metadata';

/**
 * - `enabled`              — participates fully.
 * - `mode-disabled`        — the mode has no such section: fully inert.
 * - `subject-incompatible` — the current subject has no such section (e.g. food
 *                            tags on a book). Inert; answers were reset by
 *                            SUBJECT_CHANGED, never silently submitted.
 * - `not-rendered`         — exists but is on another step. Still active
 *                            (validated, dirty, saved). Computed by the step engine.
 */
export type SectionAvailability = 'enabled' | 'mode-disabled' | 'subject-incompatible' | 'not-rendered';

export interface SectionContext {
  caps: ComposerCapabilities;
  values: ReviewComposerValues;
  stored: StoredReviewRecord | null;
  subjectOrigin: SubjectOrigin;
}

export interface HydrationRecord {
  review?: StoredReviewRecord | null;
  update?: StoredTimelineUpdateRecord | null;
}

export interface SectionDefinition<K extends SectionId> {
  id: K;
  label: string;
  hydrate(record: HydrationRecord, mode: ComposerMode): SectionValueMap[K];
  validate(value: SectionValueMap[K], ctx: SectionContext): string | null;
  /** Mode/subject availability. Step placement is layered on by the step engine. */
  availability(ctx: SectionContext): Exclude<SectionAvailability, 'not-rendered'>;
}

/* ------------------------- questionnaire context ------------------------- */

export interface QuestionnaireContext {
  resolution: QuestionnaireResolution | null;
  /** Value this save would write to `reviews.category` (null = unresolvable). */
  category: string | null;
  writable: boolean;
  hasFoodTags: boolean;
  hasQuestions: boolean;
}

export function getQuestionnaireContext(ctx: SectionContext): QuestionnaireContext {
  const isEdit = ctx.caps.operation === 'edit';
  const entityId = isEdit ? ctx.stored?.entity_id ?? null : ctx.values.subject?.id ?? null;
  const subjectType = isEdit ? ctx.stored?.entity?.type ?? null : ctx.values.subject?.type ?? null;

  if (!isEdit && !ctx.values.subject) {
    return { resolution: null, category: null, writable: false, hasFoodTags: false, hasQuestions: false };
  }
  const resolution = resolveQuestionnaire({ entityId, subjectType });
  const canonical = resolution.mode === 'canonical' ? resolution.type : null;
  const category = resolvePersistedCategory({
    subjectOrigin: ctx.subjectOrigin,
    isEditMode: isEdit,
    canonicalCategory: canonical,
    storedCategory: ctx.stored?.category ?? null,
  });
  const config = resolution.mode === 'invalid' ? null : resolution.config;
  const hasFoodTags = !!config?.sections.some((s) => s.fields.some((f) => f.id === 'food_tags'));
  const hasQuestions = !!config?.sections.some((s) => s.fields.some((f) => f.id !== 'food_tags'));
  return {
    resolution,
    category,
    writable: isQuestionnaireWritable(category, canonical),
    hasFoodTags,
    hasQuestions,
  };
}

/* ------------------------------ helpers ------------------------------ */

const modeOff = (ctx: SectionContext, id: SectionId) => ctx.caps.sections[id] === 'off';
const isRequired = (ctx: SectionContext, id: SectionId) => ctx.caps.sections[id] === 'required';
const simpleAvailability =
  (id: SectionId) =>
  (ctx: SectionContext): 'enabled' | 'mode-disabled' =>
    modeOff(ctx, id) ? 'mode-disabled' : 'enabled';

const MAX_MEDIA = 4;

function storedFoodTags(metadata: unknown): string[] {
  if (!isPlainMetadataObject(metadata)) return [];
  const raw = metadata.food_tags;
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
}

/* ------------------------------ registry ------------------------------ */

export const SECTIONS: { [K in SectionId]: SectionDefinition<K> } = {
  rating: {
    id: 'rating',
    label: 'Rating',
    hydrate: (r, mode) =>
      mode.endsWith('timeline-update') ? r.update?.rating ?? null : r.review?.rating ?? null,
    validate: (v, ctx) => {
      if (v === null || v === 0) return isRequired(ctx, 'rating') ? 'Please choose a rating.' : null;
      return Number.isInteger(v) && v >= 1 && v <= 5 ? null : 'Rating must be between 1 and 5.';
    },
    availability: simpleAvailability('rating'),
  },
  subject: {
    id: 'subject',
    label: 'What are you reviewing?',
    hydrate: (r) => r.review?.entity ?? null,
    validate: (v, ctx) => {
      if (ctx.caps.operation === 'edit') {
        // Locked. Legacy-unlinked reviews legitimately have no subject.
        if (!ctx.stored?.entity_id) return null;
        const res = resolveQuestionnaire({ entityId: ctx.stored.entity_id, subjectType: ctx.stored.entity?.type ?? v?.type });
        return res.mode === 'invalid' ? "We can't review this subject yet." : null;
      }
      if (!v) return 'Please choose what you are reviewing.';
      const res = resolveQuestionnaire({ entityId: v.id, subjectType: v.type });
      return res.mode === 'invalid' ? "We can't review this subject yet. Pick a different one." : null;
    },
    availability: simpleAvailability('subject'),
  },
  headline: {
    id: 'headline',
    label: 'Headline',
    hydrate: (r) => r.review?.subtitle ?? '',
    validate: () => null,
    availability: simpleAvailability('headline'),
  },
  text: {
    id: 'text',
    label: 'Your thoughts',
    hydrate: (r, mode) =>
      mode.endsWith('timeline-update') ? r.update?.comment ?? '' : r.review?.description ?? '',
    validate: (v, ctx) =>
      isRequired(ctx, 'text') && v.trim().length === 0 ? 'Please describe what changed.' : null,
    availability: simpleAvailability('text'),
  },
  media: {
    id: 'media',
    label: 'Photos and videos',
    hydrate: (r, mode) =>
      [...((mode.endsWith('timeline-update') ? r.update?.media : r.review?.media) ?? [])],
    validate: (v) => (v.length > MAX_MEDIA ? `You can add up to ${MAX_MEDIA} items.` : null),
    availability: simpleAvailability('media'),
  },
  experienceDate: {
    id: 'experienceDate',
    label: 'When was this?',
    hydrate: (r) => r.review?.experience_date ?? null,
    validate: () => null,
    availability: simpleAvailability('experienceDate'),
  },
  questionnaire: {
    id: 'questionnaire',
    label: 'Details',
    hydrate: (r) => {
      const review = r.review;
      if (!review) return { choices: {}, curated: {} };
      const res = resolveQuestionnaire({ entityId: review.entity_id, subjectType: review.entity?.type ?? null });
      if (res.mode === 'invalid') return { choices: {}, curated: {} };
      const read = readQuestionnaireEnvelope(review.metadata, review.category);
      return hydrateQuestionnaireAnswers(read, res.config);
    },
    validate: () => null,
    availability: (ctx) => {
      if (modeOff(ctx, 'questionnaire')) return 'mode-disabled';
      const q = getQuestionnaireContext(ctx);
      return q.writable && q.hasQuestions ? 'enabled' : 'subject-incompatible';
    },
  },
  foodTags: {
    id: 'foodTags',
    label: 'Food tags',
    hydrate: (r) => storedFoodTags(r.review?.metadata),
    validate: () => null,
    availability: (ctx) => {
      if (modeOff(ctx, 'foodTags')) return 'mode-disabled';
      return getQuestionnaireContext(ctx).hasFoodTags ? 'enabled' : 'subject-incompatible';
    },
  },
  visibility: {
    id: 'visibility',
    label: 'Who can see this?',
    hydrate: (r) => r.review?.visibility ?? 'public',
    validate: (v) => (REVIEW_VISIBILITIES.includes(v) ? null : 'Choose who can see this.'),
    availability: simpleAvailability('visibility'),
  },
  recommendation: {
    id: 'recommendation',
    label: 'Would you recommend it?',
    hydrate: (r) => {
      const w = r.update?.would_recommend ?? null;
      if (w === 'auto') return { baseOnRating: true, choice: null };
      if (w === 'yes' || w === 'maybe' || w === 'no') return { baseOnRating: false, choice: w };
      return { baseOnRating: false, choice: null };
    },
    validate: () => null,
    availability: simpleAvailability('recommendation'),
  },
};

export function sectionAvailability(id: SectionId, ctx: SectionContext) {
  return SECTIONS[id].availability(ctx);
}

/** Values hydrated from a record. Mode-disabled sections keep their empty default. */
export function hydrateValues(record: HydrationRecord, caps: ComposerCapabilities): ReviewComposerValues {
  const base = emptyComposerValues();
  const out = { ...base } as ReviewComposerValues;
  for (const id of Object.keys(SECTIONS) as SectionId[]) {
    if (caps.sections[id] === 'off') continue;
    assign(out, id, SECTIONS[id].hydrate(record, caps.mode));
  }
  return out;
}

export function validateSection(id: SectionId, ctx: SectionContext): string | null {
  return validateTyped(id, ctx);
}

function validateTyped<K extends SectionId>(id: K, ctx: SectionContext): string | null {
  const def = SECTIONS[id] as SectionDefinition<K>;
  return def.validate(ctx.values[id], ctx);
}

function assign<K extends SectionId>(target: ReviewComposerValues, id: K, value: SectionValueMap[K]) {
  target[id] = value;
}
