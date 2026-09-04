/**
 * Phase 3C Stage 2 — curated tag picker for `stood_out` / `best_for`.
 *
 * All rules live in `curatedTagInput.ts`; this file is presentation plus the
 * custom-tag input. `FoodTagSelector` is NOT rewritten as a wrapper in this
 * stage — it stays regression-identical and exempt from these caps.
 */
import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  addCustomTag,
  isAtCombinedCap,
  isAtCustomCap,
  rejectionMessage,
  removeCustomTag,
  toggleCuratedTag,
  type CuratedTagAnswer,
} from './curatedTagInput';
import { CURATED_TAG_LIMITS, getCuratedVocabulary, type CuratedTagSet } from './vocabularies';

interface CuratedTagSelectorProps {
  tagSet: CuratedTagSet;
  label: string;
  helperText?: string;
  value: CuratedTagAnswer;
  onChange: (next: CuratedTagAnswer) => void;
}

const CuratedTagSelector: React.FC<CuratedTagSelectorProps> = ({
  tagSet,
  label,
  helperText,
  value,
  onChange,
}) => {
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const vocabulary = getCuratedVocabulary(tagSet);
  const atCombined = isAtCombinedCap(value);
  const atCustom = isAtCustomCap(value);

  const apply = (result: ReturnType<typeof toggleCuratedTag>) => {
    if (result.changed) {
      setHint(null);
      onChange(result.answer);
    } else if (result.rejection) {
      setHint(rejectionMessage(result.rejection));
    }
  };

  const submitCustom = () => {
    const result = addCustomTag(value, draft);
    if (result.changed) setDraft('');
    apply(result);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      <div className="flex flex-wrap gap-2">
        {vocabulary.map((tag) => {
          const isSelected = value.selected.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => apply(toggleCuratedTag(value, tag.value))}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                isSelected
                  ? 'border-brand-orange bg-brand-orange/10 text-brand-orange font-medium'
                  : 'border-border text-muted-foreground hover:border-brand-orange/40 hover:text-foreground',
                !isSelected && atCombined && 'opacity-50',
              )}
            >
              <span className="mr-1">{tag.emoji}</span>
              {tag.label}
            </button>
          );
        })}
      </div>

      {value.custom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.custom.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-brand-orange/40 bg-brand-orange/5 px-3 py-1.5 text-sm"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => apply(removeCustomTag(value, tag))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={CURATED_TAG_LIMITS.maxCustomLength}
          disabled={atCombined || atCustom}
          placeholder={
            atCombined || atCustom ? 'Remove one to add your own' : 'Add your own…'
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitCustom();
            }
          }}
          className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={atCombined || atCustom}
          onClick={submitCustom}
          aria-label="Add tag"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {hint ? (
        <p className="text-xs text-destructive">{hint}</p>
      ) : (
        helperText && <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};

export default CuratedTagSelector;
