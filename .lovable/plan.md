

## Phase 2: Feed Card Interaction Refinement — Final Plan

### Scope
**1 file**: `src/components/feed/PostFeedItem.tsx`. No DB changes. `RecommendationFeedItem` untouched.

### All Changes

**1. Imports (line 6)**
- Replace `Heart` with `ThumbsUp` in lucide-react import
- Add `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from `@/components/ui/tooltip`

**2. New state for in-flight guards**
- `const [isLiking, setIsLiking] = useState(false)`
- `const [isSaving, setIsSaving] = useState(false)`
- `handleLikeClick`: early return if `isLiking`, wrap in `setIsLiking(true)` / `finally { setIsLiking(false) }`
- `handleSaveClick`: same pattern with `isSaving`

**3. Helpful button (replaces Heart/Like)**
- `ThumbsUp` icon, active color `text-blue-500 hover:text-blue-600`, keep `fill-current`
- `aria-label="Mark as helpful"`, `aria-pressed={localIsLiked}`
- `disabled={isLiking}`, `disabled:opacity-50 disabled:cursor-not-allowed`
- `whitespace-nowrap` on button
- Label: `<span className="ml-1 hidden sm:inline">Helpful</span>`
- Wrapped in `Tooltip` → "Mark as helpful"

**4. Discuss button (comment action)**
- `aria-label="View discussion"`
- `whitespace-nowrap` on button
- Label: `<span className="ml-1 hidden sm:inline">Discuss</span>`
- Wrapped in `Tooltip` → "View discussion"

**5. Save button**
- Add `aria-pressed={localIsSaved}`, `disabled={isSaving}`, `disabled:opacity-50 disabled:cursor-not-allowed`

**6. Wrapper**
- Wrap social actions div content in `<TooltipProvider delayDuration={300}>`

**7. Spacing**
- `gap-1.5` on action buttons for natural spacing

### What stays unchanged
- Entity tags position, Bookmark/Share buttons, card layout, detail view behavior, `RecommendationFeedItem`, DB logic

