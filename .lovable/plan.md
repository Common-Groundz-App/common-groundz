

# Fix: Date Format — Using Shared Utility

ChatGPT's suggestion is reasonable. You already have `formatRelativeDate` in `dateUtils.ts` — adding a `formatDateLong` helper keeps date logic centralized.

## Changes

### 1. `src/utils/dateUtils.ts`
Add:
```ts
export const formatDateLong = (dateString: string | Date): string => {
  return format(new Date(dateString), 'MMM d, yyyy');
};
```

### 2. `src/components/ReviewCard.tsx` — line 66
```ts
// Before
date: new Date(review.created_at).toLocaleDateString(),
// After
date: formatDateLong(review.created_at),
```

Import `formatDateLong` from `@/utils/dateUtils`.

2 files. Minimal change.

