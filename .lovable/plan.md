

## Plan: Fix Duplicate Recommending Row + Skeleton Visibility

Two small fixes, both ready to implement.

### 1. `src/components/entity-v4/EntityHeader.tsx` (line 520)
Change the condition to gate the full recommendation block behind `user`:
```
{stats && user && (stats.recommendationCount > 0 || stats.circleRecommendationCount > 0) && (
```

### 2. `src/components/entity-v4/ReviewsSection.tsx` (lines 571-572)
Use `bg-muted-foreground/10` for the skeletons — ChatGPT is right that neutral tones work better than brand colors for skeleton placeholders. This stays visible against the `bg-brand-orange/5` card background while looking like a proper loading state in both light and dark themes:
```
<Skeleton className="h-12 w-full rounded-lg bg-muted-foreground/10" />
<Skeleton className="h-12 w-full rounded-lg bg-muted-foreground/10" />
```

Two lines changed across two files. No other modifications needed.

