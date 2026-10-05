/**
 * The ONLY place that turns composer values into database payloads.
 *
 * Every builder constructs its payload from named fields (a runtime allowlist).
 * None starts from the form state or a loaded record and deletes keys after —
 * so identity, author and status fields can never leak into an edit.
 *
 * Cross-field rules owned here:
 *  - first media item → `image_url` (no upload → null; entity images never);
 *  - persisted subject → title / venue / category (create only);
 *  - metadata merged onto what is stored (never replaced);
 *  - omitted vs explicit values (timeline rating / recommendation);
 *  - recommendation `'auto'` vs no statement (null).
 */
import type { MediaItem } from '@/types/media';
import { buildReviewMetadataForSave } from '@/components/profile/reviews/questionnaire/saveMetadata';
import { readQuestionnaireEnvelope } from '@/components/profile/reviews/questionnaire/envelope';
import { resolveReviewIdentity } from '@/components/profile/reviews/questionnaire/identityPersistence';
import { parseEntityTypeAtBoundary } from '@/services/entityType';
import { toTimelineRecommendationValue, type WouldRecommendValue } from '@/services/review/timeline';
import { MODES } from './modes';
import { getQuestionnaireContext, sectionAvailability, type SectionContext } from './sections';
import type { ReviewComposerValues, ReviewVisibility, StoredReviewRecord } from './values';

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; reason: 'subject_invalid' | 'not_loaded' };

export interface CreateReviewPayload {
  user_id: string;
  entity_id: string;
  category: string;
  title: string;
  venue: string;
  subtitle: string;
  description: string;
  rating: number;
  image_url: string | null;
  media: MediaItem[];
  visibility: ReviewVisibility;
  experience_date: string | null;
  metadata: Record<string, unknown> | undefined;
}

/** Second, type-level guard on top of the runtime allowlist. */
export type EditReviewPayload = Omit<
  {
    subtitle: string;
    description: string;
    rating: number;
    image_url: string | null;
    media: MediaItem[];
    visibility: ReviewVisibility;
    experience_date: string | null;
    metadata: Record<string, unknown> | undefined;
  },
  'user_id' | 'entity_id' | 'category' | 'title' | 'venue' | 'status'
>;

export interface CreateTimelinePayload {
  review_id: string;
  comment: string;
  media: MediaItem[];
  rating?: number;
  would_recommend?: Exclude<WouldRecommendValue, null>;
}

export interface EditTimelinePayload {
  review_id: string;
  update_id: string;
  rating: number | null;
  comment: string;
  media: MediaItem[];
  would_recommend: WouldRecommendValue;
}

const coverImage = (media: MediaItem[]): string | null => media[0]?.url ?? null;
const copyMedia = (media: MediaItem[]): MediaItem[] => media.map((m) => ({ ...m }));

function metadataFor(
  ctx: SectionContext,
  storedMetadata: unknown,
  storedCategory: string | null,
  questionnaireTouched: ReadonlySet<string>,
) {
  const q = getQuestionnaireContext(ctx);
  if (!q.resolution || q.resolution.mode === 'invalid' || !q.category) return null;
  const qEnabled = sectionAvailability('questionnaire', ctx) === 'enabled';
  const foodEnabled = sectionAvailability('foodTags', ctx) === 'enabled';
  const read = readQuestionnaireEnvelope(storedMetadata, storedCategory ?? q.category);
  return buildReviewMetadataForSave({
    storedMetadata,
    config: q.resolution.config,
    category: q.category,
    questionnaireWritable: qEnabled && q.writable,
    effectiveEnvelope: read,
    storedEnvelope: read,
    choices: { ...ctx.values.questionnaire.choices },
    curated: { ...ctx.values.questionnaire.curated },
    touchedFieldIds: qEnabled ? questionnaireTouched : new Set<string>(),
    foodTags: foodEnabled ? [...ctx.values.foodTags] : [],
    questionnaireReset: false,
  }).metadata;
}

