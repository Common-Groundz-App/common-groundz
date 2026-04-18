

## My take

Both reviews land on solid additions. Adopting all 3 with one important nuance.

**ChatGPT #1 + Codex #1 — Dedup analytics:** Correct and important. My v4 `useEffect` would refire on every render where `suggestions` is a new array reference (which is *every* render unless deeply memoized). Need a guard.

**ChatGPT #2 — Reset on context change:** Correct complement to #1. When entity/postType actually changes, we *want* a new impression event. Combining #1 + #2 = track once per meaningful context.

**Codex #2 — Reuse existing hashtag parser:** Right principle (no regex drift), but needs care. The existing `extractHashtags` returns *all* hashtags from text — perfect for the duplicate check. Use `extractHashtags(title + ' ' + content).includes(tag)` instead of a hand-rolled regex. Eliminates the `escapeRegex` helper entirely. Cleaner.

**Better implementation than two separate `useEffect`s:** Use a single ref keyed on a serialized context signature. One `useEffect`, one source of truth, no race between the "track" and "reset" effects.

## Final Phase 2 plan

### Files
- **New:** `src/utils/hashtagSuggestions.ts` (~45 lines)
- **Edit:** `src/components/feed/EnhancedCreatePostForm.tsx` (~35 lines added)

### 1. Helper: `src/utils/hashtagSuggestions.ts`

```ts
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

const normalize = (arr: string[]) =>
  arr.map(normalizeHashtag).filter(t => isValidHashtag(t) && t.length > 0 && t.length <= 50);

const CATEGORY_TAGS = Object.fromEntries(
  Object.entries(RAW_CATEGORY_TAGS).map(([k, v]) => [k, normalize(v)])
);
const POST_TYPE_TAGS = Object.fromEntries(
  Object.entries(RAW_POST_TYPE_TAGS).map(([k, v]) => [k, normalize(v)])
);

export interface SuggestionInput {
  entities: Array<{ type?: string }>;
  postType?: string;
  existingTags: string[];
}

export function getSuggestedTags({
  entities, postType, existingTags
}: SuggestionInput): string[] {
  const existing = new Set(existingTags.map(t => t.toLowerCase()));
  const ordered: string[] = [];
  const seen = new Set<string>();

  entities.forEach(e => {
    (CATEGORY_TAGS[e.type || 'default'] || CATEGORY_TAGS.default).forEach(t => {
      if (!seen.has(t) && !existing.has(t)) { ordered.push(t); seen.add(t); }
    });
  });

  if (postType && POST_TYPE_TAGS[postType]) {
    POST_TYPE_TAGS[postType].forEach(t => {
      if (!seen.has(t) && !existing.has(t)) { ordered.push(t); seen.add(t); }
    });
  }

  if (ordered.length === 0) {
    CATEGORY_TAGS.default.forEach(t => {
      if (!existing.has(t)) { ordered.push(t); seen.add(t); }
    });
  }

  return ordered.slice(0, 5);
}
```

No `escapeRegex` — duplicate check uses existing `extractHashtags`.

### 2. Composer: `EnhancedCreatePostForm.tsx`

```tsx
import { extractHashtags } from '@/utils/hashtag';
import { getSuggestedTags } from '@/utils/hashtagSuggestions';

const suggestions = useMemo(() => getSuggestedTags({
  entities: selectedEntities,
  postType,
  existingTags: detectedHashtagsForChips,
}), [selectedEntities, postType, detectedHashtagsForChips]);

// Single-source dedup: track once per context signature
const lastTrackedSignatureRef = useRef<string>('');
useEffect(() => {
  if (suggestions.length === 0) return;
  const signature = JSON.stringify({
    tags: suggestions,
    entityIds: selectedEntities.map(e => e.id),
    postType: postType || null,
  });
  if (lastTrackedSignatureRef.current === signature) return;
  lastTrackedSignatureRef.current = signature;
  analytics.track('hashtag_suggestions_shown', {
    count: suggestions.length,
    tags: suggestions,
    entity_count: selectedEntities.length,
    post_type: postType || null,
  });
}, [suggestions, selectedEntities, postType]);

const handleSuggestionClick = (tag: string) => {
  // Reuse existing extraction — no regex drift
  const present = new Set(extractHashtags(`${title || ''} ${content || ''}`));
  if (present.has(tag.toLowerCase())) return;

  const tagToken = `#${tag}`;
  const position = suggestions.indexOf(tag);

  if (content?.trim()) {
    setContent(prev => {
      const base = (prev || '').trimEnd();
      return base ? `${base} ${tagToken} ` : `${tagToken} `;
    });
  } else if (title?.trim()) {
    setTitle(prev => {
      const base = (prev || '').trimEnd();
      return base ? `${base} ${tagToken}` : tagToken;
    });
  } else {
    setContent(`${tagToken} `);
  }

  analytics.track('hashtag_suggestion_clicked', {
    tag,
    tag_position: position,
    entity_count: selectedEntities.length,
    post_type: postType || null,
    source: 'suggested_chip',
  });
};
```

```tsx
{suggestions.length > 0 && (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Suggested</p>
    <div className="flex flex-wrap gap-2">
      {suggestions.map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className="cursor-pointer hover:bg-accent gap-1"
          onClick={() => handleSuggestionClick(tag)}
        >
          <Plus className="h-3 w-3" /> #{tag}
        </Badge>
      ))}
    </div>
  </div>
)}
```

Placement: above the existing Phase 1 detected-tags ("Tags") row.

### Why the signature-ref approach beats two effects
- **One source of truth** — no race between "track" effect and "reset" effect
- **Naturally handles all context changes** — entity swap, postType swap, tag list change all produce a new signature
- **Naturally suppresses re-renders** — same context = same signature = no re-fire
- **Resilient to React StrictMode double-invocation**

### Out of scope (Phase 2.5+)
- ❌ `#` typeahead/autocomplete
- ❌ Chip × removal
- ❌ Edit composer (`ModernCreatePostForm`)
- ❌ DB-backed suggestions
- ❌ AI suggestions

### Verification
1. No entity → 4 default suggestions, `hashtag_suggestions_shown` fires once
2. Tag `product` entity → suggestions update, event fires once more (new signature)
3. Type random text in content → suggestions unchanged, **no** new event fires (signature stable)
4. Click `+ #budget` → tag appended, `hashtag_suggestion_clicked` fires with `tag_position`
5. Click `+ #budget` again (already in content) → no-op (extractHashtags-based dedup)
6. Type `#budgeting` then click `+ #budget` → still inserts (extractHashtags returns distinct tokens)
7. Submit → Phase 1 persistence handles `post_hashtags` row
8. Mobile: chips wrap cleanly, no overflow
9. All tags lowercase

### Build estimate
1 new file (~45 lines), 1 edit (~35 lines added). One implementation pass.

