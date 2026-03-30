

# Fix Singular/Plural Count Labels App-Wide

The plan is solid and ready to ship. Adding the NaN guard as suggested by Codex is a good defensive measure.

## Step 1: Add `formatCount` to `src/lib/utils.ts`

```ts
export function formatCount(count: number | null | undefined, singular: string, plural?: string): string {
  const n = Number(count ?? 0);
  const safeN = Number.isNaN(n) ? 0 : n;
  const p = plural || `${singular}s`;
  return safeN === 1 ? `1 ${singular}` : `${safeN} ${p}`;
}
```

## Step 2: Apply across 8 files

All inline stats use **lowercase**. All manual ternaries replaced.

| File | Changes |
|------|---------|
| `PostDetailSidebar.tsx` | `formatCount(followerCount, 'follower')`, `formatCount(postCount, 'post')`, reviews, ratings |
| `ProfileInfo.tsx` | `formatCount(followerCount, 'follower')` |
| `PublicProfileView.tsx` | follower label |
| `ProfileBadges.tsx` | follower label |
| `EntityFollowersCount.tsx` | follower label |
| `EntityV3Header.tsx` | review, rating counts |
| `UserDirectoryList.tsx` | recommendation, follower counts |
| `JourneyRecommendationCard.tsx` | user count |

## Rules
- **Inline stats**: lowercase via `formatCount` — "1 follower", "5 posts"
- **"Following"**: unchanged (it's a label)
- No layout or component API changes

