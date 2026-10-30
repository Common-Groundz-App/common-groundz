/**
 * Phase 4B.1 — shared, presentational tag selector.
 *
 * Layout: "Selected tags" (only when something is selected; suggestions and
 * custom entries together, each removable) → suggestion pills → custom input.
 * Holds no answer state: callers (adapters) own the data model and rules. The
 * only local state is the custom-tag draft, which survives chip interactions
 * and collapsing (the details panel stays mounted).
 */
import React, { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UnifiedTagSuggestion {
  /** Stable identity (stored code). */
  id: string;
  label: string;
  emoji?: string;
}

export interface UnifiedSelectedTag {
  /** Unique key within the selected list. */
  key: string;
  label: string;
  emoji?: string;
}

export interface UnifiedTagSelectorProps {
  label: string;
  helperText?: string;
  suggestions: readonly UnifiedTagSuggestion[];
  selectedSuggestionIds: readonly string[];
  selectedTags: readonly UnifiedSelectedTag[];
  onToggleSuggestion: (id: string) => void;
  onRemoveSelected: (key: string) => void;
  /** Return true when the draft was accepted (the input is then cleared). */
  onSubmitCustom: (draft: string) => boolean;
  /** No new selections or custom entries; removal stays available. */
  atLimit: boolean;
  limitPlaceholder?: string;
  /** Custom input only (e.g. a lower custom cap). Defaults to `atLimit`. */
  customDisabled?: boolean;
  maxCustomLength?: number;
  hint?: string | null;
}

const UnifiedTagSelector: React.FC<UnifiedTagSelectorProps> = ({
  label,
  helperText,
  suggestions,
  selectedSuggestionIds,
  selectedTags,
  onToggleSuggestion,
  onRemoveSelected,
  onSubmitCustom,
  atLimit,
  limitPlaceholder = 'Limit reached. Remove one to add more.',
  customDisabled,
  maxCustomLength,
  hint,
}) => {
  const [draft, setDraft] = useState('');
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const helpId = `${baseId}-help`;

  const inputBlocked = customDisabled ?? atLimit;
  const submit = () => {
    if (inputBlocked) return;
    if (onSubmitCustom(draft)) setDraft('');
  };

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-sm font-medium">{label}</p>

      {selectedTags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Selected tags</p>
          <ul className="flex flex-wrap gap-2" aria-label={`Selected tags for ${label}`}>
            {selectedTags.map((tag) => (
              <li
                key={tag.key}
                className="inline-flex items-center gap-1 rounded-full border border-brand-orange bg-brand-orange/10 py-1.5 pl-3 pr-2 text-sm font-medium text-brand-orange"
              >
                {tag.emoji && <span aria-hidden="true">{tag.emoji}</span>}
                <span>{tag.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tag.label}`}
                  onClick={() => onRemoveSelected(tag.key)}
                  className="ml-0.5 rounded-full p-0.5 text-brand-orange/80 hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((tag) => {
            const isSelected = selectedSuggestionIds.includes(tag.id);
            const blocked = !isSelected && atLimit;
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={isSelected}
                disabled={blocked}
                onClick={() => onToggleSuggestion(tag.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  isSelected
                    ? 'border-brand-orange bg-brand-orange/10 text-brand-orange font-medium'
                    : 'border-border text-muted-foreground hover:border-brand-orange/40 hover:text-foreground',
                  blocked && 'cursor-not-allowed opacity-50 hover:border-border hover:text-muted-foreground',
                )}
              >
                {tag.emoji && <span className="mr-1" aria-hidden="true">{tag.emoji}</span>}
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={maxCustomLength}
          disabled={inputBlocked}
          aria-label={`Add your own tag for ${label}`}
          aria-describedby={hint || helperText ? helpId : undefined}
          placeholder={inputBlocked ? limitPlaceholder : 'Add your own…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Never submit the surrounding review form.
              e.preventDefault();
              submit();
            }
          }}
          className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={inputBlocked}
          onClick={submit}
          aria-label="Add tag"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {hint ? (
        <p id={helpId} role="status" className="text-xs text-destructive">{hint}</p>
      ) : (
        helperText && <p id={helpId} className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
};

export default UnifiedTagSelector;
