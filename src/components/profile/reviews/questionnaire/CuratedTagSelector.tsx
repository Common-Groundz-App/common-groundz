/**
 * Curated tag picker for `stood_out` / `best_for` — questionnaire adapter.
 *
 * Phase 4B.1: presentation is delegated to the shared `UnifiedTagSelector`.
 * This adapter owns the `{ selected, custom }` answer shape and routes every
 * mutation through `curatedTagInput.ts` with the field's own caps
 * (`getCuratedTagLimits`). `FoodTagSelector` is untouched and exempt.
 */
import React, { useState } from 'react';
import UnifiedTagSelector, { type UnifiedSelectedTag } from './UnifiedTagSelector';
import {
  addCustomTag,
  isAtCombinedCap,
  isAtCustomCap,
  rejectionMessage,
  removeCustomTag,
  toggleCuratedTag,
  type CuratedTagAnswer,
  type CuratedTagMutation,
} from './curatedTagInput';
import { getCuratedTagLimits, getCuratedVocabulary, type CuratedTagSet } from './vocabularies';

interface CuratedTagSelectorProps {
  tagSet: CuratedTagSet;
  label: string;
  helperText?: string;
  value: CuratedTagAnswer;
  onChange: (next: CuratedTagAnswer) => void;
}

const CURATED_PREFIX = 'curated:';
const CUSTOM_PREFIX = 'custom:';

const CuratedTagSelector: React.FC<CuratedTagSelectorProps> = ({
  tagSet,
  label,
  helperText,
  value,
  onChange,
}) => {
  const [hint, setHint] = useState<string | null>(null);

  const vocabulary = getCuratedVocabulary(tagSet);
  const limits = getCuratedTagLimits(tagSet);
  const atCombined = isAtCombinedCap(value, limits);
  const atCustom = isAtCustomCap(value, limits);

  const apply = (result: CuratedTagMutation): boolean => {
    if (result.changed) {
      setHint(null);
      onChange(result.answer);
      return true;
    }
    if (result.rejection) setHint(rejectionMessage(result.rejection, limits));
    return false;
  };

  // Selected curated tags (known codes only — unknown stored codes are kept in
  // the answer untouched, never relabeled), then custom entries.
  const selectedTags: UnifiedSelectedTag[] = [
    ...value.selected.flatMap((code) => {
      const tag = vocabulary.find((t) => t.value === code);
      return tag ? [{ key: `${CURATED_PREFIX}${code}`, label: tag.label, emoji: tag.emoji }] : [];
    }),
    ...value.custom.map((text) => ({ key: `${CUSTOM_PREFIX}${text}`, label: text })),
  ];

  return (
    <UnifiedTagSelector
      label={label}
      helperText={helperText}
      suggestions={vocabulary.map((t) => ({ id: t.value, label: t.label, emoji: t.emoji }))}
      selectedSuggestionIds={value.selected}
      selectedTags={selectedTags}
      onToggleSuggestion={(id) => apply(toggleCuratedTag(value, id, limits))}
      onRemoveSelected={(key) => {
        if (key.startsWith(CURATED_PREFIX)) {
          apply(toggleCuratedTag(value, key.slice(CURATED_PREFIX.length), limits));
        } else if (key.startsWith(CUSTOM_PREFIX)) {
          apply(removeCustomTag(value, key.slice(CUSTOM_PREFIX.length)));
        }
      }}
      onSubmitCustom={(draft) => apply(addCustomTag(value, draft, limits, vocabulary))}
      atLimit={atCombined}
      customDisabled={atCombined || atCustom}
      limitPlaceholder={
        atCombined
          ? `Limit reached (${limits.maxCombined}/${limits.maxCombined}). Remove one to add more.`
          : `Up to ${limits.maxCustom} of your own. Remove one to add more.`
      }
      maxCustomLength={limits.maxCustomLength}
      hint={hint}
    />
  );
};

export default CuratedTagSelector;
