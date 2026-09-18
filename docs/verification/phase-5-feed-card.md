# Phase 5 feed-card verification

## Scope

Phase 5 is incremental polish of the existing shared post card. Editorial post types,
post-local review ratings, and review endorsement truth remain separate concepts.

## 5.0A — badge placement only

### Implemented

- Moved the existing post-type badge from the timestamp metadata line into a collapsing
  trailing header region beside the owner overflow menu.
- Kept the avatar, identity typography, metadata typography, header density, body order,
  media, entity chips, and action row unchanged.
- Removed the duplicate detail-only badge; detail mode now uses the shared card header.
- The trailing region is absent when neither badge nor owner menu exists.
- The existing identity rendering is preserved inside a minimally constrained flexible region.

### Preserved boundaries

- No post query or stored data changed.
- No rating behavior changed.
- No like, comment, save, share, media, entity-navigation, composer, or endorsement logic changed.

### Verification

- Full Vitest suite: PASS (38 files, 633 tests).
- TypeScript check (`tsgo --noEmit`): PASS.
- Production build: PASS.
- Source sweep: PASS — badge helpers remain only in the shared `PostFeedItem`; the duplicate
  detail badge and imports are gone.
- Public post detail, desktop: PASS — badge is right-aligned in the shared header and appears once.
- Public post detail, mobile (390 × 844): PASS — badge remains visible without colliding with content.
- Long identity simulation at mobile width: PASS — existing wrapping remains and trailing badge stays visible.
- Experience post: PASS — no badge and no empty trailing region for a non-owner guest.
- Dark theme: PASS for layout and collision behavior.
- Owner-menu adjacency: static/source-covered; authenticated runtime verification is unavailable because
  this project uses an external Supabase session that cannot be injected into the test browser.

### Screenshots

- `/tmp/browser/phase-5-0a/screenshots/desktop-feed-card.png`
- `/tmp/browser/phase-5-0a/screenshots/mobile-feed-card.png`
- `/tmp/browser/phase-5-0a/screenshots/mobile-long-name-dark.png`
- `/tmp/browser/phase-5-0a/screenshots/desktop-detail.png`

## 5.0C — post-local Review rating

### Implemented

- Added a compact horizontal connected-rings row to Review posts only.
- Read the value only from the post's own `structured_fields.rating`.
- Accepted only finite numeric values from 1 through 5; strings, arrays, nulls, malformed values,
  out-of-range numbers, and stray ratings on other post types are ignored.
- Carried `structured_fields` through home/following, entity, hashtag, and related-post reads.
- Made the shared post card the single rating owner in feed and detail modes.
- Suppressed the detail structured-fields copy of the rating and collapsed that section when no
  other structured fields remain.

### Preserved boundaries

- No review-table, endorsement, entity-average, Circle, or recommendation-post lookup was added.
- The 5.0A header, title/body, media-before-entity order, chips, action row, navigation, and write
  behavior are unchanged.
- No schema or generated database type changed.

### Verification

- Focused strict-validation and detail-reconciliation tests: PASS (21 tests).
- Full Vitest suite: PASS (40 files, 654 tests).
- TypeScript check (`tsgo --noEmit`): PASS.
- Preview build: PASS.
- Real public Review detail, desktop: PASS — one compact 4.0 rating row and one Review badge.
- Real public Review detail, mobile (390 × 844): PASS — one 102 × 20 rating row without collision.
- Dark theme: PASS — rating remains readable and correctly positioned.
- Rating-only Review detail: PASS — rating appears once and the suppressed detail section leaves
  no empty wrapper or unexplained spacing.
- Public profile default tab: the sampled Review was not exposed there, so no feed-runtime claim is made;
  shared query propagation and card rendering are covered by source inspection and automated tests.
- Browser console: an existing comments RPC overload error remains on public post detail; it is unrelated
  to 5.0C and does not affect rating rendering.
- Project-wide lint remains blocked by the established unrelated backlog. The one newly touched broad
  value type in `StructuredFieldsDisplay` was removed; no lint-baseline cleanup was included in this scope.

### Screenshots

- `/tmp/browser/phase-5-0c/screenshots/desktop-review-detail.png`
- `/tmp/browser/phase-5-0c/screenshots/desktop-review-rating.png`
- `/tmp/browser/phase-5-0c/screenshots/mobile-review-detail.png`
- `/tmp/browser/phase-5-0c/screenshots/mobile-review-dark.png`