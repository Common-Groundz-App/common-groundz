# Posted entity-tag polish

## Recommendation

Use the composer’s entity-pill visual language on posted cards: a compact circular entity image, a truncated entity name, and the same restrained pill proportions. Remove the separate category badge beneath each tagged entity. This improves continuity without reopening the completed post-card layout work.

## Scope

### 1. Replace the entity tag presentation in the shared post card

- Update only the tagged-entity section rendered by `PostFeedItem`.
- Preserve each entity’s existing click destination and event isolation.
- Keep the current media-before-entity order and existing spacing around the tag group.
- Render each tagged entity as a compact, single-line pill with:
  - the entity’s preferred stored image in a small circular crop;
  - a type-aware fallback when an image is unavailable or fails;
  - the entity name truncated within a bounded width;
  - accessible naming and keyboard operation for the existing navigation action.
- Keep multiple tagged entities wrapping naturally on narrow screens.

### 2. Remove the redundant category row from posted cards

- Stop rendering `EntityCategoryBadge` beneath tagged entities in `PostFeedItem`.
- Remove only imports and helper code made unused by that removal.
- Do not remove category data, category badges elsewhere, or any category logic used by search and entity pages.

### 3. Preserve completed post-card behavior

- Do not change the header, author identity, type badge, Review rating, title/body, media, location tags, action row, counts, comments, save/share behavior, navigation, or data queries.
- Do not change the `/create` composer pill; it remains the visual reference and keeps its add/remove controls.
- Apply the result wherever the shared `PostFeedItem` already renders: home/feed, hashtag, Entity V4, post detail, and related-post cards.
- Leave the separate legacy profile-card renderer unchanged; it is not the shared container shown in the supplied examples.

## Verification

- Check a long-name entity, multiple entities, missing/broken images, and an entity with a category.
- Verify desktop and mobile widths, light and dark themes, wrapping, truncation, and no overlap.
- Verify entity clicks still open the same canonical entity pages.
- Confirm media remains above entity pills and the category row is absent only from shared posted cards.
- Confirm Review rating and post-type badge still render exactly once.
- Run focused tests/type validation and inspect the latest preview build signal.

## Technical details

- Reuse `getOptimalEntityImageUrl` for image selection rather than reading `image_url` directly.
- Use the existing image fallback handling and semantic theme classes.
- Prefer a small focused read-only entity-pill component if needed; do not generalize or refactor unrelated tag systems.
- No schema, generated-type, query, routing, or write-path changes.