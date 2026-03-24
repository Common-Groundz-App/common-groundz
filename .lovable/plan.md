

# Who to Follow — Batch Mutual Proof (Final)

## 3 Files

### 1. `src/services/userRecommendationService.ts`
- Add `mutuals?: number` to `RecommendedUser` interface
- Map `user.mutuals` from RPC response

### 2. `src/pages/Feed.tsx`
- After fetching recommendations, ONE call to `get_batch_mutual_previews` with all user IDs
- Build `Map<userId, { previews, total_count }>`, store in state
- Clear map when recommendations refresh (no stale data)
- Pass each user's entry to `UserRecommendationCard` as `mutualData` prop
- On error → empty map → cards fall back gracefully
- Fetch tied to recommendation list changes only

### 3. `src/components/feed/UserRecommendationCard.tsx`
Accept optional `mutualData` prop. Replace `user.reason` with:

**Priority (strict):**
1. **Mutuals > 0**: Tiny stacked avatars (`ProfileAvatar` xs, `-0.25rem` margin, `border-2 border-background`) + text:
   - 1: "Followed by **Hana**"
   - 2: "Followed by **Hana** and **Anitha**"
   - 3+: "Followed by **Hana** and N others you follow" (pluralized)
   - Names = `first_name || username || 'someone'`, max 2 shown
   - Names are clickable `UsernameLink` components → route to profile
2. **`fof` source, no mutual data yet**: "Followed by people you follow"
3. **Source fallback**: `active` → "Popular this week", `fresh` → "New on Common Groundz", default → "Suggested for you"

Avatar stack: `aria-hidden="true"`. Loading/error → source fallback (no flicker).

