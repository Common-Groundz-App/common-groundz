import { normalizeHashtag, isValidHashtag } from './hashtag';

const RAW_CATEGORY_TAGS: Record<string, string[]> = {
  product:  ['review', 'budget', 'recommend', 'dupe'],
  food:     ['recipe', 'foodie', 'musttry', 'budget'],
  movie:    ['review', 'mustwatch', 'spoilerfree'],
  book:     ['review', 'mustread', 'recommend'],
  place:    ['travel', 'mustvisit', 'hiddengem'],
  default:  ['review', 'recommend', 'experience', 'tip'],
};

const RAW_POST_TYPE_TAGS: Record<string, string[]> = {
  story:      ['journey', 'experience'],
  comparison: ['comparison', 'dupe'],
  question:   ['help', 'advice'],
  tip:        ['tip', 'protip'],
};

// Normalize + validate + Phase 1 length cap (≤50) at module load
const normalize = (arr: string[]) =>
  arr
    .map(normalizeHashtag)
    .filter(t => isValidHashtag(t) && t.length > 0 && t.length <= 50);

const CATEGORY_TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_CATEGORY_TAGS).map(([k, v]) => [k, normalize(v)])
);
const POST_TYPE_TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_POST_TYPE_TAGS).map(([k, v]) => [k, normalize(v)])
);

export interface SuggestionInput {
  entities: Array<{ type?: string }>;
  postType?: string;
  existingTags: string[];
}

/**
 * Returns up to 5 suggested hashtags based on tagged entities and post type.
 * Stable insertion order: entity tags → postType tags → defaults (only if empty).
 */
export function getSuggestedTags({
  entities,
  postType,
  existingTags,
}: SuggestionInput): string[] {
  const existing = new Set(existingTags.map(t => t.toLowerCase()));
  const ordered: string[] = [];
  const seen = new Set<string>();

  entities.forEach(e => {
    const tags = CATEGORY_TAGS[e.type || 'default'] || CATEGORY_TAGS.default;
    tags.forEach(t => {
      if (!seen.has(t) && !existing.has(t)) {
        ordered.push(t);
        seen.add(t);
      }
    });
  });

  if (postType && POST_TYPE_TAGS[postType]) {
    POST_TYPE_TAGS[postType].forEach(t => {
      if (!seen.has(t) && !existing.has(t)) {
        ordered.push(t);
        seen.add(t);
      }
    });
  }

  if (ordered.length === 0) {
    CATEGORY_TAGS.default.forEach(t => {
      if (!existing.has(t)) {
        ordered.push(t);
        seen.add(t);
      }
    });
  }

  return ordered.slice(0, 5);
}
