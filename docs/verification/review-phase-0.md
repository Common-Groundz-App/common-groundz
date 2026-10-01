# Review Phase 0 — audit findings (read-only)

Database: connected Supabase project `uyjtgybbktgapspodajy` (production). Run at 2026-10-01 13:59:45 UTC via read-only SELECT queries (supabase read_query). Code: ripgrep over `src/`. Nothing in the app or the data was changed.

## 1. Duplicate reviews
Query: `select user_id, entity_id, array_agg(id) from reviews where entity_id is not null group by 1,2 having count(*)>1`.
- 78 reviews total, all `status='published'`; 27 unlinked (no entity).
- **2 duplicate pairs (2 extra rows), same user `c8508bd3…`:**
  - entity `2f8e671d…`: reviews `2dc27d4d…`, `01bd8519…`
  - entity `0bd3f317…`: reviews `59e96f18…`, `32a4a951…`
- Create path: `services/review/core.ts` plain `insert` — nothing prevents a second review. No unique constraint on `reviews(user_id, entity_id)` found in the migrations.
- Delete path: `deleteReview` is a **hard delete** (no soft-delete/archive state). So "active" = "existing row".
- **Decision needed:** which review of each pair to keep (proposal: keep the newer, move the older into its timeline history, or simply delete the older since the data is dummy).

## 2. Places a review is shown
| Surface | File | Shows | Opens |
|---|---|---|---|
| Profile review cards | `components/profile/reviews/ReviewCard.tsx` (via `ProfileReviews.tsx`) | rating, text, media, type, likes, timeline | timeline viewer |
| Entity page review list | `components/entity-v4/ReviewsSection.tsx` + `TimelineReviewCard.tsx` | Circle-first list, rating, text, timeline badge | timeline viewer |
| Legacy generic card | `components/ReviewCard.tsx` | headline (`subtitle`), text, media, helpful count | nothing |
| Timeline viewer | `components/profile/reviews/ReviewTimelineViewer.tsx` | full history, updates, recommend intent | modal |
| Admin preview | `components/admin/ReviewPreviewModal.tsx` (`AdminReviewsPanel`) | admin moderation view | modal |
| Feed | review-type **posts** only; the review form creates no feed item | — | — |

**Recommendation:** use `ReviewTimelineViewer` as the one shared full-review view (it already opens from profile and entity cards and already holds the timeline). Extend it with the structured answers. No dedicated link for now; add one later if feed or notifications need a shareable link. Admin preview stays separate (it's moderation).

## 3. Existing questionnaire data
Queries: grouped by `jsonb_typeof(metadata)`, `metadata->'questionnaire'->>'version'`, `metadata ? 'food_tags'`; keys of `questionnaire.answers`.
- 54 reviews: no metadata. 23: `food_tags` only (no questionnaire). **1: questionnaire v1** (`b755c976…`, type `service`, `stood_out.selected = [had_to_follow_up, easy_to_book]`, no custom tags).
- No malformed metadata, no unknown versions, no unknown answer keys, no custom tags, nothing over the cap.
- Food Tags: 5 of the 23 have an empty array; **2 have Food Tags but no text**. Under decision 2 those two become reviews, not ratings.
- **Type mismatches: 17**, all legacy buckets — 12 stored `food` on a `place` entity, 5 stored `product` on a `brand` entity. These are already in compatibility mode (Stage 0 rule) until the subject is selected again.
- Text: 54 have description text. Headline: 34 have `subtitle`; it stays readable after the headline is removed.
- Timeline: 13 updates; `would_recommend` = null 11, `auto` 1, `maybe` 1.
- Impact on v2: only one v1 observation row exists; upgrading it when edited is trivial and never guesses anything.

## 4. Review likes (count only — nothing reset)
- 3 likes, 1 user, all 3 are the author liking **their own** reviews, created 2025-04-19 → 2025-04-24.
- Confirms dummy data. The Phase 3 reset would remove 3 self-likes. It still needs approval at that time.

## Decisions still needed before Phase 1
1. What to do with the 2 duplicate pairs.
2. Confirm `ReviewTimelineViewer` as the shared full-review view.
