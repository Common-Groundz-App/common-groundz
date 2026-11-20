/**
 * Phase 10B Step 1 — reader-side adapter: stored review metadata → display model.
 *
 * Pure, no React. The active questionnaire registry is the only source of
 * labels; stored codes are never guessed from field names. Values the
 * registry does not declare for this canonical type are not shown. Missing,
 * legacy (`stood_out`) and malformed values are skipped, never thrown on.
 * Read-only: nothing here writes or normalizes stored data.
 */
import { parseEntityType } from '@/services/entityType';
import { getQuestionnaireConfig, type QuestionnaireField } from './registry';
import { readQuestionnaireEnvelope, hydrateQuestionnaireAnswers } from './envelope';
import { findCuratedTag, type CuratedTagSet } from './vocabularies';
import { humanizeTagId } from './curatedTagInput';
import { isPlainMetadataObject } from './metadata';

export type RecommendationValue = 'yes' | 'maybe' | 'no';

export interface ReaderChoice {
  fieldId: string;
  /** Registry question label, e.g. "Would you watch it again?". */
  question: string;
  value: string;
  /** Registry option label for the stored code. */
  answer: string;
}

export interface ReaderTag {
  key: string;
  label: string;
  emoji?: string;
  custom: boolean;
}

export interface ReaderTagGroup {
  fieldId: string;
  title: string;
  icon?: string;
  tags: ReaderTag[];
}

export interface ReaderAttributeRating {
  id: string;
  label: string;
  value: number;
}

export interface ReviewReaderDetails {
  recommendation: RecommendationValue | null;
  repeatIntent: ReaderChoice | null;
  /** Other verdict choices (value, worth_time, trust, solves_problem, portion). */
  verdictChoices: ReaderChoice[];
  experienceContext: ReaderChoice[];
  attributeRatings: ReaderAttributeRating[];
  tagGroups: ReaderTagGroup[];
  isEmpty: boolean;
}

const EMPTY: ReviewReaderDetails = {
  recommendation: null,
  repeatIntent: null,
  verdictChoices: [],
  experienceContext: [],
  attributeRatings: [],
  tagGroups: [],
  isEmpty: true,
};

function choiceFor(field: QuestionnaireField, value: string | undefined): ReaderChoice | null {
  if (!value) return null;
  const option = field.options?.find((o) => o.value === value);
  return option ? { fieldId: field.id, question: field.label, value, answer: option.label } : null;
}

function readFoodTags(metadata: Record<string, unknown>): ReaderTag[] {
  const raw = metadata.food_tags;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReaderTag[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const label = v.trim();
    const k = label.toLowerCase();
    if (!label || seen.has(k)) continue;
    seen.add(k);
    out.push({ key: `food:${k}`, label, custom: false });
  }
  return out;
}

export function resolveReviewReaderDetails(
  metadata: unknown,
  category: string | null | undefined,
): ReviewReaderDetails {
  const type = parseEntityType(category);
  if (!type || !isPlainMetadataObject(metadata)) return EMPTY;
  const config = getQuestionnaireConfig(type);
  const hydrated = hydrateQuestionnaireAnswers(readQuestionnaireEnvelope(metadata, type), config);

  const details: ReviewReaderDetails = { ...EMPTY, verdictChoices: [], experienceContext: [], attributeRatings: [], tagGroups: [] };

  for (const section of config.sections) {
    for (const field of section.fields) {
      if (field.kind === 'single-choice') {
        const c = choiceFor(field, hydrated.choices[field.id]);
        if (!c) continue;
        if (field.id === 'would_recommend') details.recommendation = c.value as RecommendationValue;
        else if (field.id === 'repeat_intent') details.repeatIntent = c;
        else if (section.id === 'experience_context') details.experienceContext.push(c);
        else details.verdictChoices.push(c);
      } else if (field.kind === 'attribute-ratings') {
        for (const attr of field.attributes ?? []) {
          const raw = hydrated.choices[`${field.id}:${attr.id}`];
          if (raw) details.attributeRatings.push({ id: attr.id, label: attr.label, value: Number(raw) });
        }
      } else if (field.kind === 'tags' && field.tagSet === 'food') {
        const tags = readFoodTags(metadata);
        if (tags.length) details.tagGroups.push({ fieldId: field.id, title: section.title, icon: section.icon, tags });
      } else if (field.kind === 'tags' && field.tagSet) {
        const answer = hydrated.curated[field.id];
        if (!answer) continue;
        const tagSet = field.tagSet as CuratedTagSet;
        const tags: ReaderTag[] = [
          ...answer.selected.map((id) => {
            const t = findCuratedTag(tagSet, id);
            return { key: `c:${id}`, label: t?.label ?? humanizeTagId(id), emoji: t?.emoji, custom: false };
          }),
          ...answer.custom.map((label, i) => ({ key: `u:${i}:${label}`, label, custom: true })),
        ];
        if (tags.length) details.tagGroups.push({ fieldId: field.id, title: section.title, icon: section.icon, tags });
      }
    }
  }

  details.isEmpty =
    !details.recommendation &&
    !details.repeatIntent &&
    details.verdictChoices.length === 0 &&
    details.experienceContext.length === 0 &&
    details.attributeRatings.length === 0 &&
    details.tagGroups.length === 0;
  return details;
}
