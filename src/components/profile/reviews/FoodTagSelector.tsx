/**
 * Food descriptor picker ("How would you describe it?") — Phase 4B.3C.
 *
 * Thin adapter over the shared `UnifiedTagSelector`. Owns the flat
 * `metadata.food_tags: string[]` contract: curated picks are stored by their
 * label (e.g. "Spicy"), custom entries as typed. Max 5 total, all may be
 * custom, 40 chars per custom tag, case-insensitive duplicate prevention.
 */
import React, { useState } from 'react';
import UnifiedTagSelector, { type UnifiedSelectedTag } from './questionnaire/UnifiedTagSelector';

export const FOOD_DESCRIPTOR_TAGS = [
  { name: 'Spicy', emoji: '🌶️' },
  { name: 'Sweet', emoji: '🍬' },
  { name: 'Savory', emoji: '🧂' },
  { name: 'Tangy', emoji: '🍋' },
  { name: 'Creamy', emoji: '🧈' },
  { name: 'Crunchy', emoji: '🥨' },
  { name: 'Rich', emoji: '🍜' },
  { name: 'Light', emoji: '🥗' },
] as const;

export const FOOD_TAG_LIMITS = { maxTotal: 5, maxCustomLength: 40 } as const;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Resolve a draft to the tag to store, or a rejection reason. */
export function resolveFoodTag(
  selected: readonly string[],
  draft: string,
): { tag: string } | { error: string } {
  const text = draft.trim().replace(/\s+/g, ' ');
  if (!text) return { error: '' };
  if (text.length > FOOD_TAG_LIMITS.maxCustomLength) {
    return { error: `Keep it under ${FOOD_TAG_LIMITS.maxCustomLength} characters.` };
  }
  const curated = FOOD_DESCRIPTOR_TAGS.find((t) => norm(t.name) === norm(text));
  const tag = curated ? curated.name : text;
  if (selected.some((s) => norm(s) === norm(tag))) return { error: 'Already added.' };
  if (selected.length >= FOOD_TAG_LIMITS.maxTotal) {
    return { error: `You can add up to ${FOOD_TAG_LIMITS.maxTotal} tags.` };
  }
  return { tag };
}

interface FoodTagSelectorProps {
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  label?: string;
  helperText?: string;
}

const FoodTagSelector = ({
  selectedTags,
  onAddTag,
  onRemoveTag,
  label = 'How would you describe it?',
  helperText,
}: FoodTagSelectorProps) => {
  const [hint, setHint] = useState<string | null>(null);
  const atLimit = selectedTags.length >= FOOD_TAG_LIMITS.maxTotal;

  const findSelected = (name: string) => selectedTags.find((s) => norm(s) === norm(name));

  const tryAdd = (draft: string): boolean => {
    const r = resolveFoodTag(selectedTags, draft);
    if ('error' in r) {
      setHint(r.error || null);
      return false;
    }
    setHint(null);
    onAddTag(r.tag);
    return true;
  };

  const selected: UnifiedSelectedTag[] = selectedTags.map((tag) => {
    const curated = FOOD_DESCRIPTOR_TAGS.find((t) => norm(t.name) === norm(tag));
    return { key: tag, label: curated?.name ?? tag, emoji: curated?.emoji };
  });

  return (
    <UnifiedTagSelector
      label={label}
      helperText={helperText}
      suggestions={FOOD_DESCRIPTOR_TAGS.map((t) => ({ id: t.name, label: t.name, emoji: t.emoji }))}
      selectedSuggestionIds={FOOD_DESCRIPTOR_TAGS.filter((t) => findSelected(t.name)).map((t) => t.name)}
      selectedTags={selected}
      onToggleSuggestion={(id) => {
        const existing = findSelected(id);
        if (existing) {
          setHint(null);
          onRemoveTag(existing);
        } else {
          tryAdd(id);
        }
      }}
      onRemoveSelected={(key) => {
        setHint(null);
        onRemoveTag(key);
      }}
      onSubmitCustom={tryAdd}
      atLimit={atLimit}
      customDisabled={atLimit}
      limitPlaceholder={
        atLimit
          ? `Limit reached (${FOOD_TAG_LIMITS.maxTotal}/${FOOD_TAG_LIMITS.maxTotal}). Remove one to add more.`
          : 'Add your own'
      }
      maxCustomLength={FOOD_TAG_LIMITS.maxCustomLength}
      hint={hint}
    />
  );
};

export default FoodTagSelector;
