

# Remove `?v=4` from entity navigation URLs

No changes to the plan. Both reviewer suggestions (manual version override, internal testing mechanism) are already handled by `getEntityPageVersion()` in `entityVersionUtils.ts`, which reads `?v=` from the URL for internal users. We're only removing hardcoded `?v=4` from navigation links across 6 files — the version system remains fully functional.

## Changes

Remove `?v=4` string from navigation calls in:

| File | What to change |
|------|---------------|
| `RecommendationEntityCard.tsx` | Line 54: remove `?v=4` from navigate call |
| `EntityV4.tsx` | Lines 349, 352, 574, 576: remove `?v=4` from child/sibling navigation |
| `EntityHeader.tsx` | Line 133: remove `?v=4` from share URL |
| `ChatEntityCard.tsx` | Lines 216, 218: remove `?v=4` from navigate |
| `UserSuggestionHistory.tsx` | Line 207: remove `?v=4` from window.open |
| `ClaimReviewModal.tsx` | Line 249: remove `?v=4` from admin link |

Pure string removal — no logic changes.

