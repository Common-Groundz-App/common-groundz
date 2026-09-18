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

Pending completion of automated checks and real-app screenshots.