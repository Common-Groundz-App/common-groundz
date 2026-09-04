/**
 * Phase 3A — declarative questionnaire registry.
 *
 * Pure data. NO React, NO components, NO network. Every one of the 15 canonical
 * entity types has an EXPLICIT entry: there is no `default → product` and no
 * `→ others` fallback. A 16th canonical type is a compile error.
 *
 * Scope rules:
 * - Only TYPE-SPECIFIC questions live here. Common controls (rating, subject,
 *   media, headline, thoughts, experience date, visibility) are owned by the
 *   wizard shell and are deliberately absent from this registry.
 * - Identity is NOT a review answer. Subject name, provider/venue, author,
 *   director, brand etc. come from the entity and its hierarchy, never from a
 *   question here.
 * - Phase 3A adds NO new questions. The only type-specific field that exists
 *   today is the food tag set, declared as `kind: 'tags', tagSet: 'food'` and
 *   rendered by the existing `FoodTagSelector` (unchanged).
 */
import { CANONICAL_ENTITY_TYPES, type CanonicalEntityType } from '@/services/entityType';
import type { CuratedTagSet } from './vocabularies';

/**
 * Field kinds the registry may declare. The renderer implements the kinds that
 * are actually used: `tags` (curated vocabularies + the untouched food set) and
 * `single-choice` (chips). `text` / `textarea` / `select` / `multi-select` stay
 * declarable but unused — no unused form machinery is built ahead of a need.
 */
export type QuestionnaireFieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'single-choice'
  | 'tags';

/**
 * Curated tag vocabularies. `food` names the EXISTING `FoodTagSelector`
 * vocabulary (unchanged, exempt from the curated caps); every other set is
 * declared in `vocabularies.ts`.
 */
export type QuestionnaireTagSet = 'food' | CuratedTagSet;

export interface QuestionnaireOption {
  /** Stored code. Immutable once shipped. */
  value: string;
  label: string;
}

export interface QuestionnaireField {
  id: string;
  kind: QuestionnaireFieldKind;
  label: string;
  placeholder?: string;
  helperText?: string;
  required: boolean;
  /** Only for `single-choice` / `select` / `multi-select`. */
  options?: readonly QuestionnaireOption[];
  /** Only for `tags` — names a vocabulary, never a component. */
  tagSet?: QuestionnaireTagSet;
}

export interface QuestionnaireSectionConfig {
  id: string;
  title: string;
  description?: string;
  /** Emoji shown next to the section title (presentation only). */
  icon?: string;
  fields: readonly QuestionnaireField[];
}

export interface QuestionnaireConfig {
  /** Canonical type, or the named legacy-unlinked config. */
  key: CanonicalEntityType | 'legacy_unlinked';
  /** Human label for the thing being reviewed ("dish", "movie", ...). */
  subjectLabel: string;
  /** Whether Step 3 may offer the location permission prompt. */
  showLocationPrompt: boolean;
  sections: readonly QuestionnaireSectionConfig[];
}

/* ------------------------------------------------------------------ *
 * Frozen option sets (Phase 3B "Field IDs and stored values").
 * Stored codes are immutable; labels are presentation.
 * ------------------------------------------------------------------ */

const YES_MAYBE_NO: readonly QuestionnaireOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

const VALUE_OPTIONS: readonly QuestionnaireOption[] = [
  { value: 'poor', label: 'Not worth it' },
  { value: 'fair', label: 'Okay' },
  { value: 'good', label: 'Worth it' },
  { value: 'excellent', label: 'Great value' },
];

const WORTH_TIME_OPTIONS: readonly QuestionnaireOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'mostly', label: 'Mostly' },
  { value: 'no', label: 'No' },
];

const TRUST_OPTIONS: readonly QuestionnaireOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const SOLVES_PROBLEM_OPTIONS: readonly QuestionnaireOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
];

const PORTION_OPTIONS: readonly QuestionnaireOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'just_right', label: 'Just right' },
  { value: 'large', label: 'Large' },
];

const WOULD_RECOMMEND_FIELD: QuestionnaireField = {
  id: 'would_recommend',
  kind: 'single-choice',
  label: 'Would you recommend it?',
  helperText: 'This decides how your review is counted — your rating is only used if you skip it.',
  required: false,
  options: YES_MAYBE_NO,
};

const repeatIntentField = (label: string): QuestionnaireField => ({
  id: 'repeat_intent',
  kind: 'single-choice',
  label,
  required: false,
  options: YES_MAYBE_NO,
});

const extraChoiceField = (
  id: 'value' | 'worth_time' | 'trust' | 'solves_problem' | 'portion',
  label: string,
  options: readonly QuestionnaireOption[],
): QuestionnaireField => ({ id, kind: 'single-choice', label, required: false, options });

const VALUE_FIELD = extraChoiceField('value', 'Value for money', VALUE_OPTIONS);
const WORTH_TIME_FIELD = extraChoiceField('worth_time', 'Worth your time?', WORTH_TIME_OPTIONS);
const TRUST_FIELD = extraChoiceField('trust', 'How much would you trust them?', TRUST_OPTIONS);
const SOLVES_PROBLEM_FIELD = extraChoiceField(
  'solves_problem',
  'Does it solve your problem?',
  SOLVES_PROBLEM_OPTIONS,
);
const PORTION_FIELD = extraChoiceField('portion', 'Portion size', PORTION_OPTIONS);

const stoodOutField = (tagSet: CuratedTagSet): QuestionnaireField => ({
  id: 'stood_out',
  kind: 'tags',
  tagSet,
  label: 'What stood out?',
  helperText: 'Pick up to 5, or add your own.',
  required: false,
});

