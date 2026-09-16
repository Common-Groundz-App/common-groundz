# Phase 4.3 — Gate 6: preservation and live zero-dependency verification

Scope: verification only, plus the two defect fixes the plan authorised (share no-op, and a
second defect found during verification: retired-route replacement pointed at non-existent
type-prefixed paths). No schema changes, no deletions of database objects, no type regeneration.
Stop before Phase 4.4.

Evidence levels used below:
- **R** runtime/fixture required
- **T** automated-test or static contract sufficient
- **M** optional manual observation

---

## 1a. Confirmed defect fixes (inside Gate 6 scope)

| # | Defect | Fix | Result |
|---|--------|-----|--------|
| 1 | `RecommendationCard.handleShare` was an empty function body wired to the share control in both card variants | `src/utils/sharePost.ts` now exposes `shareUrl(url, title, copiedDescription)` (native share → clipboard fallback → toast); `sharePost` delegates to it and is unchanged externally. `handleShare` shares `origin + entityRoute`; both share controls render only when `canShare` (a valid canonical destination exists). | **PASS** (T) |
| 2 | Gate 5's replacement navigation used `getEntityRoute`'s type-prefixed paths (`/place/:slug`, `/movie/:slug`, …). The app serves entity pages **only** at `/entity/:slug` and `/entity/:parentSlug/:childSlug` (`src/App.tsx` lines 191–192), so every linked endorsement card resolved to the 404 page. | `getEntityRoute` now returns `getEntityUrlWithParent(entity)` (canonical helper, hierarchical when parent info is present), still returning `null` for missing slug or deleted subjects. Card click and share both consume it. | **PASS** (T + live route load) |

Live proof for #2: `GET /entity/isha-foundation-chikkaballapura` renders the entity page
("6 recommending"); the previous form `/place/isha-foundation-chikkaballapura` rendered
"404 — Oops! Page not found".

## 1b. Additional leftovers removed (dead files, zero references)

Two untracked-by-tooling snapshot files under `supabase/functions/` still contained the
pre-Gate-1 legacy bodies; both had zero imports, deployment references, scripts, tests or
migration responsibilities (verified by repo-wide search for their filenames):

- `supabase/functions/get_comments_with_profiles.sql` — referenced `recommendation_comments` / `recommendation_id`
- `supabase/functions/increment_comment_count.sql` — updated `public.recommendations`

Both deleted. The authoritative definitions are the post-only ones rewritten in the Gate 1
freeze migration; live `pg_proc` confirms both `get_comments_with_profiles` overloads
(`(text,text,uuid)`, `(text,text,uuid,uuid)`) contain no "recommendation" substring.
No `.sql` file under `supabase/functions/` mentions the legacy layer any more.

---

## 2. Gate 5 fix verification

| Check | Level | Result |
|-------|-------|--------|
| Recs card click routes to the canonical entity page | T + M | **PASS** — static/live route confirmed; signed-in click-through verified by the project owner on 2026-09-16 (§6) |
| Share produces the canonical entity URL, never a retired URL | T | **PASS** |
| No dead comment affordance on the card | T | **PASS** (comment-count controls removed in Gate 5; none reintroduced) |
| `/recommendations/:id` does not resolve live | R | **PASS** — renders the 404 page |
| `/recommendation/:id` does not resolve live | R | **PASS** — renders the 404 page |
| Both orphan-media jobs contain no `recommendations.image_url` reference | T | **PASS** — reference sets are posts, reviews, review updates, entity photos, entities |

## 3. Preservation checks

| Surface | Level | Result |
|---------|-------|--------|
| `posts.post_type='recommendation'` behaves as a normal post (feed, detail, notifications on the post path, comments, likes) | T | **PASS** — comment/notification handling is post-only end to end; 633/633 tests |
| `reviews.is_recommended` untouched; 58 public published endorsements present | R | **PASS** (post-cleanup observation) |
| Profile Recs tab retained, endorsement-backed (`ProfileRecommendations` → `useRecommendations` → `reviewService.fetchUserRecommendations` → `reviews.is_recommended`) | T + M | **PASS** — signed-in render verified by the project owner on 2026-09-16 (§6) |
| Entity v4 recommending count | R | **PASS** — "6 recommending" on `/entity/isha-foundation-chikkaballapura`, matching the live distinct-endorser count (6) |
| "Recommended by Your Circle" card | R | **PASS** — guest render verified; signed-in circle counts and card verified by the project owner on 2026-09-16 (§6) |
| `UserRecommendationCard`, `fallbackRecommendationService`, `networkRecommendationService`, `ChatRecommendationCards`, `JourneyRecommendationCard`, who-to-follow | T | **PASS** — unmodified, no legacy-table reads |

