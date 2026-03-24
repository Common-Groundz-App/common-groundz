

# Top-align avatar in Who to Follow cards

Fair point — drop the `mt-0.5`. `items-start` alone should be sufficient. If alignment feels off after implementation, we can adjust text leading rather than adding margin to the avatar.

## Change

**`src/components/feed/UserRecommendationCard.tsx`, line 87:**

Change `flex items-center gap-3` → `flex items-start gap-3`

That's it. One class change.

