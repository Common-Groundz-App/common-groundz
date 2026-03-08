

# Plan: Replace Share2 with Send (Paper Airplane)

## On ChatGPT's SharedIcon component suggestion

**Skip it.** Creating a wrapper component for a single icon import is over-engineering. If we ever change the icon again, a global find-and-replace takes 10 seconds. The 6 files are already identified. A wrapper adds indirection with no real benefit.

## On Codex's audit suggestion

**Already done.** The global search confirms exactly 6 files with `Share2` — no hidden usages in modals, admin views, or mobile-only components.

## Changes (6 files, pure icon swap)

Every file: replace `Share2` with `Send` in the import statement, then replace all `<Share2 .../>` JSX usages with `<Send .../>`. No size changes — keep existing sizes (`h-3 w-3`, `h-4 w-4`, `h-5 w-5`) to match sibling icons in each context.

| File | Instances |
|------|-----------|
| `src/components/feed/PostFeedItem.tsx` | 1 |
| `src/components/profile/ProfilePostItem.tsx` | 1 |
| `src/components/profile/reviews/ReviewCard.tsx` | 2 |
| `src/components/recommendations/RecommendationCard.tsx` | 2 |
| `src/pages/EntityDetail.tsx` | 1 |
| `src/pages/EntityDetailV2.tsx` | 1 |

No logic changes. No new files.

