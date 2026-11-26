# Phase 10 — Public + Private Visibility Closeout (10.1–10.5)

Date: 2026-11-26. Status: **PENDING MANUAL VERIFICATION** (automated gate passed; signed-in owner QA outstanding).

## 1. Architecture
- Reviews and Experiences (posts) store `public` or `private`. Circle Only retired from authoring.
- Circle is reader-side only: public reviews by accounts the viewer follows; no follow-back.
- Owner's private review is fetched separately (owner-scoped query) and pinned first on Entity V4; never part of public lists or aggregates.

## 2. Database constraints & policies (verified live 2026-11-26)
- `reviews_visibility_check`, `posts_visibility_check`: CHECK visibility IN (public, private). PASS
- reviews SELECT: `visibility = public OR user_id = auth.uid()`. PASS
- posts SELECT: public AND not deleted, OR owner. PASS
- review_updates SELECT: only if parent review is readable (inherits parent RLS). PASS
- Live data: 2 private reviews (one with media + 1 update, one with 1 update); 0 circle_only rows.

## 3. Public-only safeguards
Entity reviews, galleries, entity posts, Trust Metrics, Timeline Summary, live stats, Circle rating/count, canonical endorsements and personalized RPC all filter `public` (Phases 10.1–10.4).

## 4. Caching & refresh
- Entity cache key includes viewer id; owner-private query disabled until auth resolves; caches cleared on sign-out.
- Author session refreshes on success via review-change event + invalidation bridge; stale-response guards on Circle rating, Circle reviews, Timeline Summary.
- Other users' already-open pages are NOT updated live (no Realtime by design); they refresh on revisit/refetch.

## 5. Verification matrix

| Check | Evidence | Result |
|---|---|---|
| Guest direct API: both private reviews by ID | anon REST returned `[]` | PASS |
| Guest direct API: Timeline Updates of private reviews | `[]` | PASS |
| Guest direct API: any private post / private review | `[]` | PASS |
| Guest can read public reviews | row returned | PASS |
| DB constraints reject non public/private | constraint definitions live | PASS |
| Owner/follower/outsider DB-role access (10.1) | 39 role checks | PASS (10.1) |
| Pinned card, metrics, guards, badges (unit/integration) | phase10_2/3/4 tests | PASS |
| "Make it public anytime" copy accuracy | Reviews editable only 1h after publish; copy was false | FIXED → "Only you can see it." |
| Video review → Private fails, data unchanged, friendly notice | DB trigger + mapped error (10.2 tests) | PASS (automated); owner QA pending |
| Rishabh sees own private review pinned + profile badge | owner reported working in 10.4 | PENDING MANUAL VERIFICATION |
| Hana sees Rishabh public review as Circle, not his private ones | — | PENDING MANUAL VERIFICATION |
| Unrelated user: public visible, no Circle badge, no private | — | PENDING MANUAL VERIFICATION |
| Sign out / switch account without reload exposes nothing | — | PENDING MANUAL VERIFICATION |
| Copied private review/post URL opened as guest/other user | — | PENDING MANUAL VERIFICATION |
| Public↔Private transition updates all metrics (rating, breakdown, count, Circle, Certified, Evolution, Timeline Summary, gallery) | — | PENDING MANUAL VERIFICATION |

Signed-in browser sessions could not be created from the sandbox; no credentials were requested.

## 6. Media limitation
App queries never return private media, but files in the public `post_media` bucket stay reachable by anyone holding an old direct URL. Secure Private Photos remains a mandatory pre-launch item (docs/roadmap/before-launch.md). Videos stay public-only (Mux).

## 7. Automated results (2026-11-26)
- Vitest: 118 files, 1,345 passed, 3 skipped, 0 failed.
- TypeScript (`tsgo -b --noEmit`): clean.
- Production build (`vite build`): succeeded.

## 8. Outstanding
- Manual checks above (owner).
- Pre-launch: secure private photos; private Mux playback assessment; pre-existing linter findings.

## 9. Signoff
Phase 10 is **not yet signed off**. Mark complete after the owner confirms the pending checks or accepts named exceptions. Phase 11 not started.
