/**
 * Phase 3A — generic questionnaire renderer.
 *
 * Knows about FIELD KINDS, never about entity types. `kind: 'tags'` +
 * `tagSet: 'food'` routes to the existing `FoodTagSelector` (unchanged file,
 * unchanged curated vocabulary, unchanged `metadata.food_tags` contract).
 *
 * Deliberately small: only the kinds current behaviour exercises are
 * implemented. `select` / `multi-select` arrive with the approved Phase 3B
 * matrix in Phase 3C.
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FoodTagSelector from '@/components/profile/reviews/FoodTagSelector';
import ChoiceChips from './ChoiceChips';
import CuratedTagSelector from './CuratedTagSelector';
import type { CuratedTagAnswer } from './curatedTagInput';
import type { QuestionnaireConfig, QuestionnaireField } from './registry';

export interface QuestionnaireAnswers {
  /** Food tag values keyed by field id (`food_tags` only). Unchanged contract. */
  tags: Record<string, string[]>;
  /** Text values keyed by field id. */
  text: Record<string, string>;
  /** `single-choice` values keyed by field id. Absent === unanswered. */
  choices: Record<string, string>;
  /** Curated tag answers (`stood_out` / `best_for`) keyed by field id. */
  curated: Record<string, CuratedTagAnswer>;
}

export interface QuestionnaireSectionsProps {
  config: QuestionnaireConfig;
  answers: QuestionnaireAnswers;
  onAddTag: (fieldId: string, tag: string) => void;
  onRemoveTag: (fieldId: string, tag: string) => void;
  onTextChange: (fieldId: string, value: string) => void;
  onChoiceChange: (fieldId: string, value: string | undefined) => void;
  onCuratedChange: (fieldId: string, value: CuratedTagAnswer) => void;
}

const FieldRenderer: React.FC<{
  field: QuestionnaireField;
  answers: QuestionnaireAnswers;
  onAddTag: (fieldId: string, tag: string) => void;
  onRemoveTag: (fieldId: string, tag: string) => void;
  onTextChange: (fieldId: string, value: string) => void;
  onChoiceChange: (fieldId: string, value: string | undefined) => void;
  onCuratedChange: (fieldId: string, value: CuratedTagAnswer) => void;
}> = ({ field, answers, onAddTag, onRemoveTag, onTextChange, onChoiceChange, onCuratedChange }) => {
  switch (field.kind) {
    case 'tags': {
      if (!field.tagSet) return null;
      if (field.tagSet === 'food') {
        return (
          <FoodTagSelector
            selectedTags={answers.tags[field.id] ?? []}
            onAddTag={(tag) => onAddTag(field.id, tag)}
            onRemoveTag={(tag) => onRemoveTag(field.id, tag)}
          />
        );
      }
      return (
        <CuratedTagSelector
          tagSet={field.tagSet}
          label={field.label}
          helperText={field.helperText}
          value={answers.curated[field.id] ?? { selected: [], custom: [] }}
          onChange={(next) => onCuratedChange(field.id, next)}
        />
      );
    }
    case 'single-choice':
      return (
        <ChoiceChips
          fieldId={field.id}
          label={field.label}
          helperText={field.helperText}
          options={field.options ?? []}
          value={answers.choices[field.id]}
          onChange={(value) => onChoiceChange(field.id, value)}
        />
      );
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${field.id}`}>{field.label}</Label>
          <Input
            id={`q-${field.id}`}
            value={answers.text[field.id] ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onTextChange(field.id, e.target.value)}
            className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
          />
          {field.helperText && (
            <p className="text-xs text-muted-foreground">{field.helperText}</p>
          )}
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${field.id}`}>{field.label}</Label>
          <Textarea
            id={`q-${field.id}`}
            value={answers.text[field.id] ?? ''}
            placeholder={field.placeholder}
            rows={4}
            onChange={(e) => onTextChange(field.id, e.target.value)}
            className="border-brand-orange/30 focus-visible:ring-brand-orange/30 resize-none"
          />
          {field.helperText && (
            <p className="text-xs text-muted-foreground">{field.helperText}</p>
          )}
        </div>
      );
    default:
      // `select` / `multi-select` are declarable but not yet rendered (Phase 3C).
      return null;
  }
};

const QuestionnaireSections: React.FC<QuestionnaireSectionsProps> = ({
  config,
  answers,
  onAddTag,
  onRemoveTag,
  onTextChange,
  onChoiceChange,
  onCuratedChange,
}) => {
  if (config.sections.length === 0) return null;

  return (
    <>
      {config.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            {section.icon && <span className="text-lg">{section.icon}</span>}
            <span>{section.title}</span>
          </Label>
          {section.description && (
            <p className="text-xs text-muted-foreground">{section.description}</p>
          )}
          <div className="space-y-4">
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                answers={answers}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onTextChange={onTextChange}
                onChoiceChange={onChoiceChange}
                onCuratedChange={onCuratedChange}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default QuestionnaireSections;
