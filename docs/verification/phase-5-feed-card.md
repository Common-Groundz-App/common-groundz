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