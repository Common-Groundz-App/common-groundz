

# Final Plan: Fix RPC Type Mismatch + Timestamp Handling

ChatGPT is correct — `created_at` should also use `undefined` not `new Date()`. Both fields must be consistent to avoid the fake freshness bug.

## Step 1: SQL Migration
Single migration file:
- Drop stale overload `(uuid, uuid[], integer)`
- Drop and recreate `(uuid, uuid, integer)` with `ad.net_score::double precision as network_score`

## Step 2: Fix `src/services/networkRecommendationService.ts`

**2a) Lines 256 and 268** — remove `new Date()` fallbacks:
```typescript
created_at: anyRec.latest_recommendation_date ?? undefined,
// ...
latest_recommendation_date: anyRec.latest_recommendation_date ?? undefined,
```

**2b) `applyRecencyWeighting`** — handle missing dates as "no boost":
```typescript
const recDate = rec.latest_recommendation_date
  ? new Date(rec.latest_recommendation_date)
  : null;

let recencyBoost = 1.0;
if (recDate) {
  const ageInDays = (now.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) recencyBoost = 1.3;
  else if (ageInDays < 30) recencyBoost = 1.15;
  else if (ageInDays < 180) recencyBoost = 1.05;
}
```

Nothing else to add. This is the complete fix.

