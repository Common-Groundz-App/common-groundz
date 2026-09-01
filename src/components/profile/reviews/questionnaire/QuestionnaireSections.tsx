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
import type { QuestionnaireConfig, QuestionnaireField } from './registry';

export interface QuestionnaireAnswers {
  /** Tag values keyed by field id (today: `food_tags`). */
  tags: Record<string, string[]>;
  /** Text values keyed by field id. */
  text: Record<string, string>;
}

export interface QuestionnaireSectionsProps {
  config: QuestionnaireConfig;
  answers: QuestionnaireAnswers;
  onAddTag: (fieldId: string, tag: string) => void;
  onRemoveTag: (fieldId: string, tag: string) => void;
  onTextChange: (fieldId: string, value: string) => void;
}

const FieldRenderer: React.FC<{
  field: QuestionnaireField;
  answers: QuestionnaireAnswers;
  onAddTag: (fieldId: string, tag: string) => void;
  onRemoveTag: (fieldId: string, tag: string) => void;
  onTextChange: (fieldId: string, value: string) => void;
}> = ({ field, answers, onAddTag, onRemoveTag, onTextChange }) => {
  switch (field.kind) {
    case 'tags': {
      if (field.tagSet !== 'food') return null;
      return (
        <FoodTagSelector
          selectedTags={answers.tags[field.id] ?? []}
          onAddTag={(tag) => onAddTag(field.id, tag)}
          onRemoveTag={(tag) => onRemoveTag(field.id, tag)}
        />
      );
    }
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
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default QuestionnaireSections;
