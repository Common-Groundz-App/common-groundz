

# Assessment: Tiered Recency Weighting

ChatGPT's suggestion is a good improvement. The existing `applyRecencyWeighting` function has a binary approach (recent = +10%, old = nothing), which is too simplistic. A tiered decay is more natural and barely adds complexity since we're already touching this function.

**Accept the suggestion.** Update `applyRecencyWeighting` to use tiered boosts:

| Age | Boost |
|-----|-------|
| < 7 days | 1.3x |
| < 30 days | 1.15x |
| < 180 days | 1.05x |
| 180+ days | 1.0x (no boost) |

This replaces the current binary 30-day / 1.1x logic. No other changes to the plan.

## Final 4-step plan (unchanged except step 4 refinement)

1. **Database migration** — Fix `has_network_activity` to query `reviews` table, remove time filter
2. **Database migration** — Add `entity_slug` to `get_aggregated_network_recommendations_discovery`
3. **Frontend** — Propagate `entity_slug` in `NetworkRecommendations.tsx` mapping
4. **Frontend** — Wire up `applyQualityFiltering` + `applyRecencyWeighting` in `getNetworkEntityRecommendationsWithCache`, and update `applyRecencyWeighting` to use tiered decay instead of flat 10%