Baseline note: the Gate 3 manifest captured only the six converted reviews' markers, not
platform-wide endorsement or count baselines. Exact historical before/after comparison for
aggregate counts is therefore **unavailable**; the numbers above are current post-cleanup
observations against the canonical endorsement path, not a manufactured baseline. The six
captured review markers are cleared and the reviews themselves remain (verified in Gate 4).

## 4. Live zero application/runtime dependency

- No application code reads `recommendations`, `recommendation_comments`, `recommendation_likes`,
  `recommendation_saves` or `recommendations_backup` (sweep over `src/` and `supabase/functions/`,
  excluding the generated `types.ts` and intentional comments/tests).
- Repo-wide sweep for `/recommendations/` and `/recommendation/` — every remaining hit classified
  intentional: roadmap and `docs/verification/*` history, the explanatory comment in
  `notificationDestination.ts`, its tests that deliberately feed legacy links to prove rejection,
  and `@/services/recommendation/types` imports (a live type module, not the legacy tables).
- Live grants: all four legacy tables — `anon`/`authenticated` SELECT only, `service_role`
  SELECT + DELETE, `postgres` full. The six legacy-only RPCs are `postgres=X` only, and the
  anonymous API reports them as not found in the schema cache (`PGRST202`).
- All four legacy tables are empty; zero notifications with a legacy `action_url`.
- Exactly five cron jobs: orphan-media weekly dry run, retracted-notification prune,
  entity-stats-v2 hourly (:05), social-influence-v2 daily (04:12), trending-v2 hourly (:20).

## 5. Deferred database/schema dependencies (intentional, not defects — Phase 4.5)

Inventoried from the live catalogues: the four legacy tables plus `recommendations_backup`;
their primary keys, unique keys, foreign keys and indexes; `reviews_recommendation_id_fkey`;
`reviews.recommendation_id` and `reviews.is_converted`; the six remaining SELECT-only policies;
the triggers on the legacy tables (`on_new_recommendation_comment`,
`on_soft_delete_recommendation_comment`, `update_updated_at_column`,
`on_new_recommendation_like`, `on_delete_recommendation_like`,
`update_recommendations_updated_at`); the six legacy-only RPCs; and the generated
`src/integrations/supabase/types.ts` entries.

**Phase 4.5 warning:** the `recommendation_visibility` enum is NOT legacy-only — it types
`posts.visibility`, `reviews.visibility` and the backup tables. It must be kept (rename at most).
Only `recommendation_category` is legacy-only (`recommendations`, `recommendations_backup`).

## 6. Signed-in checks — closed by manual observation

This project uses the user's own external Supabase, so no test session could be injected or
minted from this environment and no transaction fixtures could be run from here. That limitation
is why manual observation was used for the three signed-in checks.

On 2026-09-16 the project owner verified, on their own signed-in session, that all three work
as expected:

1. **Profile Recs tab** — renders correctly; clicking a card opens the correct entity page and
   Share uses the entity link. **PASS (manual observation)**
2. **Entity V4** — the recommending and from-circle counts and the "Recommended by Your Circle"
   card behave correctly. **PASS (manual observation)**
3. **Recommendation-type posts** — create, comment, like and open notifications through the
   normal post flow. **PASS (manual observation)**

All previously blocked checks are now PASS. Nothing remains blocked.

## 6a. Gate 6 close-out verdict

Every Gate 6 requirement is PASS — runtime/fixture, automated-test/static, and the three
manual-observation checks above. Combined with the live audit of Gates 0–5: all four retired
tables empty; no review conversion markers; no retired notification links; `anon`/`authenticated`
read-only with every write policy gone; retired-only routines owner-executable only; the seven
shared comment routines post-only in the live database; recommendation posts on the normal post
path; exactly one trending job (hourly :20) and one influence job (daily 04:12); both
media-cleanup jobs clean; 633/633 tests, type check clean, build green.

**Gate 6 is complete and Phase 4.3 is fully complete: every gate PASS, no leftovers, no
defect-level references to the retired system.**

## 7. Build health

- Type check: clean
- Tests: 633/633 passed (38 files)
- Build: green