const bestForField = (tagSet: CuratedTagSet): QuestionnaireField => ({
  id: 'best_for',
  kind: 'tags',
  tagSet,
  label: 'Best for',
  helperText: 'Who would this suit? Pick up to 5, or add your own.',
  required: false,
});

const FOOD_TAGS_SECTION: QuestionnaireSectionConfig = {
  id: 'food_tags',
  title: 'Food tags',
  icon: '🏷️',
  fields: [
    {
      id: 'food_tags',
      kind: 'tags',
      tagSet: 'food',
      label: 'Food tags',
      required: false,
    },
  ],
};

/** Choice questions always come first, then the curated tag sections. */
const choiceSection = (fields: readonly QuestionnaireField[]): QuestionnaireSectionConfig => ({
  id: 'recommendation',
  title: 'Your verdict',
  icon: '🤔',
  fields,
});

const stoodOutSection = (tagSet: CuratedTagSet): QuestionnaireSectionConfig => ({
  id: 'stood_out',
  title: 'What stood out',
  icon: '✨',
  fields: [stoodOutField(tagSet)],
});

const bestForSection = (tagSet: CuratedTagSet): QuestionnaireSectionConfig => ({
  id: 'best_for',
  title: 'Best for',
  icon: '🎯',
  fields: [bestForField(tagSet)],
});

/**
 * All 15 canonical types, explicit — the frozen v1 matrix. Every type gets
 * `would_recommend` + `stood_out` (except `food`, whose Food Tags already are
 * its "what stood out"), its own repeat-intent wording (`course` has none) and
 * its extra dimension (`movie` and `others` have none).
 */
export const QUESTIONNAIRE_REGISTRY: Record<CanonicalEntityType, QuestionnaireConfig> = {
  movie: {
    key: 'movie',
    subjectLabel: 'movie',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Rewatch?')]),
      stoodOutSection('stood_out:movie'),
    ],
  },
  book: {
    key: 'book',
    subjectLabel: 'book',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Read again?'), WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:book'),
    ],
  },
  tv_show: {
    key: 'tv_show',
    subjectLabel: 'show',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Watch more?'), WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:tv_show'),
    ],
  },
  course: {
    key: 'course',
    subjectLabel: 'course',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:course'),
      bestForSection('best_for:course'),
    ],
  },
  app: {
    key: 'app',
    subjectLabel: 'app',
    showLocationPrompt: false,
    sections: [
      choiceSection([
        WOULD_RECOMMEND_FIELD,
        repeatIntentField('Keep using?'),
        SOLVES_PROBLEM_FIELD,
      ]),
      stoodOutSection('stood_out:app'),
    ],
  },
  game: {
    key: 'game',
    subjectLabel: 'game',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Play again?'), WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:game'),
    ],
  },
  experience: {
    key: 'experience',
    subjectLabel: 'experience',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Do again?'), WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:experience'),
    ],
  },
  food: {
    key: 'food',
    subjectLabel: 'dish',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Order again?'), PORTION_FIELD]),
      FOOD_TAGS_SECTION,
    ],
  },
  product: {
    key: 'product',
    subjectLabel: 'product',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Buy again?'), VALUE_FIELD]),
      stoodOutSection('stood_out:product'),
    ],
  },
  place: {
    key: 'place',
    subjectLabel: 'place',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Go back?')]),
      stoodOutSection('stood_out:place'),
      bestForSection('best_for:place'),
    ],
  },
  brand: {
    key: 'brand',
    subjectLabel: 'brand',
    showLocationPrompt: false,
    sections: [
      choiceSection([
        WOULD_RECOMMEND_FIELD,
        repeatIntentField('Buy from them again?'),
        TRUST_FIELD,
      ]),
      stoodOutSection('stood_out:brand'),
    ],
  },
  event: {
    key: 'event',
    subjectLabel: 'event',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Attend again?'), WORTH_TIME_FIELD]),
      stoodOutSection('stood_out:event'),
    ],
  },
  service: {
    key: 'service',
    subjectLabel: 'service',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Use again?'), VALUE_FIELD]),
      stoodOutSection('stood_out:service'),
    ],
  },
  professional: {
    key: 'professional',
    subjectLabel: 'professional',
    showLocationPrompt: false,
    sections: [
      choiceSection([
        WOULD_RECOMMEND_FIELD,
        repeatIntentField('Work with them again?'),
        TRUST_FIELD,
      ]),
      stoodOutSection('stood_out:professional'),
    ],
  },
  others: {
    key: 'others',
    subjectLabel: 'experience',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Choose again?')]),
      stoodOutSection('stood_out:others'),
    ],
  },
};

/**
 * Named config for LEGACY UNLINKED reviews only (no `entity_id`). It invents no
 * type-specific questions; it exists so those reviews can still be edited.
 */
export const LEGACY_UNLINKED_QUESTIONNAIRE: QuestionnaireConfig = {
  key: 'legacy_unlinked',
  subjectLabel: 'review',
  showLocationPrompt: false,
  sections: [],
};


/** Every canonical type has a config — asserted at module load in tests. */
export function getQuestionnaireConfig(type: CanonicalEntityType): QuestionnaireConfig {
  return QUESTIONNAIRE_REGISTRY[type];
}

export function questionnaireRegistryCoverage(): CanonicalEntityType[] {
  return CANONICAL_ENTITY_TYPES.filter((t) => !QUESTIONNAIRE_REGISTRY[t]);
}
