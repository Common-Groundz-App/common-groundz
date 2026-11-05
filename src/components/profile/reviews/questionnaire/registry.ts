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
  | 'tags'
  | 'attribute-ratings';

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
  /** Visually hide the field label when it repeats the section title (kept for screen readers). */
  hideLabel?: boolean;
  required: boolean;
  /** Only for `single-choice` / `select` / `multi-select`. */
  options?: readonly QuestionnaireOption[];
  /** Only for `tags` — names a vocabulary, never a component. */
  tagSet?: QuestionnaireTagSet;
  /** Only for `attribute-ratings` — optional 1–5 dimensions. IDs are immutable once shipped. */
  attributes?: readonly QuestionnaireAttribute[];
}

export interface QuestionnaireAttribute {
  /** Stored key inside `answers.attribute_ratings`. Immutable once shipped. */
  id: string;
  label: string;
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

export const WOULD_RECOMMEND_FIELD: QuestionnaireField = {
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


const bestForField = (tagSet: CuratedTagSet): QuestionnaireField => ({
  id: 'best_for',
  kind: 'tags',
  tagSet,
  label: 'Best for',
  helperText: 'Who or what would you recommend this for?',
  hideLabel: true,
  required: false,
});

const FOOD_TAGS_SECTION: QuestionnaireSectionConfig = {
  id: 'food_tags',
  title: 'How would you describe it?',
  icon: '🏷️',
  fields: [
    {
      id: 'food_tags',
      kind: 'tags',
      tagSet: 'food',
      label: 'How would you describe it?',
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

/**
 * Phase 4B.2 — two independent observation groups replace the mixed
 * `stood_out` question. Legacy `stood_out` answers are never rendered but
 * survive saves via the envelope's untouched-key passthrough.
 */
const observationField = (
  id: 'liked' | 'could_be_better',
  label: string,
  tagSet: CuratedTagSet,
): QuestionnaireField => ({
  id,
  kind: 'tags',
  tagSet,
  label,
  helperText: 'Pick up to 5, or add your own.',
  required: false,
});

const observationSections = (type: string): QuestionnaireSectionConfig[] => [
  {
    id: 'liked',
    title: 'What did you like?',
    icon: '👍',
    fields: [observationField('liked', 'What did you like?', `liked:${type}` as CuratedTagSet)],
  },
  {
    id: 'could_be_better',
    title: 'What could be better?',
    icon: '🛠️',
    fields: [
      observationField('could_be_better', 'What could be better?', `could_be_better:${type}` as CuratedTagSet),
    ],
  },
];

const bestForSection = (tagSet: CuratedTagSet): QuestionnaireSectionConfig => ({
  id: 'best_for',
  title: 'Best for',
  icon: '🎯',
  fields: [bestForField(tagSet)],
});

/* ------------------------------------------------------------------ *
 * Phase 6B — Experience Context. Factual, self-reported, neutral (never
 * evaluative). Stored flat under `answers[fieldId]`; codes are immutable.
 * Root Review only — the Timeline composer does not read this registry.
 * ------------------------------------------------------------------ */

const opts = (pairs: ReadonlyArray<[string, string]>): readonly QuestionnaireOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

const ctxField = (id: string, label: string, options: readonly QuestionnaireOption[]): QuestionnaireField => ({
  id,
  kind: 'single-choice',
  label,
  required: false,
  options,
});

const COUNT_OPTIONS = opts([
  ['first_time', '1st time'],
  ['second_time', '2nd time'],
  ['three_or_more', '3+ times'],
]);

/** Non-overlapping: [0,1) · [1,6) · [6,12) · [12,∞) months. */
export const USAGE_DURATION_OPTIONS = opts([
  ['under_1_month', 'Less than 1 month'],
  ['1_to_under_6_months', '1 to under 6 months'],
  ['6_to_under_12_months', '6 to under 12 months'],
  ['1_year_or_more', '1 year or more'],
]);

const USAGE_DURATION_FIELD = ctxField('usage_duration', 'How long have you used it?', USAGE_DURATION_OPTIONS);

const experienceSection = (fields: readonly QuestionnaireField[]): QuestionnaireSectionConfig => ({
  id: 'experience_context',
  title: 'Your experience',
  icon: '🧭',
  fields,
});

export const EXPERIENCE_CONTEXT_FIELDS: Record<CanonicalEntityType, readonly QuestionnaireField[]> = {
  movie: [ctxField('watch_count', 'Which viewing is this?', COUNT_OPTIONS)],
  tv_show: [
    ctxField('watch_count', 'Which viewing of this show is this?', COUNT_OPTIONS),
    ctxField('viewing_progress', 'Where are you with this show?', opts([
      ['just_started', 'Just started'],
      ['partway', 'Partway through'],
      ['caught_up', 'Caught up with released episodes'],
      ['finished_series', 'Finished the entire series'],
      ['stopped_watching', 'Stopped watching'],
    ])),
  ],
  book: [
    ctxField('reading_count', 'Which reading is this?', COUNT_OPTIONS),
    ctxField('reading_progress', 'Where are you with this book?', opts([
      ['just_started', 'Just started'],
      ['partway', 'Partway through'],
      ['finished', 'Finished it'],
      ['stopped_early', 'Stopped reading'],
    ])),
  ],
  game: [
    ctxField('game_familiarity', 'How familiar are you with this game?', opts([
      ['just_started', 'Just started'],
      ['played_before', 'Played before'],
      ['regular_player', 'Regular player'],
    ])),
    ctxField('play_progress', 'Where are you with this game?', opts([
      ['just_started', 'Just started'],
      ['in_progress', 'In progress'],
      ['completed', 'Completed (where applicable)'],
      ['stopped_early', 'Stopped early'],
    ])),
  ],
  course: [
    ctxField('course_progress', 'Where are you with this course?', opts([
      ['just_started', 'Just started'],
      ['in_progress', 'In progress'],
      ['completed', 'Completed it'],
      ['stopped_early', 'Stopped early'],
    ])),
  ],
  product: [USAGE_DURATION_FIELD],
  app: [USAGE_DURATION_FIELD],
  place: [ctxField('visit_familiarity', 'How familiar are you with this place?', opts([
    ['first_visit', 'First visit'],
    ['few_visits', 'Visited a few times'],
    ['regularly', 'Visit regularly'],
  ]))],
  food: [ctxField('dish_familiarity', 'How familiar are you with this dish?', opts([
    ['first_time', 'First time'],
    ['had_before', 'Had it before'],
    ['regularly', 'Have it regularly'],
  ]))],
  brand: [ctxField('brand_familiarity', 'How familiar are you with this brand?', opts([
    ['first_purchase', 'First purchase'],
    ['few_purchases', 'Bought a few times'],
    ['regular_customer', 'Regular customer'],
  ]))],
  event: [ctxField('event_familiarity', 'Have you attended this before?', opts([
    ['first_time', 'First time'],
    ['attended_before', 'Attended before'],
    ['regularly', 'Attend regularly'],
  ]))],
  experience: [ctxField('experience_familiarity', 'Have you done this before?', opts([
    ['first_time', 'First time'],
    ['done_before', 'Done it before'],
    ['multiple_times', 'Done it multiple times'],
  ]))],
  service: [ctxField('service_engagement', 'How often have you used this service?', opts([
    ['first_time', 'First time'],
    ['used_a_few_times', 'Used a few times'],
    ['ongoing_client', 'Ongoing client'],
  ]))],
  professional: [ctxField('professional_engagement', 'How have you worked with them?', opts([
    ['first_consultation', 'First consultation'],
    ['worked_together_before', 'Worked together before'],
    ['ongoing_client', 'Ongoing client'],
  ]))],
  others: [ctxField('other_familiarity', 'Have you experienced this before?', opts([
    ['first_time', 'First time'],
    ['experienced_before', 'Experienced before'],
    ['regularly', 'Experience it regularly'],
  ]))],
};

/* ------------------------------------------------------------------ *
 * Phase 7B — optional attribute ratings (integer 1–5 per attribute).
 * Stored at `answers.attribute_ratings` as `{ [attributeId]: number }`.
 * Attribute ids are interpreted in the context of the canonical type.
 * `others` intentionally has none.
 * ------------------------------------------------------------------ */

export const ATTRIBUTE_RATINGS_FIELD_ID = 'attribute_ratings';

const a = (id: string, label: string): QuestionnaireAttribute => ({ id, label });

export const ATTRIBUTE_RATINGS: Record<CanonicalEntityType, readonly QuestionnaireAttribute[]> = {
  movie: [a('story', 'Story'), a('acting', 'Acting'), a('visuals', 'Visuals'), a('pacing', 'Pacing')],
  tv_show: [a('story', 'Story'), a('acting', 'Acting'), a('visuals', 'Visuals'), a('pacing', 'Pacing')],
  book: [a('writing_style', 'Writing style'), a('depth', 'Depth'), a('pacing', 'Pacing')],
  food: [
    a('taste_flavor', 'Taste & flavor'),
    a('texture', 'Texture'),
    a('freshness', 'Freshness'),
    a('presentation', 'Presentation'),
  ],
  place: [a('atmosphere', 'Atmosphere'), a('cleanliness', 'Cleanliness'), a('service', 'Service')],
  product: [a('quality', 'Quality'), a('effectiveness', 'Effectiveness'), a('ease_of_use', 'Ease of use')],
  app: [a('ease_of_use', 'Ease of use'), a('reliability', 'Reliability'), a('design', 'Design')],
  game: [a('gameplay', 'Gameplay'), a('visuals', 'Visuals'), a('performance', 'Performance')],
  brand: [a('overall_quality', 'Overall quality'), a('customer_support', 'Customer support')],
  service: [a('quality_of_work', 'Quality of work'), a('communication', 'Communication'), a('reliability', 'Reliability')],
  professional: [a('expertise', 'Expertise'), a('communication', 'Communication'), a('professionalism', 'Professionalism')],
  event: [a('organization', 'Organization'), a('atmosphere', 'Atmosphere')],
  experience: [a('organization', 'Organization'), a('atmosphere', 'Atmosphere')],
  course: [a('content_quality', 'Content quality'), a('teaching', 'Teaching'), a('structure', 'Structure')],
  others: [],
};

/** Returns the section, or nothing for types without attributes (`others`). */
const attributeSection = (type: CanonicalEntityType): QuestionnaireSectionConfig[] => {
  const attributes = ATTRIBUTE_RATINGS[type];
  if (attributes.length === 0) return [];
  return [
    {
      id: 'attribute_ratings',
      title: 'Rate the details',
      icon: '🎯',
      description: 'Optional — rate only what matters to you.',
      fields: [
        {
          id: ATTRIBUTE_RATINGS_FIELD_ID,
          kind: 'attribute-ratings',
          label: 'Rate the details',
          hideLabel: true,
          required: false,
          attributes,
        },
      ],
    },
  ];
};

const ctx = (type: CanonicalEntityType) => experienceSection(EXPERIENCE_CONTEXT_FIELDS[type]);

/**
 * All 15 canonical types, explicit — the frozen v1 matrix. Every type gets
 * `would_recommend` + `liked` + `could_be_better` (`food` also keeps its separate Food Tags), its own repeat-intent wording (`course` has none) and
 * its extra dimension (`movie` and `others` have none).
 */
export const QUESTIONNAIRE_REGISTRY: Record<CanonicalEntityType, QuestionnaireConfig> = {
  movie: {
    key: 'movie',
    subjectLabel: 'movie',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you watch it again?')]),
      ctx('movie'),
      ...attributeSection('movie'),
      ...observationSections('movie'),
      bestForSection('best_for:movie'),
    ],
  },
  book: {
    key: 'book',
    subjectLabel: 'book',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you read it again?'), WORTH_TIME_FIELD]),
      ctx('book'),
      ...attributeSection('book'),
      ...observationSections('book'),
      bestForSection('best_for:book'),
    ],
  },
  tv_show: {
    key: 'tv_show',
    subjectLabel: 'show',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you keep watching?'), WORTH_TIME_FIELD]),
      ctx('tv_show'),
      ...attributeSection('tv_show'),
      ...observationSections('tv_show'),
      bestForSection('best_for:tv_show'),
    ],
  },
  course: {
    key: 'course',
    subjectLabel: 'course',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, WORTH_TIME_FIELD]),
      ctx('course'),
      ...attributeSection('course'),
      ...observationSections('course'),
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
        repeatIntentField('Would you keep using it?'),
        SOLVES_PROBLEM_FIELD,
      ]),
      ctx('app'),
      ...attributeSection('app'),
      ...observationSections('app'),
      bestForSection('best_for:app'),
    ],
  },
  game: {
    key: 'game',
    subjectLabel: 'game',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you play it again?'), WORTH_TIME_FIELD]),
      ctx('game'),
      ...attributeSection('game'),
      ...observationSections('game'),
      bestForSection('best_for:game'),
    ],
  },
  experience: {
    key: 'experience',
    subjectLabel: 'experience',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you do it again?'), WORTH_TIME_FIELD]),
      ctx('experience'),
      ...attributeSection('experience'),
      ...observationSections('experience'),
      bestForSection('best_for:experience'),
    ],
  },
  food: {
    key: 'food',
    subjectLabel: 'dish',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you order it again?'), PORTION_FIELD]),
      ctx('food'),
      ...attributeSection('food'),
      ...observationSections('food'),
      FOOD_TAGS_SECTION,
      bestForSection('best_for:food'),
    ],
  },
  product: {
    key: 'product',
    subjectLabel: 'product',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you buy it again?'), VALUE_FIELD]),
      ctx('product'),
      ...attributeSection('product'),
      ...observationSections('product'),
      bestForSection('best_for:product'),
    ],
  },
  place: {
    key: 'place',
    subjectLabel: 'place',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you visit again?')]),
      ctx('place'),
      ...attributeSection('place'),
      ...observationSections('place'),
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
        repeatIntentField('Would you buy from this brand again?'),
        TRUST_FIELD,
      ]),
      ctx('brand'),
      ...attributeSection('brand'),
      ...observationSections('brand'),
      bestForSection('best_for:brand'),
    ],
  },
  event: {
    key: 'event',
    subjectLabel: 'event',
    showLocationPrompt: true,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you attend again?'), WORTH_TIME_FIELD]),
      ctx('event'),
      ...attributeSection('event'),
      ...observationSections('event'),
      bestForSection('best_for:event'),
    ],
  },
  service: {
    key: 'service',
    subjectLabel: 'service',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Would you use this service again?'), VALUE_FIELD]),
      ctx('service'),
      ...attributeSection('service'),
      ...observationSections('service'),
      bestForSection('best_for:service'),
    ],
  },
  professional: {
    key: 'professional',
    subjectLabel: 'professional',
    showLocationPrompt: false,
    sections: [
      choiceSection([
        WOULD_RECOMMEND_FIELD,
        repeatIntentField('Would you work with them again?'),
        TRUST_FIELD,
      ]),
      ctx('professional'),
      ...attributeSection('professional'),
      ...observationSections('professional'),
      bestForSection('best_for:professional'),
    ],
  },
  others: {
    key: 'others',
    subjectLabel: 'experience',
    showLocationPrompt: false,
    sections: [
      choiceSection([WOULD_RECOMMEND_FIELD, repeatIntentField('Choose again?')]),
      ctx('others'),
      ...attributeSection('others'),
      ...observationSections('others'),
      bestForSection('best_for:others'),
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