export function buildCreateReviewPayload(input: {
  values: ReviewComposerValues;
  userId: string;
  subjectOrigin: 'entity-page' | 'user-selected';
  questionnaireTouched: ReadonlySet<string>;
}): BuildResult<CreateReviewPayload> {
  const { values, userId, subjectOrigin, questionnaireTouched } = input;
  const subject = values.subject;
  if (!subject) return { ok: false, reason: 'subject_invalid' };
  const ctx: SectionContext = { caps: MODES['create-review'], values, stored: null, subjectOrigin };
  const q = getQuestionnaireContext(ctx);
  if (!q.category || q.resolution?.mode !== 'canonical') return { ok: false, reason: 'subject_invalid' };
  const identity = resolveReviewIdentity({
    subjectOrigin,
    subject: {
      name: subject.name,
      type: parseEntityTypeAtBoundary(subject.type),
      venue: subject.venue ?? null,
      metadata: subject.metadata ?? null,
    },
    providerName: subject.providerName ?? null,
    isLegacyUnlinked: false,
  });
  const metadata = metadataFor(ctx, undefined, null, questionnaireTouched);
  return {
    ok: true,
    payload: {
      user_id: userId,
      entity_id: subject.id,
      category: q.category,
      title: identity.title,
      venue: identity.venue,
      subtitle: values.headline,
      description: values.text,
      rating: values.rating ?? 0,
      image_url: coverImage(values.media),
      media: copyMedia(values.media),
      visibility: values.visibility,
      experience_date: values.experienceDate,
      metadata: metadata ?? undefined,
    },
  };
}

export function buildEditReviewPayload(input: {
  values: ReviewComposerValues;
  stored: StoredReviewRecord | null;
  questionnaireTouched: ReadonlySet<string>;
}): BuildResult<EditReviewPayload> {
  const { values, stored, questionnaireTouched } = input;
  if (!stored) return { ok: false, reason: 'not_loaded' };
  const ctx: SectionContext = { caps: MODES['edit-review'], values, stored, subjectOrigin: stored.entity_id ? 'loaded' : 'none' };
  const q = getQuestionnaireContext(ctx);
  if (q.resolution?.mode === 'invalid') return { ok: false, reason: 'subject_invalid' };
  const metadata = q.category
    ? metadataFor(ctx, stored.metadata, stored.category, questionnaireTouched)
    : undefined;
  return {
    ok: true,
    payload: {
      subtitle: values.headline,
      description: values.text,
      rating: values.rating ?? 0,
      image_url: coverImage(values.media),
      media: copyMedia(values.media),
      visibility: values.visibility,
      experience_date: values.experienceDate,
      metadata: metadata ?? undefined,
    },
  };
}

export function buildCreateTimelinePayload(input: {
  values: ReviewComposerValues;
  reviewId: string;
}): BuildResult<CreateTimelinePayload> {
  const { values, reviewId } = input;
  const payload: CreateTimelinePayload = {
    review_id: reviewId,
    comment: values.text.trim(),
    media: copyMedia(values.media),
  };
  if (values.rating !== null && values.rating > 0) payload.rating = values.rating;
  const { baseOnRating, choice } = values.recommendation;
  if (baseOnRating) payload.would_recommend = 'auto';
  else if (choice) payload.would_recommend = choice;
  return { ok: true, payload };
}

export function buildEditTimelinePayload(input: {
  values: ReviewComposerValues;
  reviewId: string;
  updateId: string;
}): BuildResult<EditTimelinePayload> {
  const { values, reviewId, updateId } = input;
  return {
    ok: true,
    payload: {
      review_id: reviewId,
      update_id: updateId,
      rating: values.rating !== null && values.rating > 0 ? values.rating : null,
      comment: values.text.trim(),
      media: copyMedia(values.media),
      would_recommend: toTimelineRecommendationValue(
        values.recommendation.baseOnRating,
        values.recommendation.choice,
      ),
    },
  };
}
