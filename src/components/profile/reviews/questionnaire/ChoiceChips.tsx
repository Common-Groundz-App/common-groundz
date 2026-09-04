/**
 * Phase 3C Stage 2 — `single-choice` renderer.
 *
 * Nothing is preselected: "unanswered" and "answered" stay distinct. Re-tapping
 * the selected option clears it back to unanswered.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import type { QuestionnaireOption } from './registry';

interface ChoiceChipsProps {
  fieldId: string;
  label: string;
  helperText?: string;
  options: readonly QuestionnaireOption[];
  /** `undefined` means unanswered — never a default. */
  value?: string;
  onChange: (value: string | undefined) => void;
}

const ChoiceChips: React.FC<ChoiceChipsProps> = ({
  fieldId,
  label,
  helperText,
  options,
  value,
  onChange,
}) => (
  <div className="space-y-2">
    <p className="text-sm font-medium" id={`q-${fieldId}-label`}>
      {label}
    </p>
    <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`q-${fieldId}-label`}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(isSelected ? undefined : option.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              isSelected
                ? 'border-brand-orange bg-brand-orange/10 text-brand-orange font-medium'
                : 'border-border text-muted-foreground hover:border-brand-orange/40 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
    {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
  </div>
);

export default ChoiceChips;
