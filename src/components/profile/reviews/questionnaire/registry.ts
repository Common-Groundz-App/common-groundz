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

/**
 * Field kinds the registry may declare. Declared broadly on purpose so the
 * Phase 3B matrix does not need a schema change — but the renderer only
 * implements the kinds actually used today (`tags`, plus the `text`/`textarea`
 * primitives). `select` / `multi-select` land in Phase 3C with the approved
 * matrix; no unused form machinery is built ahead of it.
 */
export type QuestionnaireFieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'tags';

/** Curated tag vocabularies. `food` is the only one that exists today. */
export type QuestionnaireTagSet = 'food';

export interface QuestionnaireField {
  id: string;
  kind: QuestionnaireFieldKind;
  label: string;
  placeholder?: string;
  helperText?: string;
  required: boolean;
  /** Only for `select` / `multi-select`. */
  options?: readonly string[];
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

/**
 * All 15 canonical types, explicit. `sections: []` means "no type-specific
 * questions yet" — an honest empty config, not a fallback to another type.
 */
export const QUESTIONNAIRE_REGISTRY: Record<CanonicalEntityType, QuestionnaireConfig> = {
  movie: { key: 'movie', subjectLabel: 'movie', showLocationPrompt: false, sections: [] },
  book: { key: 'book', subjectLabel: 'book', showLocationPrompt: false, sections: [] },
  tv_show: { key: 'tv_show', subjectLabel: 'show', showLocationPrompt: false, sections: [] },
  course: { key: 'course', subjectLabel: 'course', showLocationPrompt: false, sections: [] },
  app: { key: 'app', subjectLabel: 'app', showLocationPrompt: false, sections: [] },
  game: { key: 'game', subjectLabel: 'game', showLocationPrompt: false, sections: [] },
  experience: {
    key: 'experience',
    subjectLabel: 'experience',
    showLocationPrompt: true,
    sections: [],
  },
  food: {
    key: 'food',
    subjectLabel: 'dish',
    showLocationPrompt: true,
    sections: [FOOD_TAGS_SECTION],
  },
  product: { key: 'product', subjectLabel: 'product', showLocationPrompt: false, sections: [] },
  place: { key: 'place', subjectLabel: 'place', showLocationPrompt: true, sections: [] },
  brand: { key: 'brand', subjectLabel: 'brand', showLocationPrompt: false, sections: [] },
  event: { key: 'event', subjectLabel: 'event', showLocationPrompt: true, sections: [] },
  service: { key: 'service', subjectLabel: 'service', showLocationPrompt: false, sections: [] },
  professional: {
    key: 'professional',
    subjectLabel: 'professional',
    showLocationPrompt: false,
    sections: [],
  },
  others: { key: 'others', subjectLabel: 'experience', showLocationPrompt: false, sections: [] },
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
