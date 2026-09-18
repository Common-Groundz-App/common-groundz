# Phase 5.1 and 5.4 — Acceptance, verification, and close-out

## Recommendation

End visual development now. The supplied Review card has the intended hierarchy, and the existing evidence records 5.0A and 5.0C as implemented with 654 tests, type checking, and the preview build passing.

Complete 5.1 as an acceptance gate and then proceed directly to 5.4. Explicitly skip 5.2 because no extraction need has been demonstrated, and defer 5.3 because type-specific Question/Comparison layouts are separate future product work.

No layout, spacing, typography, media, chip, action-row, navigation, or data behavior changes are authorized. If verification reveals a real defect, stop and report it before changing the design or behavior.

## 5.1 — Cross-card acceptance only

Review representative cards on the actual shared surfaces:

- Review with a valid rating and Review without a rating;
- Recommendation with media;
- text-only and title-only cards;
- one and multiple entity chips;
- long display name/username;
- edited and visibility metadata where available;
- owner and non-owner states;
- home, hashtag, Entity V4, related posts, and post detail;
- desktop and narrow mobile, light and dark mode, and reduced motion.

Accept when:

- identity, badge, and owner menu do not collide;
- the rating appears only on eligible Review posts and exactly once on detail;
- absent ratings leave no empty gap;
- media remains before entity chips;
- text-only cards remain compact;
- the action row and existing navigation still look and behave as before.

Record 5.1 as accepted without further design work if these checks pass.

## Explicit Phase decisions

- **5.0B:** keep marked intentionally skipped; the accepted layout needs no spacing pass.
- **5.2:** mark skipped; the small shared-header and rating changes do not justify a new `FeedCardShell` abstraction.
- **5.3:** mark deferred, not incomplete; specialized Question/Comparison cards require a separate future need and approval.

## 5.4 — Final verification

### Runtime and interaction checks

On every accessible shared-card surface, verify:

- card, profile, and entity links;
- owner overflow menu where an authenticated owner card is available;
- like, comment, save, and share behavior without leaving changed test state;
- image/video behavior;
- edited and visibility metadata;
- all available editorial post types;
- rating presence, absence, strict Review-only behavior, and feed/detail non-duplication.

Classify anything unavailable in real data or inaccessible by viewer state as **BLOCKED** or **static/test-covered**, rather than claiming a runtime pass.

### Accessibility and responsive checks

Confirm keyboard navigation, accessible names, visible focus, nested-control behavior, narrow-width collision safety, light/dark contrast, and reduced-motion behavior. Use the shared card as-is; do not introduce visual refinements unless a concrete defect blocks acceptance.

### Technical close-out

- Run the focused rating/detail tests and the complete Vitest suite.
- Run TypeScript validation, the production build, and lint; report exact results and distinguish pre-existing lint debt from Phase 5 regressions.
- Inspect the latest build, browser console, runtime, and network signals for exercised surfaces.
- Sweep the repository to confirm no generic star rating or retired Phase 4 dependency was introduced.
- Confirm the card reads only its post-local `structured_fields.rating`, never endorsement truth, review timelines, entity aggregates, Circle counts, or recommender-count routines.

## Evidence and roadmap

Update the Phase 5 verification record with:

- a PASS / FAIL / BLOCKED matrix for the required cases and surfaces;
- exact test, typecheck, build, lint, runtime, and accessibility results;
- the accepted 5.1 decision and explicit 5.2 skip / 5.3 deferral;
- any known unrelated console or lint issue, clearly separated from Phase 5.

The current screenshot references point to temporary browser paths. Label them as session-local evidence rather than durable repository artifacts; do not add image files to the repository solely for close-out.

Mark 5.1 and 5.4 complete only when their checks pass, then mark 5.2 skipped and 5.3 deferred. Conclude with exactly one outcome:

- **PHASE 5 FULLY COMPLETE — safe to move to the next phase**, or
- **PHASE 5 NOT COMPLETE** with each failed or blocked item listed.

## Stop boundary

Stop after the Phase 5 close-out report. Do not begin another phase and do not make speculative feed-card improvements.
